'use strict';

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

const ICON = {
  refresh: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/></svg>',
  out: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  down: '<svg viewBox="0 0 24 24"><path d="M12 5v14"/><path d="m6 13 6 6 6-6"/></svg>',
  alert: '<svg viewBox="0 0 24 24"><path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/></svg>',
};

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
const COMMON_CURRENCIES = ['JPY', 'CNY', 'USD', 'HKD', 'TWD', 'KRW', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD'];
const COUNTRY_LABEL = { JP: 'JP', CN: 'CN' };

const state = {
  items: [],
  vendors: [],
  rates: null,
  ratesError: null,
  settings: null,
  pending: [],
  refreshing: new Set(),
  highlight: null,
  editing: null,
  rev: 0,
  syncing: false,
  tab: 'all',
  sort: 'newest',
};

// ---------------------------------------------------------------- helpers

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function safeUrl(u) {
  try {
    const p = new URL(u);
    return p.protocol === 'http:' || p.protocol === 'https:' ? p.href : '';
  } catch {
    return '';
  }
}
function hostOf(u) {
  try { return new URL(u).hostname.replace(/^www\d?\./, ''); } catch { return ''; }
}
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const formatters = new Map();
function formatter(cur, whole) {
  const key = cur + (whole ? ':w' : '');
  if (!formatters.has(key)) {
    try {
      formatters.set(key, new Intl.NumberFormat('en-US', {
        style: 'currency', currency: cur,
        currencyDisplay: cur === 'JPY' || cur === 'USD' ? 'narrowSymbol' : 'symbol',
        ...(whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
      }));
    } catch {
      formatters.set(key, null);
    }
  }
  return formatters.get(key);
}

// A price-card figure: small currency sign, big digits, like a store price card.
function bigPrice(n, cur) {
  const f = formatter(cur, cur !== 'USD' && Number.isInteger(n));
  if (!f) return esc(money(n, cur));
  return f.formatToParts(n).map((p) => (p.type === 'currency' ? `<span class="cur">${esc(p.value)}</span>` : esc(p.value))).join('');
}

function money(n, cur = 'USD', whole = false) {
  if (n == null || !Number.isFinite(n)) return '—';
  // Store prices in foreign currencies are usually whole numbers; drop a meaningless ".00".
  if (cur !== 'USD' && Number.isInteger(n)) whole = true;
  // Yen and yuan share "¥": yen shows as ¥ and yuan as CN¥ so they can't be confused.
  const f = formatter(cur, whole);
  return f ? f.format(n) : `${n.toFixed(2)} ${cur}`;
}
const rateText = (x) => (x >= 0.01 ? x.toFixed(4).replace(/0{1,2}$/, '') : Number(x.toPrecision(3)).toString());

const monthValue = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
function addMonths(n) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return d;
}
const monthLabel = (d) => d.toLocaleString('en-US', { month: 'short', year: 'numeric' });
function monthsUntil(value) {
  const m = /^(\d{4})-(\d{2})$/.exec(value || '');
  if (!m) return 0;
  const now = new Date();
  return (+m[1] - now.getFullYear()) * 12 + (+m[2] - 1 - now.getMonth());
}
function timeAgo(ms) {
  if (!ms) return 'never';
  const s = (Date.now() - ms) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

function defaultSettings() {
  const d = new Date();
  d.setMonth(d.getMonth() + 12);
  return {
    mode: 'save', planBy: 'date', goalMonth: monthValue(d), saved: '0', apy: '0', budget: '250',
    down: '0', apr: '9.99', term: '12', importShipping: '30', importFeePct: '5', importDutyPct: '10',
  };
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  const rev = Number(res.headers.get('X-Wishlist-Rev'));
  if (method !== 'GET' && rev === state.rev + 1) state.rev = rev;
  return data;
}

function toast(message, kind = 'info', ms = 4500) {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = message;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), ms);
}

// ---------------------------------------------------------------- money math

function toUSD(amount, cur) {
  if (amount == null) return null;
  if (cur === 'USD') return amount;
  const r = state.rates?.rates?.[cur];
  return r ? amount / r : null;
}

const canImport = (it) => Boolean(it.country) || (it.currency && it.currency !== 'USD');

function derive(it) {
  const usd = toUSD(it.price, it.currency);
  const goods = usd != null ? usd * it.qty : null;
  const discount = it.price != null && it.originalPrice > it.price
    ? { pct: (1 - it.price / it.originalPrice) * 100 }
    : null;
  const origUSD = discount ? toUSD(it.originalPrice, it.currency) : null;
  const firstSeen = it.history?.[0];
  const drop = !discount && it.price != null && it.addedPrice > it.price && (!firstSeen || firstSeen.currency === it.currency)
    ? (1 - it.price / it.addedPrice) * 100
    : null;

  let importCost = 0;
  if (goods != null && it.mode === 'import' && canImport(it)) {
    const s = state.settings;
    const shipping = it.shipping != null ? it.shipping : num(s.importShipping);
    const fee = goods * num(s.importFeePct) / 100;
    const duty = (goods + shipping) * num(s.importDutyPct) / 100;
    importCost = shipping + fee + duty;
  }
  return {
    usd,
    goods,
    importCost,
    landed: goods != null ? goods + importCost : null,
    discount,
    saving: origUSD != null && usd != null ? (origUSD - usd) * it.qty : 0,
    drop,
  };
}

function totals() {
  let goods = 0, imports = 0, savings = 0, count = 0, missing = 0, unrated = 0;
  const stores = new Set();
  for (const it of state.items) {
    if (!it.include) continue;
    const d = derive(it);
    count += it.qty;
    stores.add((it.vendor || hostOf(it.url)).toLowerCase());
    if (it.price == null) { missing++; continue; }
    if (d.goods == null) { unrated++; continue; }
    goods += d.goods;
    imports += d.importCost;
    savings += d.saving;
  }
  return { goods, imports, total: goods + imports, savings, count, missing, unrated, stores: stores.size };
}

function computePlan() {
  const s = state.settings;
  const goal = totals().total;
  if (s.mode === 'finance') {
    const down = Math.min(num(s.down), goal);
    const principal = Math.max(0, goal - down);
    const n = Math.max(1, Math.round(num(s.term)) || 12);
    const r = num(s.apr) / 1200;
    const monthly = principal === 0 ? 0 : r ? (principal * r) / (1 - Math.pow(1 + r, -n)) : principal / n;
    return { mode: 'finance', goal, down, principal, monthly, months: n, interest: monthly * n - principal, end: addMonths(n) };
  }
  const saved = num(s.saved);
  const r = num(s.apy) / 1200;
  let monthly, months;
  if (s.planBy === 'budget') {
    monthly = num(s.budget);
    months = 0;
    let bal = saved;
    while (bal < goal - 0.005 && months <= 1200) { months++; bal = bal * (1 + r) + monthly; }
    if (months > 1200) months = null;
  } else {
    months = monthsUntil(s.goalMonth);
    if (months < 1) return { mode: 'save', goal, error: 'Pick a month after this one.' };
    const remaining = Math.max(0, goal - saved * Math.pow(1 + r, months));
    monthly = remaining === 0 ? 0 : r ? (remaining * r) / (Math.pow(1 + r, months) - 1) : remaining / months;
  }
  return {
    mode: 'save', goal, saved, monthly, months,
    end: months != null ? addMonths(months) : null,
    timeline: buildTimeline(saved, monthly, r),
  };
}

function buildTimeline(saved, monthly, r) {
  const items = state.items
    .filter((it) => it.include)
    .map((it) => ({ it, cost: derive(it).landed }))
    .filter((x) => x.cost != null)
    .sort((a, b) => (PRIORITY_RANK[a.it.priority] ?? 1) - (PRIORITY_RANK[b.it.priority] ?? 1) || a.cost - b.cost);
  let bal = saved, m = 0, cum = 0;
  return items.map(({ it, cost }) => {
    cum += cost;
    while (bal < cum - 0.005 && m < 1200) { m++; bal = bal * (1 + r) + monthly; }
    return { it, cost, month: bal >= cum - 0.005 ? m : null };
  });
}

// ---------------------------------------------------------------- rendering

function initial(it) {
  return esc(((it.vendor || hostOf(it.url) || '?')[0] || '?').toUpperCase());
}
function plateHTML(it) {
  const img = safeUrl(it.image);
  return img
    ? `<img src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-letter="${initial(it)}">`
    : `<span class="ph">${initial(it)}</span>`;
}

function priceCardHTML(it, d) {
  if (it.price == null) {
    return `<div class="band"><div class="empty-price">
      <strong>Price needed</strong>
      <span>${esc(it.lastError ? 'This store didn’t share its price.' : 'Add the price to include it.')}</span>
      <button type="button" class="btn btn-quiet" data-act="edit"><span>Add price</span></button>
    </div></div>`;
  }
  const rate = it.currency !== 'USD' ? state.rates?.rates?.[it.currency] : null;
  let main = '';
  if (d.discount) {
    main += `<span class="sale">−${Math.round(d.discount.pct)}%</span>
      <span class="was">was <s>${money(it.originalPrice, it.currency)}</s></span>`;
  }
  main += `<span class="num">${bigPrice(it.price, it.currency)}${it.qty > 1 ? `<span class="qty-x">× ${it.qty}</span>` : ''}</span>`;
  if (it.currency !== 'USD') {
    main += d.usd == null
      ? `<span class="usd"><span>${state.rates || state.ratesError ? `No exchange rate for ${esc(it.currency)}` : 'Converting to USD…'}</span></span>`
      : `<span class="usd"><strong>${money(d.goods)}</strong>${rate ? `<span>1 ${esc(it.currency)} = $${rateText(1 / rate)}</span>` : ''}</span>`;
  }
  if (d.drop >= 0.5) {
    main += `<span class="drop" title="Was ${money(it.addedPrice, it.currency)} when you added it">${ICON.down}${Math.round(d.drop) || '<1'}% since added</span>`;
  }
  let html = `<div class="band"><div class="band-main">${main}</div>`;
  if (canImport(it)) {
    const imp = it.mode === 'import';
    html += `<div class="buyway" role="group" aria-label="How you'll buy it">
      <button type="button" data-mode="domestic" aria-pressed="${!imp}"><span>Domestic</span></button>
      <button type="button" data-mode="import" aria-pressed="${imp}"><span>Import</span></button>
    </div>`;
    if (imp && d.landed != null) {
      html += `<div class="landed"><span>+${money(d.importCost)} import, est.</span><strong>≈ ${money(d.landed)} landed</strong></div>`;
    }
  }
  return html + '</div>';
}

function cardHTML(it) {
  const d = derive(it);
  const href = safeUrl(it.url);
  const busy = state.refreshing.has(it.id);
  const tags = [];
  if (it.priority === 'high') tags.push('<span class="tag high">High priority</span>');
  if (it.category) tags.push(`<span class="tag">${esc(it.category)}</span>`);
  if (it.price != null && it.lastError) tags.push(`<span class="tag warn" title="${esc(it.lastError)}">Couldn't auto-update</span>`);
  if (it.notes) tags.push(`<span class="tag note" title="${esc(it.notes)}">${esc(it.notes)}</span>`);
  const country = COUNTRY_LABEL[it.country];
  const native = it.vendorNative && it.vendorNative !== it.vendor ? `<small>${esc(it.vendorNative)}</small>` : '';
  const storeName = esc(it.vendor || hostOf(it.url));

  return `<article class="card ${it.include ? '' : 'excluded'} ${state.highlight === it.id ? 'flash' : ''}" data-id="${esc(it.id)}">
    <a class="plate" href="${esc(href)}" target="_blank" rel="noopener noreferrer" tabindex="-1" aria-hidden="true">${plateHTML(it)}</a>
    <div class="card-top">
      <span class="flag" title="${storeName}${it.vendorNative ? ' · ' + esc(it.vendorNative) : ''}"><span>${country ? `<b>${country}</b>` : ''}${storeName}${native}</span></span>
      <label class="include" title="Include in total"><input type="checkbox" class="inc" ${it.include ? 'checked' : ''} aria-label="Include in total"></label>
    </div>
    <div class="card-info">
      <a class="title" href="${esc(href)}" target="_blank" rel="noopener noreferrer" title="${esc(it.title)}">${esc(it.title)}</a>
      ${tags.length ? `<div class="tags">${tags.join('')}</div>` : ''}
    </div>
    ${priceCardHTML(it, d)}
    <div class="card-foot">
      <label class="qty" title="Quantity"><span>Qty</span><input class="qty-in" type="number" min="1" max="999" step="1" value="${it.qty}" aria-label="Quantity"></label>
      <a class="btn btn-go" href="${esc(href)}" target="_blank" rel="noopener noreferrer"><span>Buy</span>${ICON.out}</a>
      <button type="button" class="icon-btn ${busy ? 'spin' : ''}" data-act="refresh" title="Check price again (last checked ${timeAgo(it.checkedAt)})" aria-label="Check price again">${ICON.refresh}</button>
      <button type="button" class="icon-btn" data-act="edit" title="Edit" aria-label="Edit">${ICON.edit}</button>
      <span class="foot-sep" aria-hidden="true"></span>
      <button type="button" class="icon-btn danger" data-act="delete" title="Remove from wishlist" aria-label="Remove from wishlist">${ICON.trash}</button>
    </div>
  </article>`;
}

function pendingHTML(p) {
  return `<article class="card skeleton" aria-busy="true">
    <div class="plate"></div>
    <div class="card-info"><div class="store"><span>${esc(p.host || 'Store')}</span></div>
      <div class="loading-line"><span class="spinner"></span>Getting the photo, price and any sale…</div></div>
    <div class="band"><div class="band-main"><span class="num">&nbsp;</span></div></div>
    <div class="card-foot"></div>
  </article>`;
}

function sortedItems() {
  let items = [...state.items];
  if (state.tab !== 'all') items = items.filter((it) => (it.category || '') === state.tab);
  const landed = (it) => derive(it).landed ?? -1;
  const by = {
    newest: (a, b) => b.addedAt - a.addedAt,
    priority: (a, b) => (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1) || b.addedAt - a.addedAt,
    high: (a, b) => landed(b) - landed(a),
    low: (a, b) => (landed(a) < 0) - (landed(b) < 0) || landed(a) - landed(b),
    store: (a, b) => (a.vendor || '').localeCompare(b.vendor || '') || b.addedAt - a.addedAt,
  }[state.sort];
  return items.sort(by);
}

function renderTabs() {
  const cats = new Map();
  for (const it of state.items) cats.set(it.category || '', (cats.get(it.category || '') || 0) + 1);
  const named = [...cats.keys()].filter(Boolean).sort((a, b) => a.localeCompare(b));
  if (state.tab !== 'all' && !cats.has(state.tab)) state.tab = 'all';
  const tab = (id, label, count) =>
    `<button type="button" class="tab" role="tab" data-tab="${esc(id)}" aria-selected="${state.tab === id}"><span>${esc(label)}<span class="count">${count}</span></span></button>`;
  let html = tab('all', 'All items', state.items.length);
  for (const c of named) html += tab(c, c, cats.get(c));
  if (named.length && cats.has('')) html += tab('', 'No category', cats.get(''));
  html = state.items.length ? html : '';
  const shape = html.replace(/aria-selected="(true|false)"/g, '');
  if (shape === renderTabs.shape) {
    $$('#tabs .tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === state.tab)));
  } else {
    renderTabs.shape = shape;
    $('#tabs').innerHTML = html;
  }
}

function renderShelf() {
  renderTabs();
  const items = sortedItems();
  $('#grid').innerHTML = state.pending.map(pendingHTML).join('') + items.map(cardHTML).join('');
  const empty = !state.items.length && !state.pending.length;
  $('#empty').hidden = !empty;
  $('#grid').hidden = empty;
  $('.shelf-bar').hidden = empty;

  const t = totals();
  const notes = [];
  if (t.missing) notes.push(`${plural(t.missing, 'item')} ${t.missing === 1 ? 'needs' : 'need'} a price before ${t.missing === 1 ? 'it counts' : 'they count'} toward your total.`);
  if (t.unrated && (state.rates || state.ratesError)) notes.push(`${plural(t.unrated, 'item')} ${t.unrated === 1 ? 'uses a currency' : 'use currencies'} without an exchange rate.`);
  $('#notice').innerHTML = notes.length ? `<div class="notice">${ICON.alert}<span>${notes.join(' ')}</span></div>` : '';

  $('#categoryList').innerHTML = [...new Set(state.items.map((i) => i.category).filter(Boolean))]
    .map((c) => `<option value="${esc(c)}"></option>`).join('');
}

function renderRegister() {
  const t = totals();
  const rows = [
    `<div><dt>${plural(t.count, 'item')} from ${plural(t.stores, 'store')}</dt><dd>${money(t.goods)}</dd></div>`,
  ];
  if (t.savings > 0.005) rows.push(`<div class="save"><dt>Sale savings included</dt><dd>−${money(t.savings)}</dd></div>`);
  if (t.imports > 0.005) rows.push(`<div><dt>Import costs<small>Your estimates for shipping, fees, duty</small></dt><dd>+${money(t.imports)}</dd></div>`);
  if (converting()) {
    rows.length = 0;
    rows.push(`<div><dt>${plural(t.count, 'item')} from ${plural(t.stores, 'store')}</dt><dd>Converting…</dd></div>`);
    rows.push('<div class="total"><dt>Total in USD</dt><dd>…</dd></div>');
    $('#receipt').innerHTML = rows.join('');
    $('#mobileTotal').hidden = true;
    return;
  }
  rows.push(`<div class="total"><dt>Total in USD${t.imports > 0.005 ? '<small>includes import estimates</small>' : ''}</dt><dd>${money(t.total)}</dd></div>`);
  $('#receipt').innerHTML = rows.join('');

  const plan = computePlan();
  const mt = $('#mobileTotal');
  mt.hidden = !state.items.length;
  const per = plan.error ? '' : `${money(plan.monthly)}/mo ${plan.mode === 'finance' ? 'financed' : 'to save'}`;
  mt.innerHTML = `<div><strong>${money(t.total)}</strong><span>${per}</span></div><a href="#plan">See plan</a>`;
}

// True while exchange rates are still loading and some prices can't be converted yet.
function converting() {
  return !state.rates && !state.ratesError && state.items.some((it) => it.include && it.price != null && it.currency !== 'USD');
}

function renderPlan() {
  const s = state.settings;
  const root = $('#plan');
  root.dataset.mode = s.mode;
  root.dataset.planby = s.planBy;
  $$('button[data-mode]', root).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.mode === s.mode)));
  $$('button[data-planby]', root).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.planby === s.planBy)));

  const plan = computePlan();
  const result = $('#planResult');
  const months = $('#months');
  months.innerHTML = '';

  if (converting()) {
    result.innerHTML = '<div class="big">…</div><p>Converting prices to US dollars…</p>';
    return;
  }
  if (plan.goal <= 0) {
    result.innerHTML = `<div class="big">$0<small>/mo</small></div><p>Add items with prices and this shows what to put aside each month.</p>`;
    return;
  }
  if (plan.error) {
    result.innerHTML = `<div class="big">—</div><p>${esc(plan.error)}</p>`;
    return;
  }
  if (plan.mode === 'finance') {
    result.innerHTML = `<div class="big">${money(plan.monthly)}<small>/month</small></div>
      <p>for <b>${plan.months} months</b> at ${num(s.apr)}% APR. You'd pay <b>${money(plan.interest)}</b> in interest, ${money(plan.goal + plan.interest)} in all, finishing in <b>${monthLabel(plan.end)}</b>.</p>`;
    return;
  }
  let line;
  if (plan.months == null) line = `At ${money(plan.monthly)} a month you won't reach ${money(plan.goal)}. Try a bigger amount.`;
  else if (plan.months === 0) line = `You've already saved enough to buy everything.`;
  else line = `for <b>${plural(plan.months, 'month')}</b> to have <b>${money(plan.goal)}</b> by <b>${monthLabel(plan.end)}</b>.`;
  result.innerHTML = `<div class="big">${money(plan.monthly)}<small>/month</small></div><p>${line}</p>`;

  const shown = plan.timeline.slice(0, 8);
  months.innerHTML = shown.map(({ it, cost, month }) => {
    const when = month == null ? 'Not reached' : month === 0 ? 'Now' : monthLabel(addMonths(month));
    const img = safeUrl(it.image);
    return `<li><span class="m-when ${month === 0 ? 'now' : ''}">${when}</span>
      <span class="m-slot">${img ? `<img src="${esc(img)}" alt="" referrerpolicy="no-referrer" data-letter="${initial(it)}" data-mini>` : `<span class="mini-ph">${initial(it)}</span>`}
      <span title="${esc(it.title)}">${esc(it.title)}</span><em>${money(cost, 'USD', true)}</em></span></li>`;
  }).join('') + (plan.timeline.length > shown.length ? `<li class="more">and ${plural(plan.timeline.length - shown.length, 'more item')}, high priority first</li>` : '');
}

function renderImportSummary() {
  const s = state.settings;
  $('#importSum').textContent = `$${num(s.importShipping)} + ${num(s.importFeePct)}% + ${num(s.importDutyPct)}%`;
}

// Today's moon, from the mean synodic month counted from a known new moon (2000-01-06 18:14 UTC).
function moonPhase(date = new Date()) {
  const synodic = 29.530588853;
  const age = (((date - Date.UTC(2000, 0, 6, 18, 14)) / 86400000) % synodic + synodic) % synodic;
  const names = ['New moon', 'Waxing crescent', 'First quarter', 'Waxing gibbous', 'Full moon', 'Waning gibbous', 'Last quarter', 'Waning crescent'];
  return { fraction: age / synodic, name: names[Math.round((age / synodic) * 8) % 8] };
}

function moonSVG(fraction) {
  // Lit part = a half disc plus or minus an ellipse whose width follows the phase.
  const r = 10, cx = 11, cy = 11;
  const waxing = fraction < 0.5;
  const k = Math.cos(2 * Math.PI * fraction);  // 1 at new, -1 at full
  const rx = Math.abs(k) * r;
  const outer = waxing ? 1 : 0;              // which half is lit
  const inner = (k > 0) === waxing ? 0 : 1;  // ellipse bulges into or out of the lit half
  const lit = `M${cx} ${cy - r} A${r} ${r} 0 0 ${outer} ${cx} ${cy + r} A${rx} ${r} 0 0 ${inner} ${cx} ${cy - r}Z`;
  return `<svg class="moon" viewBox="0 0 22 22" aria-hidden="true"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#2a3d70"/><path d="${lit}" fill="#f4f7ff"/></svg>`;
}

function timeOfDay(h) {
  if (h === 0) return 'Dark Hour';
  if (h < 6) return 'Late Night';
  if (h < 9) return 'Early Morning';
  if (h < 12) return 'Morning';
  if (h < 14) return 'Lunchtime';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}

function renderCalendar() {
  const now = new Date();
  const moon = moonPhase(now);
  $('#calDate').innerHTML = `${now.getMonth() + 1}<small>/</small>${now.getDate()}`;
  $('#calDay').innerHTML = `${now.toLocaleDateString('en-US', { weekday: 'short' })} ${moonSVG(moon.fraction)}<em>${timeOfDay(now.getHours())}</em>`;
  $('#calDay').title = moon.name;
}

function renderRates() {
  const cal = $('#calendar');
  const r = state.rates;
  cal.classList.toggle('live', !!r && !r.stale);
  if (!r) {
    $('#calRate').innerHTML = `<span class="dot"></span>${state.ratesError ? 'Exchange rates unavailable' : 'Loading exchange rates…'}`;
    return;
  }
  const day = new Date(r.updated * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const jpy = r.rates.JPY, cny = r.rates.CNY;
  $('#calRate').innerHTML = `<span class="dot"></span>$1 = <b>¥${jpy ? jpy.toFixed(1) : '—'}</b> · <b>CN¥${cny ? cny.toFixed(2) : '—'}</b>${r.stale ? ' (older rates)' : ''}`;
  cal.title = `Exchange rates from ${r.source}, updated ${new Date(r.updated * 1000).toLocaleString()}`;
  $('#regRates').textContent = `Converted at ${r.source} rates, ${day}. Store prices can change; check before buying.`;
}

function renderStoreChips() {
  const shown = state.vendors.filter((v, i, all) => all.findIndex((x) => x.name === v.name) === i);
  $('#storeChips').innerHTML = shown.map((v) =>
    `<span class="store-chip ${v.country === 'CN' ? 'cn' : ''}" title="${v.access === 'open' ? 'Looked up automatically' : 'Use the bookmark button'}"><b>${v.country}</b>${esc(v.name)} <small>${esc(v.native !== v.name ? v.native : '')}</small></span>`).join('');
}

function render() {
  renderCalendar();
  renderRates();
  renderShelf();
  renderRegister();
  renderPlan();
  renderImportSummary();
}

// ---------------------------------------------------------------- actions

async function addUrls(text) {
  const urls = text.split(/\s+/).map((u) => u.trim()).filter(Boolean)
    .map((u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`));
  await Promise.all(urls.map(async (url) => {
    const p = { id: Math.random().toString(36).slice(2), host: hostOf(url) };
    state.pending.unshift(p);
    renderShelf();
    try {
      const { item } = await api('/api/items', { method: 'POST', body: { url } });
      state.items.push(item);
      state.highlight = item.id;
      if (item.lastError) {
        toast(item.lastError, 'warn', 8000);
        if (urls.length === 1) openEditor(item);
      } else {
        toast(`Added from ${item.vendor}`, 'ok');
      }
    } catch (err) {
      toast(err.message, 'error', 6000);
    } finally {
      state.pending = state.pending.filter((x) => x !== p);
      render();
    }
  }));
}

// Replay the selection sweep on an element the owner just picked.
function sweep(el) {
  if (!el) return;
  el.classList.remove('sweep');
  void el.offsetWidth;
  el.classList.add('sweep');
  setTimeout(() => el.classList.remove('sweep'), 400);
}

function replaceItem(item) {
  const i = state.items.findIndex((x) => x.id === item.id);
  if (i >= 0) state.items[i] = item;
  else state.items.push(item);
}

async function patchItem(id, fields) {
  const it = state.items.find((x) => x.id === id);
  if (it) { Object.assign(it, fields); render(); }  // optimistic
  try {
    replaceItem((await api(`/api/items/${id}`, { method: 'PATCH', body: fields })).item);
  } catch (err) {
    toast(err.message, 'error');
  }
  render();
}

async function refreshItem(id, quiet = false) {
  state.refreshing.add(id);
  renderShelf();
  try {
    const { item } = await api(`/api/items/${id}/refresh`, { method: 'POST' });
    replaceItem(item);
    if (!quiet) toast(item.lastError ? item.lastError : 'Price is up to date', item.lastError ? 'warn' : 'ok', item.lastError ? 8000 : 3000);
    return item;
  } catch (err) {
    if (!quiet) toast(err.message, 'error');
    return null;
  } finally {
    state.refreshing.delete(id);
    render();
  }
}

async function refreshAll() {
  const btn = $('#refreshAll');
  const label = $('span', btn);
  const queue = state.items.map((i) => i.id);
  const total = queue.length;
  let done = 0, failed = 0;
  btn.disabled = true;
  const worker = async () => {
    while (queue.length) {
      const item = await refreshItem(queue.shift(), true);
      if (!item || item.lastError) failed++;
      label.textContent = `Checking ${++done} of ${total}…`;
    }
  };
  label.textContent = `Checking 0 of ${total}…`;
  await Promise.all([worker(), worker(), worker()]);
  btn.disabled = false;
  label.textContent = 'Refresh prices';
  toast(failed
    ? `Updated ${total - failed} of ${total}. ${plural(failed, 'store')} couldn't be checked automatically; their last prices are kept.`
    : 'All prices are up to date', failed ? 'warn' : 'ok', 6000);
}

async function deleteItem(id) {
  const it = state.items.find((x) => x.id === id);
  if (!it || !confirm(`Remove "${it.title}" from your wishlist?`)) return;
  try {
    await api(`/api/items/${id}`, { method: 'DELETE' });
    state.items = state.items.filter((x) => x.id !== id);
    render();
  } catch (err) {
    toast(err.message, 'error');
  }
}

let settingsTimer = null;
function saveSettingsSoon() {
  clearTimeout(settingsTimer);
  settingsTimer = setTimeout(() => {
    api('/api/settings', { method: 'PUT', body: state.settings }).catch((err) => toast(err.message, 'error'));
  }, 400);
}

// ---------------------------------------------------------------- editor dialog

function currencyOptions(selected) {
  const codes = new Set(COMMON_CURRENCIES);
  Object.keys(state.rates?.rates || {}).sort().forEach((c) => codes.add(c));
  if (selected) codes.add(selected);
  return [...codes].map((c) => `<option value="${c}" ${c === selected ? 'selected' : ''}>${c}</option>`).join('');
}

function openEditor(item) {
  state.editing = item || null;
  const form = $('#editorForm');
  const it = item || { title: '', url: '', price: null, originalPrice: null, currency: 'JPY', qty: 1, vendor: '', category: '', priority: 'medium', image: '', notes: '', mode: 'domestic', shipping: null };
  $('#editorTitle').textContent = item ? 'Edit item' : 'Add an item by hand';
  form.currency.innerHTML = currencyOptions(it.currency);
  for (const key of ['title', 'url', 'vendor', 'category', 'priority', 'image', 'notes', 'mode']) form[key].value = it[key] ?? '';
  form.price.value = it.price ?? '';
  form.originalPrice.value = it.originalPrice ?? '';
  form.shipping.value = it.shipping ?? '';
  form.shipping.placeholder = `Default $${num(state.settings.importShipping)}`;
  form.qty.value = it.qty || 1;
  const alert = $('#editorAlert');
  alert.hidden = !(item && item.lastError);
  alert.textContent = item?.lastError || '';
  $('#editorError').hidden = true;
  updateEditorPreview();
  $('#editor').showModal();
  (item ? (item.price == null ? form.price : form.title) : form.url).focus();
}

function updateEditorPreview() {
  const form = $('#editorForm');
  $('#editorThumb').innerHTML = plateHTML({ image: form.image.value, vendor: form.vendor.value, url: form.url.value });
  const price = form.price.value === '' ? null : num(form.price.value);
  const cur = form.currency.value;
  const usd = toUSD(price, cur);
  $('#editorUsd').innerHTML = price == null ? '' : cur === 'USD' ? `<b>${money(price)}</b>`
    : usd == null ? 'No exchange rate' : `<b>${money(price, cur)}</b>about ${money(usd)}`;
}

async function submitEditor(e) {
  e.preventDefault();
  const form = $('#editorForm');
  const errorEl = $('#editorError');
  if (!safeUrl(form.url.value.trim())) {
    errorEl.textContent = 'Enter the product link, starting with https://';
    errorEl.hidden = false;
    form.url.focus();
    return;
  }
  const body = {
    title: form.title.value.trim(),
    url: form.url.value.trim(),
    price: form.price.value === '' ? null : form.price.value,
    originalPrice: form.originalPrice.value === '' ? null : form.originalPrice.value,
    currency: form.currency.value,
    qty: form.qty.value || 1,
    mode: form.mode.value,
    shipping: form.shipping.value === '' ? null : form.shipping.value,
    vendor: form.vendor.value.trim(),
    category: form.category.value.trim(),
    priority: form.priority.value,
    image: form.image.value.trim(),
    notes: form.notes.value.trim(),
  };
  try {
    const { item } = state.editing
      ? await api(`/api/items/${state.editing.id}`, { method: 'PATCH', body })
      : await api('/api/items/manual', { method: 'POST', body });
    replaceItem(item);
    state.highlight = item.id;
    $('#editor').close();
    render();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

// ---------------------------------------------------------------- keeping the list in sync

// True while the owner is typing in a field or editing an item, so a background reload waits.
function busyEditing() {
  const el = document.activeElement;
  return $('#editor').open || (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && el.id !== 'urlInput');
}

async function reloadList(manual = false) {
  if (state.syncing) return;
  state.syncing = true;
  const btn = $('#reloadList');
  btn.classList.add('busy');
  try {
    const known = new Set(state.items.map((i) => i.id));
    const { items, rev } = await api('/api/items');
    const added = items.filter((i) => !known.has(i.id));
    state.items = items;
    state.rev = rev;
    if (added.length) {
      state.highlight = added[added.length - 1].id;
      setTimeout(() => { state.highlight = null; }, 2000);
    }
    if (manual) await loadRates(false);
    render();
    if (added.length === 1) toast(`Added "${added[0].title}" from ${added[0].vendor}`, 'ok');
    else if (added.length > 1) toast(`${added.length} new items added to your list`, 'ok');
    else if (manual) toast('Your list is up to date', 'ok', 2500);
  } catch (err) {
    if (manual) toast(err.message, 'error');
  } finally {
    state.syncing = false;
    btn.classList.remove('busy');
  }
}

// Pick up items added from the Chrome extension (or anywhere else) without reopening the app.
async function checkForChanges() {
  if (document.hidden || state.syncing || state.pending.length || busyEditing()) return;
  try {
    const { rev } = await api('/api/revision');
    if (rev !== state.rev) await reloadList();
  } catch {
    // the app may be restarting; try again on the next tick
  }
}

function startSync() {
  setInterval(checkForChanges, 3000);
  window.addEventListener('focus', checkForChanges);
  document.addEventListener('visibilitychange', checkForChanges);
  $('#reloadList').addEventListener('click', () => reloadList(true));
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key.toLowerCase() === 'r') {
      e.preventDefault();
      reloadList(true);
    }
  });
}

// ---------------------------------------------------------------- extension guide

async function openGuide() {
  const status = $('#guideStatus');
  status.className = 'guide-status';
  status.textContent = 'Checking whether the extension is connected…';
  $('#extGuide').showModal();
  try {
    const { extensionSeen } = await api('/api/health');
    if (extensionSeen) {
      status.classList.add('ok');
      status.textContent = `Your Chrome extension is connected. It was last used ${timeAgo(extensionSeen)}.`;
    } else {
      status.textContent = 'Not connected yet. Follow the steps below.';
    }
  } catch {
    status.hidden = true;
  }
}

// ---------------------------------------------------------------- bookmarklet

async function setupBookmarklet() {
  try {
    const { token } = await api('/api/bookmarklet');
    const action = `${location.origin}/api/capture`;
    const code = `(function(){var f=document.createElement('form');f.method='POST';f.action=${JSON.stringify(action)};f.target='_blank';f.acceptCharset='utf-8';f.style.display='none';[['token',${JSON.stringify(token)}],['url',location.href],['html',document.documentElement.outerHTML]].forEach(function(p){var t=document.createElement('textarea');t.name=p[0];t.value=p[1];f.appendChild(t);});document.body.appendChild(f);f.submit();setTimeout(function(){f.remove();},2000);})();`;
    const link = $('#bookmarklet');
    link.href = `javascript:${encodeURIComponent(code)}`;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      toast('Drag this button to your bookmarks bar, then click it on a product page.', 'info', 5000);
    });
  } catch {
    $('#bmTip').hidden = true;
  }
}

// ---------------------------------------------------------------- wiring

function bindEvents() {
  $('#addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#urlInput');
    const text = input.value;
    input.value = '';
    if (text.trim()) addUrls(text);
    else input.focus();
  });
  $('#addManual').addEventListener('click', () => openEditor(null));
  $('#extGuideBtn').addEventListener('click', openGuide);
  $('#extFolderBtn').addEventListener('click', async () => {
    try {
      await api('/api/extension/folder', { method: 'POST', body: {} });
      toast('The Chrome Extension folder is open. Next, open Chrome.', 'ok');
    } catch (err) { toast(err.message, 'error', 7000); }
  });
  $('#extChromeBtn').addEventListener('click', async () => {
    try {
      await api('/api/extension/chrome', { method: 'POST', body: {} });
    } catch (err) { toast(err.message, 'error', 7000); }
  });
  $$('#extGuide [data-close]').forEach((b) => b.addEventListener('click', () => $('#extGuide').close()));
  $('#extGuide').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
  $('#refreshAll').addEventListener('click', refreshAll);
  $('#sort').addEventListener('change', (e) => { state.sort = e.target.value; renderShelf(); });
  $('#tabs').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (!tab) return;
    state.tab = tab.dataset.tab;
    renderShelf();
    sweep($(`#tabs .tab[aria-selected="true"]`));
  });

  $('#grid').addEventListener('click', (e) => {
    const card = e.target.closest('.card[data-id]');
    if (!card) return;
    const item = state.items.find((x) => x.id === card.dataset.id);
    if (!item) return;
    const way = e.target.closest('.buyway button');
    if (way) {
      if (item.mode !== way.dataset.mode) {
        way.parentElement.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === way)));
        sweep(way);
        setTimeout(() => patchItem(item.id, { mode: way.dataset.mode }), 260);
      }
      return;
    }
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    if (btn.dataset.act === 'edit') openEditor(item);
    if (btn.dataset.act === 'refresh' && !state.refreshing.has(item.id)) refreshItem(item.id);
    if (btn.dataset.act === 'delete') deleteItem(item.id);
  });
  $('#grid').addEventListener('change', (e) => {
    const id = e.target.closest('.card[data-id]')?.dataset.id;
    if (!id) return;
    if (e.target.classList.contains('inc')) patchItem(id, { include: e.target.checked });
    if (e.target.classList.contains('qty-in')) patchItem(id, { qty: Math.max(1, Math.round(num(e.target.value)) || 1) });
  });

  // Broken or blank product photos (some stores answer hotlinks with a 1px image) fall back to the store's initial.
  const fallback = (img) => {
    img.outerHTML = `<span class="${img.hasAttribute('data-mini') ? 'mini-ph' : 'ph'}">${esc(img.dataset.letter)}</span>`;
  };
  document.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG' && e.target.dataset.letter) fallback(e.target);
  }, true);
  document.addEventListener('load', (e) => {
    const img = e.target;
    if (img.tagName === 'IMG' && img.dataset.letter && img.naturalWidth <= 2) fallback(img);
  }, true);

  const register = $('#register');
  register.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mode], button[data-planby]');
    if (!btn) return;
    if (btn.dataset.mode) state.settings.mode = btn.dataset.mode;
    if (btn.dataset.planby) state.settings.planBy = btn.dataset.planby;
    saveSettingsSoon();
    renderPlan();
    renderRegister();
    sweep(btn);
  });
  const goalM = $('#goalM'), goalY = $('#goalY');
  const thisYear = new Date().getFullYear();
  goalM.innerHTML = Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${new Date(2000, i, 1).toLocaleString('en-US', { month: 'long' })}</option>`).join('');
  goalY.innerHTML = Array.from({ length: 11 }, (_, i) => `<option>${thisYear + i}</option>`).join('');
  const [gy, gm] = (state.settings.goalMonth || '').split('-').map(Number);
  if (gy) { goalY.value = String(Math.max(gy, thisYear)); goalM.value = String(gm || 1); }
  const setGoal = () => {
    state.settings.goalMonth = `${goalY.value}-${String(goalM.value).padStart(2, '0')}`;
    saveSettingsSoon();
    renderPlan();
    renderRegister();
  };
  goalM.addEventListener('change', setGoal);
  goalY.addEventListener('change', setGoal);
  $$('[data-setting]', register).forEach((el) => {
    el.value = state.settings[el.dataset.setting] ?? '';
    el.addEventListener('input', () => {
      state.settings[el.dataset.setting] = el.value;
      saveSettingsSoon();
      if (el.dataset.setting.startsWith('import')) render();
      else { renderPlan(); renderRegister(); }
    });
  });

  const form = $('#editorForm');
  form.addEventListener('submit', submitEditor);
  form.addEventListener('input', updateEditorPreview);
  $$('[data-close]', form).forEach((b) => b.addEventListener('click', () => $('#editor').close()));
  $('#editor').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
}

async function loadRates(rerender = true) {
  try {
    state.rates = await api('/api/rates');
    state.ratesError = null;
  } catch (err) {
    state.ratesError = err.message;
  }
  if (rerender) render();
}

async function init() {
  const params = new URLSearchParams(location.search);
  try {
    const [{ items, rev }, { settings }, { vendors }] = await Promise.all([api('/api/items'), api('/api/settings'), api('/api/vendors')]);
    state.items = items;
    state.rev = rev;
    state.vendors = vendors;
    state.settings = { ...defaultSettings(), ...settings };
  } catch (err) {
    state.settings = defaultSettings();
    toast(`Couldn't load your wishlist: ${err.message}`, 'error', 8000);
  }
  bindEvents();
  renderStoreChips();
  render();
  loadRates();  // amounts read "Converting…" until the rates arrive, then everything re-renders
  setupBookmarklet();
  startSync();

  if (params.has('added')) {
    const item = state.items.find((x) => x.id === params.get('added'));
    if (item) {
      state.highlight = item.id;
      renderShelf();
      if (item.lastError) openEditor(item);
      else toast(`Added "${item.title}" from ${item.vendor}`, 'ok');
    }
  }
  if (params.has('error')) toast(params.get('error'), 'error', 8000);
  if (params.has('added') || params.has('error')) history.replaceState(null, '', location.pathname);
  setTimeout(() => { state.highlight = null; }, 2000);
}

init();

'use strict';

const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

const ICON = {
  refresh: '<svg viewBox="0 0 24 24"><path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16"/><path d="M10 11v6M14 11v6"/><path d="M6 7l1 13h10l1-13"/><path d="M9 7V4h6v3"/></svg>',
  ok: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
  warn: '<svg viewBox="0 0 24 24"><path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/></svg>',
};

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
const PRIORITY_LABEL = { high: 'High priority', medium: 'Medium', low: 'Low priority' };
const COMMON_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CNY', 'KRW', 'INR', 'CHF', 'MXN', 'HKD', 'SGD', 'TWD'];

const state = {
  items: [],
  rates: null,
  settings: null,
  pending: [],
  refreshing: new Set(),
  highlight: null,
  editing: null,
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

const formatters = new Map();
function money(n, cur = 'USD', whole = false) {
  if (n == null || !Number.isFinite(n)) return '—';
  const key = cur + (whole ? ':w' : '');
  if (!formatters.has(key)) {
    try {
      formatters.set(key, new Intl.NumberFormat('en-US', {
        style: 'currency', currency: cur,
        ...(whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
      }));
    } catch {
      formatters.set(key, null);
    }
  }
  const f = formatters.get(key);
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
  return { mode: 'save', planBy: 'date', goalMonth: monthValue(d), saved: '0', apy: '0', budget: '250', down: '0', apr: '9.99', term: '12' };
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: method === 'GET' ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function toast(message, kind = 'info', ms = 4200) {
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

function derive(it) {
  const usd = toUSD(it.price, it.currency);
  const lineUSD = usd != null ? usd * it.qty : null;
  const discount = it.price != null && it.originalPrice > it.price
    ? { amount: it.originalPrice - it.price, pct: (1 - it.price / it.originalPrice) * 100 }
    : null;
  const origUSD = discount ? toUSD(it.originalPrice, it.currency) : null;
  const firstSeen = it.history?.[0];
  const drop = !discount && it.price != null && it.addedPrice > it.price && (!firstSeen || firstSeen.currency === it.currency)
    ? (1 - it.price / it.addedPrice) * 100
    : null;
  return { usd, lineUSD, discount, discountUSD: origUSD != null && usd != null ? (origUSD - usd) * it.qty : 0, drop };
}

function totals() {
  let total = 0, savings = 0, count = 0, missing = 0;
  const stores = new Set();
  for (const it of state.items) {
    if (!it.include) continue;
    const d = derive(it);
    count += it.qty;
    stores.add((it.vendor || hostOf(it.url)).toLowerCase());
    if (d.lineUSD == null) { missing++; continue; }
    total += d.lineUSD;
    savings += d.discountUSD;
  }
  return { total, savings, count, missing, stores: stores.size };
}

function timelineItems() {
  return state.items
    .filter((it) => it.include)
    .map((it) => ({ it, lineUSD: derive(it).lineUSD }))
    .filter((x) => x.lineUSD != null)
    .sort((a, b) => (PRIORITY_RANK[a.it.priority] ?? 1) - (PRIORITY_RANK[b.it.priority] ?? 1) || a.lineUSD - b.lineUSD);
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
    if (months < 1) return { mode: 'save', goal, error: 'Pick a target month after this one.' };
    const remaining = Math.max(0, goal - saved * Math.pow(1 + r, months));
    monthly = remaining === 0 ? 0 : r ? (remaining * r) / (Math.pow(1 + r, months) - 1) : remaining / months;
  }
  const contributed = saved + monthly * (months || 0);
  return {
    mode: 'save', goal, saved, monthly, months,
    end: months != null ? addMonths(months) : null,
    interest: months ? Math.max(0, goal - contributed) : 0,
    timeline: buildTimeline(saved, monthly, r),
  };
}

function buildTimeline(saved, monthly, r) {
  let bal = saved, m = 0, cum = 0;
  return timelineItems().map(({ it, lineUSD }) => {
    cum += lineUSD;
    while (bal < cum - 0.005 && m < 1200) { m++; bal = bal * (1 + r) + monthly; }
    return { it, lineUSD, cum, month: bal >= cum - 0.005 ? m : null };
  });
}

// ---------------------------------------------------------------- rendering

function thumbHTML(it) {
  const img = safeUrl(it.image);
  const letter = esc(((it.vendor || hostOf(it.url) || '?')[0] || '?').toUpperCase());
  return img
    ? `<img src="${esc(img)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-letter="${letter}">`
    : `<span class="thumb-ph">${letter}</span>`;
}

function rowHTML(it) {
  const d = derive(it);
  const href = safeUrl(it.url);
  const host = hostOf(it.url);
  const busy = state.refreshing.has(it.id);
  const rate = it.currency !== 'USD' ? state.rates?.rates?.[it.currency] : null;

  const tags = [];
  if (it.category) tags.push(`<span class="tag cat">${esc(it.category)}</span>`);
  if (it.priority !== 'medium') tags.push(`<span class="tag prio-${esc(it.priority)}">${PRIORITY_LABEL[it.priority] || ''}</span>`);
  if (it.price == null) tags.push(`<span class="tag warn" title="${esc(it.lastError || '')}">Needs a price</span>`);
  else if (it.lastError) tags.push(`<span class="tag warn" title="${esc(it.lastError)}">Couldn't auto-update</span>`);
  if (it.notes) tags.push(`<span class="item-note" title="${esc(it.notes)}">${esc(it.notes)}</span>`);

  let price;
  if (it.price == null) {
    price = '<button type="button" class="link-btn" data-act="edit">Add price</button>';
  } else {
    price = `<div class="price">${money(it.price, it.currency)}</div>`;
    if (d.discount) {
      price += `<div class="was"><s>${money(it.originalPrice, it.currency)}</s><span class="tag sale">−${Math.round(d.discount.pct)}%</span></div>`;
    } else if (d.drop >= 0.5) {
      price += `<div class="was"><span class="tag drop" title="Was ${money(it.addedPrice, it.currency)} when you added it">↓ ${Math.round(d.drop) || '<1'}% since added</span></div>`;
    }
  }

  let usd;
  if (it.price == null) usd = '<span class="muted">—</span>';
  else if (d.usd == null) usd = `<span class="tag warn" title="No exchange rate for ${esc(it.currency)}">No rate</span>`;
  else {
    usd = `<div class="price">${money(d.lineUSD)}</div>`;
    if (it.qty > 1) usd += `<div class="sub">${money(d.usd)} each</div>`;
    if (rate) usd += `<div class="sub">1 ${esc(it.currency)} = $${rateText(1 / rate)}</div>`;
  }

  const rowClass = ['item', it.include ? '' : 'excluded', state.highlight === it.id ? 'flash' : ''].join(' ');
  return `<tr class="${rowClass}" data-id="${esc(it.id)}">
    <td class="c-check"><input type="checkbox" class="inc" ${it.include ? 'checked' : ''} title="Include in totals" aria-label="Include in totals"></td>
    <td class="c-item"><div class="item-cell">
      <a class="thumb" href="${esc(href)}" target="_blank" rel="noopener noreferrer" tabindex="-1">${thumbHTML(it)}</a>
      <div class="item-meta">
        <a class="item-title" href="${esc(href)}" target="_blank" rel="noopener noreferrer" title="${esc(it.title)}">${esc(it.title)}</a>
        ${tags.length ? `<div class="item-sub">${tags.join('')}</div>` : ''}
      </div>
    </div></td>
    <td class="c-store" data-label="Store"><span class="store">${host ? `<img class="fav" src="https://${esc(host)}/favicon.ico" alt="" referrerpolicy="no-referrer">` : ''}<span title="${esc(it.vendor)}">${esc(it.vendor || host)}</span></span></td>
    <td class="c-price num" data-label="Price">${price}</td>
    <td class="c-usd num" data-label="In USD">${usd}</td>
    <td class="c-qty num" data-label="Qty"><input class="qty" type="number" min="1" max="999" step="1" value="${it.qty}" aria-label="Quantity"></td>
    <td class="c-buy"><a class="btn btn-buy btn-buy-sm" href="${esc(href)}" target="_blank" rel="noopener noreferrer">Buy</a></td>
    <td class="c-act">
      <button type="button" class="icon-btn ${busy ? 'spinning' : ''}" data-act="refresh" title="Refresh price (checked ${timeAgo(it.checkedAt)})" aria-label="Refresh price">${ICON.refresh}</button>
      <button type="button" class="icon-btn" data-act="edit" title="Edit" aria-label="Edit">${ICON.edit}</button>
      <button type="button" class="icon-btn danger" data-act="delete" title="Remove" aria-label="Remove">${ICON.trash}</button>
    </td>
  </tr>`;
}

function pendingRowHTML(p) {
  return `<tr class="pending"><td class="c-check"></td><td colspan="7"><div class="item-cell">
    <span class="thumb skeleton"></span>
    <div class="item-meta"><div class="item-title">Looking up ${esc(p.host || 'product')}…</div>
    <div class="item-sub"><span class="spinner"></span> Getting the picture, price and any discounts</div></div>
  </div></td></tr>`;
}

function renderList() {
  const items = [...state.items].sort((a, b) => b.addedAt - a.addedAt);
  const groups = new Map();
  for (const it of items) {
    const key = it.category || '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(it);
  }
  const keys = [...groups.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
  const showGroups = keys.length > 1;

  let html = state.pending.map(pendingRowHTML).join('');
  for (const key of keys) {
    const list = groups.get(key);
    if (showGroups) {
      const subtotal = list.reduce((sum, it) => sum + (it.include ? derive(it).lineUSD || 0 : 0), 0);
      html += `<tr class="group"><th colspan="8"><div class="group-inner">
        <span class="group-name">${esc(key || 'Uncategorized')}</span><span class="group-count">${list.length}</span>
        <span class="group-total">${money(subtotal)}</span></div></th></tr>`;
    }
    html += list.map(rowHTML).join('');
  }
  $('#rows').innerHTML = html;

  const hasRows = items.length > 0 || state.pending.length > 0;
  $('#empty').hidden = hasRows;
  $('.parts thead').style.visibility = hasRows ? '' : 'hidden';
  $('#refreshAll').hidden = items.length === 0;

  const t = totals();
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  let foot = '';
  if (items.length) {
    foot += `<tr class="total-row"><td colspan="4" class="total-label">Total <span class="muted">${plural(t.count, 'item')} from ${plural(t.stores, 'store')}</span></td>
      <td class="num total-val">${money(t.total)}</td><td colspan="3"></td></tr>`;
    if (t.savings > 0.005) {
      foot += `<tr class="savings-row"><td colspan="4" class="total-label">Sale discounts</td><td class="num">−${money(t.savings)}</td><td colspan="3"></td></tr>`;
    }
  }
  $('#foot').innerHTML = foot;

  $('#categoryList').innerHTML = [...new Set(state.items.map((i) => i.category).filter(Boolean))]
    .map((c) => `<option value="${esc(c)}"></option>`).join('');
}

function renderSummary() {
  const t = totals();
  const plan = computePlan();
  if (!state.items.length) { $('#summary').innerHTML = ''; return; }

  const unpriced = state.items.filter((it) => it.include && it.price == null).length;
  const unrated = t.missing - unpriced;
  let strip;
  if (unpriced || unrated) {
    const parts = [];
    if (unpriced) parts.push(`<b>${unpriced}</b> item${unpriced === 1 ? '' : 's'} need${unpriced === 1 ? 's' : ''} a price. Click <b>Add price</b> to fill ${unpriced === 1 ? 'it' : 'them'} in`);
    if (unrated) parts.push(`<b>${unrated}</b> item${unrated === 1 ? ' has a currency' : 's have currencies'} without an exchange rate`);
    strip = `<div class="strip warn">${ICON.warn}<span>${parts.join('. ')}. They're left out of the total.</span></div>`;
  } else {
    const disc = state.items.filter((it) => it.include && derive(it).discount).length;
    strip = `<div class="strip ok">${ICON.ok}<span>All ${t.count === 1 ? '' : t.count + ' '}item${t.count === 1 ? '' : 's'} priced and converted to USD${disc ? `. <b>${disc}</b> ${disc === 1 ? 'is' : 'are'} on sale right now` : ''}.</span></div>`;
  }

  let planStat;
  if (plan.error) planStat = `<span class="stat-value">—</span><span class="stat-sub">${esc(plan.error)}</span>`;
  else if (plan.mode === 'finance') planStat = `<span class="stat-value">${money(plan.monthly)}<small>/mo</small></span><span class="stat-sub">financed over ${plan.months} months</span>`;
  else if (plan.months == null) planStat = `<span class="stat-value">${money(plan.monthly)}<small>/mo</small></span><span class="stat-sub">isn't enough to reach the goal</span>`;
  else planStat = `<span class="stat-value">${money(plan.monthly)}<small>/mo</small></span><span class="stat-sub">${plan.months ? `for ${plan.months} month${plan.months === 1 ? '' : 's'}` : 'you already have enough'}</span>`;

  const doneBy = plan.error || plan.end == null ? '—' : plan.mode === 'save' && plan.months === 0 ? 'Now' : monthLabel(plan.end);
  $('#summary').innerHTML = `${strip}
    <div class="stats">
      <div class="stat accent"><span class="stat-label">Wishlist total</span><span class="stat-value">${money(t.total)}</span><span class="stat-sub">${t.count} item${t.count === 1 ? '' : 's'} · ${t.stores} store${t.stores === 1 ? '' : 's'}</span></div>
      <div class="stat good"><span class="stat-label">Sale savings</span><span class="stat-value">${money(t.savings)}</span><span class="stat-sub">vs. regular prices</span></div>
      <div class="stat"><span class="stat-label">${plan.mode === 'finance' ? 'Monthly payment' : 'Save each month'}</span>${planStat}</div>
      <div class="stat"><span class="stat-label">${plan.mode === 'finance' ? 'Paid off by' : 'Goal reached'}</span><span class="stat-value">${doneBy}</span><span class="stat-sub"><a href="#plan">Adjust plan →</a></span></div>
    </div>`;
}

function renderPlan() {
  const s = state.settings;
  const root = $('#plan');
  root.dataset.mode = s.mode;
  root.dataset.planby = s.planBy;
  $$('[data-mode]', root).forEach((b) => b.tagName === 'BUTTON' && b.setAttribute('aria-selected', String(b.dataset.mode === s.mode)));
  $$('[data-planby]', root).forEach((b) => b.tagName === 'BUTTON' && b.setAttribute('aria-selected', String(b.dataset.planby === s.planBy)));

  const plan = computePlan();
  const result = $('#planResult');
  const timeline = $('#timeline');

  if (!state.items.length || plan.goal <= 0) {
    result.innerHTML = `<div class="result-label">${s.mode === 'finance' ? 'Monthly payment' : 'Save each month'}</div>
      <div class="result-big">$0<small>/mo</small></div>
      <div class="result-sub">Add items with prices to your wishlist to build a plan.</div>`;
    timeline.innerHTML = '';
    return;
  }
  if (plan.error) {
    result.innerHTML = `<div class="plan-error">${esc(plan.error)}</div>`;
    timeline.innerHTML = '';
    return;
  }

  if (plan.mode === 'finance') {
    result.innerHTML = `<div class="result-label">Monthly payment</div>
      <div class="result-big">${money(plan.monthly)}<small>/mo</small></div>
      <div class="result-sub">for <b>${plan.months} months</b> at ${num(s.apr)}% APR. Your last payment is in <b>${monthLabel(plan.end)}</b>.</div>
      <dl class="facts">
        <div><dt>Wishlist total</dt><dd>${money(plan.goal)}</dd></div>
        <div><dt>Down payment</dt><dd>${money(plan.down)}</dd></div>
        <div><dt>Amount financed</dt><dd>${money(plan.principal)}</dd></div>
        <div><dt>Interest paid</dt><dd>${money(plan.interest)}</dd></div>
        <div><dt>Total cost</dt><dd>${money(plan.goal + plan.interest)}</dd></div>
      </dl>`;
    timeline.innerHTML = financeScheduleHTML(plan, num(s.apr) / 1200);
    return;
  }

  const pct = plan.goal ? Math.min(100, (plan.saved / plan.goal) * 100) : 0;
  let sub;
  if (plan.months == null) sub = `At ${money(plan.monthly)} a month you won't reach ${money(plan.goal)}. Try a bigger monthly amount.`;
  else if (plan.months === 0) sub = `You've already saved enough to buy everything on your list.`;
  else sub = `for <b>${plan.months} month${plan.months === 1 ? '' : 's'}</b> to have <b>${money(plan.goal)}</b> by <b>${monthLabel(plan.end)}</b>.`;
  result.innerHTML = `<div class="result-label">Save each month</div>
    <div class="result-big">${money(plan.monthly)}<small>/mo</small></div>
    <div class="result-sub">${sub}</div>
    <div><div class="bar"><span style="width:${pct.toFixed(1)}%"></span></div>
      <div class="bar-caption"><span>${money(plan.saved)} saved</span><span>${pct.toFixed(0)}% of ${money(plan.goal, 'USD', true)}</span></div></div>
    <dl class="facts">
      <div><dt>Goal</dt><dd>${money(plan.goal)}</dd></div>
      <div><dt>Still needed</dt><dd>${money(Math.max(0, plan.goal - plan.saved))}</dd></div>
      <div><dt>Interest earned</dt><dd>${money(plan.interest)}</dd></div>
    </dl>`;

  const rows = plan.timeline.map(({ it, lineUSD, cum, month }) => {
    const when = month == null ? 'Not reached' : month === 0 ? 'Now' : monthLabel(addMonths(month));
    return `<div class="tl-row">
      <span class="tl-when ${month === 0 ? 'now' : ''}">${when}</span>
      <span class="thumb">${thumbHTML(it)}</span>
      <span class="tl-title" title="${esc(it.title)}">${esc(it.title)} <span class="muted">· ${money(lineUSD)}</span></span>
      <span class="tl-bar"><span class="bar"><span style="width:${Math.min(100, (cum / plan.goal) * 100).toFixed(1)}%"></span></span></span>
      <span class="tl-cum">${money(cum, 'USD', true)} total</span>
    </div>`;
  }).join('');
  timeline.innerHTML = rows ? `<h3>When you can afford each item <span>High priority first, then cheapest first</span></h3>${rows}` : '';
}

function financeScheduleHTML(plan, r) {
  if (plan.principal <= 0) return '';
  const rows = [];
  let bal = plan.principal;
  const step = plan.months <= 12 ? 3 : plan.months <= 24 ? 6 : 12;
  for (let m = 1; m <= plan.months; m++) {
    const interest = bal * r;
    bal = Math.max(0, bal + interest - plan.monthly);
    if (m % step === 0 || m === plan.months) {
      const paidPct = (1 - bal / plan.principal) * 100;
      rows.push(`<div class="tl-row">
        <span class="tl-when">${monthLabel(addMonths(m))}</span><span></span>
        <span class="tl-title">After payment ${m} of ${plan.months}</span>
        <span class="tl-bar"><span class="bar"><span style="width:${paidPct.toFixed(1)}%"></span></span></span>
        <span class="tl-cum">${money(bal, 'USD', true)} left</span>
      </div>`);
    }
  }
  return `<h3>Payoff schedule <span>${money(plan.monthly)} every month</span></h3>${rows.join('')}`;
}

function renderRates() {
  const pill = $('#ratesPill');
  const r = state.rates;
  pill.classList.toggle('live', !!r && !r.stale);
  pill.classList.toggle('stale', !!r && !!r.stale);
  if (!r) {
    $('#ratesText').textContent = state.ratesError ? 'Rates unavailable' : 'Loading rates…';
    pill.title = state.ratesError || '';
    return;
  }
  const day = new Date(r.updated * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  $('#ratesText').textContent = `${r.stale ? 'Rates from' : 'Live rates'} · ${day}`;
  pill.title = `Exchange rates from ${r.source}, updated daily. Last update: ${new Date(r.updated * 1000).toLocaleString()}`;
  $('#footRates').textContent = `Exchange rates: ${r.source}, updated ${day}. Prices are as listed on each store and may change.`;
}

function render() {
  renderRates();
  renderList();
  renderSummary();
  renderPlan();
}

// ---------------------------------------------------------------- actions

async function addUrls(text) {
  const urls = text.split(/\s+/).map((u) => u.trim()).filter(Boolean)
    .map((u) => (/^https?:\/\//i.test(u) ? u : `https://${u}`));
  if (!urls.length) return;
  await Promise.all(urls.map(async (url) => {
    const p = { id: Math.random().toString(36).slice(2), host: hostOf(url) };
    state.pending.unshift(p);
    renderList();
    try {
      const { item } = await api('/api/items', { method: 'POST', body: { url } });
      state.items.push(item);
      state.highlight = item.id;
      if (item.lastError) {
        toast(item.lastError, 'warn', 7000);
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

async function patchItem(id, fields) {
  try {
    const { item } = await api(`/api/items/${id}`, { method: 'PATCH', body: fields });
    replaceItem(item);
  } catch (err) {
    toast(err.message, 'error');
  }
  render();
}

function replaceItem(item) {
  const i = state.items.findIndex((x) => x.id === item.id);
  if (i >= 0) state.items[i] = item;
  else state.items.push(item);
}

async function refreshItem(id, quiet = false) {
  state.refreshing.add(id);
  renderList();
  try {
    const { item } = await api(`/api/items/${id}/refresh`, { method: 'POST' });
    replaceItem(item);
    if (!quiet) toast(item.lastError ? item.lastError : 'Price is up to date', item.lastError ? 'warn' : 'ok', item.lastError ? 7000 : 3000);
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
  label.textContent = `Refreshing 0/${total}…`;
  const worker = async () => {
    while (queue.length) {
      const item = await refreshItem(queue.shift(), true);
      if (!item || item.lastError) failed++;
      label.textContent = `Refreshing ${++done}/${total}…`;
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  btn.disabled = false;
  label.textContent = 'Refresh prices';
  toast(failed ? `Updated ${total - failed} of ${total}. ${failed} store${failed === 1 ? '' : 's'} couldn't be checked automatically.` : 'All prices are up to date', failed ? 'warn' : 'ok', 6000);
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
  const it = item || { title: '', url: '', price: null, originalPrice: null, currency: 'USD', qty: 1, vendor: '', category: '', priority: 'medium', image: '', notes: '' };
  $('#editorTitle').textContent = item ? 'Edit item' : 'Add an item by hand';
  form.currency.innerHTML = currencyOptions(it.currency);
  for (const key of ['title', 'url', 'vendor', 'category', 'priority', 'image', 'notes']) form[key].value = it[key] ?? '';
  form.price.value = it.price ?? '';
  form.originalPrice.value = it.originalPrice ?? '';
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
  const preview = { image: form.image.value, vendor: form.vendor.value, url: form.url.value };
  $('#editorThumb').innerHTML = thumbHTML(preview);
  const price = form.price.value === '' ? null : num(form.price.value);
  const cur = form.currency.value;
  const usd = toUSD(price, cur);
  $('#editorUsd').innerHTML = price == null ? '' : cur === 'USD' ? `<b>${money(price)}</b>` : usd == null ? 'No exchange rate' : `<b>${money(usd)}</b>in US dollars`;
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
    addUrls(text);
  });
  $('#addManual').addEventListener('click', () => openEditor(null));
  $('#refreshAll').addEventListener('click', refreshAll);

  $('#rows').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = btn.closest('tr')?.dataset.id;
    const item = state.items.find((x) => x.id === id);
    if (!item) return;
    if (btn.dataset.act === 'edit') openEditor(item);
    if (btn.dataset.act === 'refresh' && !state.refreshing.has(id)) refreshItem(id);
    if (btn.dataset.act === 'delete') deleteItem(id);
  });
  $('#rows').addEventListener('change', (e) => {
    const id = e.target.closest('tr')?.dataset.id;
    if (!id) return;
    if (e.target.classList.contains('inc')) patchItem(id, { include: e.target.checked });
    if (e.target.classList.contains('qty')) patchItem(id, { qty: Math.max(1, Math.round(num(e.target.value)) || 1) });
  });

  // Broken product images fall back to the store's initial; broken favicons disappear.
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img.tagName !== 'IMG') return;
    if (img.classList.contains('fav')) img.remove();
    else if (img.dataset.letter) img.outerHTML = `<span class="thumb-ph">${esc(img.dataset.letter)}</span>`;
  }, true);

  const plan = $('#plan');
  plan.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-mode], button[data-planby]');
    if (!btn) return;
    if (btn.dataset.mode) state.settings.mode = btn.dataset.mode;
    if (btn.dataset.planby) state.settings.planBy = btn.dataset.planby;
    saveSettingsSoon();
    renderPlan();
    renderSummary();
  });
  $$('[data-setting]', plan).forEach((el) => {
    el.value = state.settings[el.dataset.setting] ?? '';
    el.addEventListener('input', () => {
      state.settings[el.dataset.setting] = el.value;
      saveSettingsSoon();
      renderPlan();
      renderSummary();
    });
  });

  const form = $('#editorForm');
  form.addEventListener('submit', submitEditor);
  form.addEventListener('input', updateEditorPreview);
  $$('[data-close]', form).forEach((b) => b.addEventListener('click', () => $('#editor').close()));
  $('#editor').addEventListener('click', (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });
}

async function loadRates() {
  try {
    state.rates = await api('/api/rates');
    state.ratesError = null;
  } catch (err) {
    state.ratesError = err.message;
  }
  render();
}

async function init() {
  const params = new URLSearchParams(location.search);
  try {
    const [{ items }, { settings }] = await Promise.all([api('/api/items'), api('/api/settings')]);
    state.items = items;
    state.settings = { ...defaultSettings(), ...settings };
  } catch (err) {
    state.settings = defaultSettings();
    toast(`Couldn't load your wishlist: ${err.message}`, 'error', 8000);
  }
  bindEvents();
  render();
  loadRates();
  setupBookmarklet();

  if (params.has('added')) {
    const item = state.items.find((x) => x.id === params.get('added'));
    if (item) {
      state.highlight = item.id;
      renderList();
      if (item.lastError) openEditor(item);
      else toast(`Added "${item.title}" from ${item.vendor}`, 'ok');
    }
  }
  if (params.has('error')) toast(params.get('error'), 'error', 8000);
  if (params.has('added') || params.has('error')) history.replaceState(null, '', location.pathname);
  setTimeout(() => { state.highlight = null; }, 2500);
}

init();

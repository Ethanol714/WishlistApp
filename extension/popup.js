'use strict';

// Wishlist extension popup: grab the current page as the browser shows it, let the Wishlist app
// read the product out of it, show an editable preview, and add it to the list.

const DEFAULT_SERVER = 'http://localhost:8080';
const CURRENCIES = ['JPY', 'CNY', 'USD', 'HKD', 'TWD', 'KRW', 'EUR', 'GBP', 'CAD', 'AUD', 'SGD'];

const $ = (sel) => document.querySelector(sel);
const view = $('#view');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CHECK = '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>';

let base = DEFAULT_SERVER;
let rates = null;
let product = null;
let existing = null;
let mode = 'domestic';

async function api(path, body) {
  const res = await fetch(base + path, body === undefined ? {} : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `The Wishlist app answered ${res.status}`);
  return data;
}

function money(n, cur) {
  if (n == null || !Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: cur,
      currencyDisplay: cur === 'JPY' || cur === 'USD' ? 'narrowSymbol' : 'symbol',
      ...(cur !== 'USD' && Number.isInteger(n) ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
    }).format(n);
  } catch {
    return `${n} ${cur}`;
  }
}
function symbol(cur) {
  try {
    const parts = new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, currencyDisplay: cur === 'JPY' || cur === 'USD' ? 'narrowSymbol' : 'symbol' }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value || cur;
  } catch {
    return cur;
  }
}
const toUSD = (amount, cur) => (amount == null ? null : cur === 'USD' ? amount : rates?.[cur] ? amount / rates[cur] : null);

function showState(title, text, button) {
  view.innerHTML = `<section class="state"><h2>${esc(title)}</h2><p>${esc(text)}</p>${button || ''}</section>`;
}

// ---------------------------------------------------------------- preview

function render() {
  const p = product;
  const img = p.image && /^https?:/i.test(p.image) ? `<img src="${esc(p.image)}" alt="" referrerpolicy="no-referrer">` : `<span class="ph">${esc((p.vendor || '?')[0].toUpperCase())}</span>`;
  const flag = p.country ? `<span class="flag"><span>${esc(p.country)}</span></span>` : '';
  const native = p.vendorNative && p.vendorNative !== p.vendor ? `<small>${esc(p.vendorNative)}</small>` : '';
  const canImport = Boolean(p.country) || p.currency !== 'USD';
  let note = '';
  if (existing) note = `<p class="note found">Already on your list. Adding updates it with what's on this page.</p>`;
  else if (p.price == null) note = `<p class="note">Couldn't find a price on this page. Type it in below.</p>`;

  view.innerHTML = `<form class="card" id="addForm" novalidate>
    <div class="top">
      <div class="plate">${img}</div>
      <div>
        <div class="store">${flag}<span>${esc(p.vendor)}</span>${native}</div>
        <textarea class="title" name="title" rows="3" aria-label="Name">${esc(p.title)}</textarea>
      </div>
    </div>
    ${note}
    <div class="band">
      <div class="sale" id="sale" hidden></div>
      <div class="pc">
        <label class="price-in"><span id="sym">${esc(symbol(p.currency))}</span>
          <input name="price" type="number" step="0.01" min="0" inputmode="decimal" placeholder="Price" value="${p.price ?? ''}" aria-label="Price"></label>
        <select name="currency" aria-label="Currency">${[...new Set([p.currency, ...CURRENCIES])].map((c) => `<option ${c === p.currency ? 'selected' : ''}>${c}</option>`).join('')}</select>
      </div>
      <div class="usd" id="usd"></div>
    </div>
    ${canImport ? `<div class="buyway" role="group" aria-label="How you'll buy it">
      <button type="button" data-mode="domestic" aria-pressed="true"><span>Domestic</span></button>
      <button type="button" data-mode="import" aria-pressed="false"><span>Import</span></button>
    </div>` : ''}
    <div class="fields">
      <label class="field"><span>Regular price, before sale</span><input name="originalPrice" type="number" step="0.01" min="0" value="${p.originalPrice ?? ''}"></label>
      <label class="field"><span>Quantity</span><input name="qty" type="number" min="1" step="1" value="${existing?.qty || 1}"></label>
      <label class="field"><span>Category</span><input name="category" value="${esc(existing?.category || '')}" placeholder="Games, Figures, Tech…"></label>
      <label class="field"><span>Priority</span><select name="priority">
        ${['high', 'medium', 'low'].map((v) => `<option value="${v}" ${v === (existing?.priority || 'medium') ? 'selected' : ''}>${v[0].toUpperCase() + v.slice(1)}</option>`).join('')}
      </select></label>
    </div>
    <p class="error" id="error" hidden></p>
    <div class="actions">
      <button type="submit" class="btn btn-go" id="addBtn"><span>${existing ? 'Update in my wishlist' : 'Add to my wishlist'}</span></button>
    </div>
  </form>`;

  if (existing?.mode) setMode(existing.mode);
  const form = $('#addForm');
  form.addEventListener('input', updatePrices);
  form.addEventListener('submit', add);
  form.addEventListener('click', (e) => {
    const b = e.target.closest('.buyway button');
    if (b) setMode(b.dataset.mode);
  });
  updatePrices();
}

function setMode(next) {
  mode = next;
  document.querySelectorAll('.buyway button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
}

function updatePrices() {
  const form = $('#addForm');
  const cur = form.currency.value;
  const price = form.price.value === '' ? null : Number(form.price.value);
  const original = form.originalPrice.value === '' ? null : Number(form.originalPrice.value);
  $('#sym').textContent = symbol(cur);
  const sale = $('#sale');
  if (price != null && original > price) {
    sale.hidden = false;
    sale.textContent = `−${Math.round((1 - price / original) * 100)}% · was ${money(original, cur)}`;
  } else {
    sale.hidden = true;
  }
  const usd = toUSD(price, cur);
  $('#usd').innerHTML = price == null ? 'Add the price to see it in dollars.'
    : cur === 'USD' ? '' : usd == null ? (rates ? `No exchange rate for ${esc(cur)}` : 'Converting…')
    : `<strong>${esc(money(usd, 'USD'))}</strong>at today's rate`;
}

async function add(e) {
  e.preventDefault();
  const form = $('#addForm');
  const button = $('#addBtn');
  const errorEl = $('#error');
  button.disabled = true;
  errorEl.hidden = true;
  try {
    const { item, updated } = await api('/api/items/from-extension', {
      url: product.url,
      title: form.title.value.trim() || product.title,
      image: product.image || '',
      vendor: product.vendor,
      price: form.price.value === '' ? null : form.price.value,
      originalPrice: form.originalPrice.value === '' ? null : form.originalPrice.value,
      currency: form.currency.value,
      qty: form.qty.value || 1,
      mode,
      category: form.category.value.trim(),
      priority: form.priority.value,
    });
    view.innerHTML = `<section class="done">
      <span class="check">${CHECK}</span>
      <h2>${updated ? 'Updated in your wishlist' : 'Added to your wishlist'}</h2>
      <p>${esc(item.title)}</p>
      <button type="button" class="btn btn-go" id="seeList"><span>See my list</span></button>
    </section>`;
    $('#seeList').addEventListener('click', () => openList(item.id));
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
    button.disabled = false;
  }
}

function openList(id) {
  chrome.tabs.create({ url: base + (id ? `/?added=${encodeURIComponent(id)}` : '/') });
  window.close();
}

// ---------------------------------------------------------------- start

async function scan() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !/^https?:/i.test(tab.url || '')) {
    showState('Open a product page', 'Go to a product on any online store, then click the Wishlist button again.');
    return;
  }
  if (tab.url.startsWith(base)) {
    showState("This is your Wishlist", 'Open a product page on a store, then click the Wishlist button to add it.');
    return;
  }
  let page;
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({ url: location.href, html: document.documentElement.outerHTML }),
    });
    page = result.result;
  } catch {
    showState("Can't read this page", 'Chrome doesn’t let extensions read this kind of page. Try a product page on a store.');
    return;
  }
  try {
    const [scanned, rateData] = await Promise.all([
      api('/api/scan', page),
      api('/api/rates').catch(() => null),
    ]);
    product = scanned.product;
    existing = scanned.existing;
    rates = rateData?.rates || null;
    render();
  } catch (err) {
    const offline = err instanceof TypeError;  // fetch failed: the app isn't running
    showState(
      offline ? 'The Wishlist app isn’t running' : 'Something went wrong',
      offline ? `Start it (double-click "Start Wishlist.command"), then click the Wishlist button again. Looking for it at ${base}.` : err.message,
      '<button type="button" class="btn btn-go" id="retry"><span>Try again</span></button>',
    );
    $('#retry').addEventListener('click', () => { showScanning(); scan(); });
  }
}

function showScanning() {
  view.innerHTML = '<section class="state"><span class="spinner"></span><p>Scanning this page for the product, price and photo…</p></section>';
}

(async function init() {
  const saved = await chrome.storage.local.get('server');
  base = (saved.server || DEFAULT_SERVER).replace(/\/+$/, '');
  $('#server').value = base;
  $('#openList').addEventListener('click', () => openList());
  $('#serverForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = $('#server').value.trim().replace(/\/+$/, '');
    if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(value)) {
      $('#server').setCustomValidity('Use an address like http://localhost:8080');
      $('#server').reportValidity();
      return;
    }
    $('#server').setCustomValidity('');
    await chrome.storage.local.set({ server: value });
    base = value;
    showScanning();
    scan();
  });
  scan();
})();

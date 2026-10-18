"""Fetch a product page from any store and pull out title, image, price and discount.

Sources are tried from most to least reliable:
  1. Store-specific readers (Amazon page layout, Shopify's product JSON)
  2. schema.org Product data in JSON-LD
  3. Open Graph / product meta tags
  4. schema.org microdata (itemprop="price")
  5. Visible "price" elements on the page (last resort)
"""
import gzip
import html as htmllib
import json
import re
import urllib.error
import urllib.request
import zlib
from collections import deque
from http.cookiejar import CookieJar
from urllib.parse import parse_qs, unquote, urljoin, urlparse

from .htmldom import parse_html
from .money import (detect_currency, host_currency, locale_currency,
                    money_from_text, normalize_code, parse_amount)

UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36')
HEADERS = {
    'User-Agent': UA,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate',
    'Cache-Control': 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
}
MAX_BYTES = 8_000_000
PRODUCT_TYPES = {'Product', 'ProductGroup', 'IndividualProduct', 'ProductModel', 'Vehicle', 'Car'}
BLOCK_MARKERS = ('captcha', 'are you a robot', 'pardon our interruption', 'access denied',
                 'request unsuccessful', 'cf-chl', 'verify you are human', 'bot detection')
OLD_PRICE_RE = re.compile(r'(?:^|[-_\s])(was|old|compare|original|strike|regular|list|before|msrp|rrp|crossed|reference)')


class ScrapeError(Exception):
    pass


def fetch(url, accept=None, timeout=20):
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))
    headers = dict(HEADERS)
    if accept:
        headers['Accept'] = accept
    req = urllib.request.Request(url, headers=headers)
    try:
        resp = opener.open(req, timeout=timeout)
        status = resp.status
    except urllib.error.HTTPError as e:
        resp, status = e, e.code
    try:
        raw = resp.read(MAX_BYTES) if resp.fp else b''
        final_url = resp.geturl() or url
        encoding = (resp.headers.get('Content-Encoding') or '').lower()
        charset = resp.headers.get_content_charset()
    finally:
        resp.close()
    if 'gzip' in encoding:
        try:
            raw = gzip.decompress(raw)
        except OSError:
            pass
    elif 'deflate' in encoding:
        try:
            raw = zlib.decompress(raw)
        except zlib.error:
            try:
                raw = zlib.decompress(raw, -15)
            except zlib.error:
                pass
    if not charset:
        m = re.search(rb'<meta[^>]+charset=["\']?([\w-]+)', raw[:4096], re.I)
        charset = m.group(1).decode('ascii', 'ignore') if m else 'utf-8'
    try:
        text = raw.decode(charset, errors='replace')
    except LookupError:
        text = raw.decode('utf-8', errors='replace')
    return status, final_url, text


def _as_list(value):
    if value is None:
        return []
    return value if isinstance(value, list) else [value]


def _image_url(value):
    for v in _as_list(value):
        if isinstance(v, str) and v.strip():
            return v.strip()
        if isinstance(v, dict):
            found = v.get('url') or v.get('contentUrl') or v.get('@id')
            if isinstance(found, str) and found.strip():
                return found.strip()
    return None


def _clean(text):
    if not text:
        return None
    text = ' '.join(htmllib.unescape(str(text)).split())
    return text or None


class Extractor:
    def __init__(self, host, page_url):
        self.host = host
        self.page_url = page_url
        self.title = None
        self.image = None
        self.vendor = None
        self.price = None
        self.original = None
        self.currency = None
        self.price_source = None
        self.price_node = None
        self.price_hints = []  # raw price strings, used to guess currency
        self.locale_hint = None

    # -- setters: first good value wins ------------------------------------
    def set_title(self, value):
        if not self.title:
            self.title = _clean(value)

    def set_image(self, value):
        if not self.image and isinstance(value, str) and value.strip() and not value.startswith('data:'):
            self.image = value.strip()

    def set_vendor(self, value):
        if not self.vendor:
            self.vendor = _clean(value)

    def set_price(self, price, currency=None, original=None, source=''):
        if self.price is not None or price is None or price <= 0:
            return False
        self.price = price
        self.price_source = source
        code = normalize_code(currency)
        if code:
            self.currency = code
        self.set_original(original)
        return True

    def set_original(self, original):
        if self.original is None and self.price and original and self.price < original <= self.price * 5:
            self.original = original

    def set_currency(self, currency):
        if not self.currency:
            self.currency = normalize_code(currency)

    # -- store-specific ----------------------------------------------------
    def amazon(self, doc):
        node = doc.select_one('#productTitle')
        if node:
            self.set_title(node.text())
        img = doc.select_one('#landingImage, #imgBlkFront, #main-image')
        if img:
            self.set_image(img.get('data-old-hires'))
            dynamic = img.get('data-a-dynamic-image')
            if dynamic:
                try:
                    sizes = json.loads(htmllib.unescape(dynamic))
                    self.set_image(max(sizes, key=lambda k: sizes[k][0] * sizes[k][1]))
                except (ValueError, TypeError, IndexError):
                    pass
            self.set_image(img.get('src'))

        def first_money(selectors, skip_struck):
            for sel in selectors:
                for node in doc.select(sel):
                    if skip_struck and ('a-text-price' in node.classes() or node.get('data-a-strike')):
                        continue
                    text = node.text()
                    amount, cur = money_from_text(text, self.host)
                    if amount:
                        return amount, cur, text
            return None, None, None

        amount, cur, text = first_money([
            '#corePriceDisplay_desktop_feature_div .priceToPay',
            '#corePriceDisplay_desktop_feature_div .a-price',
            '#corePrice_feature_div .a-price', '#corePrice_desktop .a-price',
            '#priceblock_dealprice', '#priceblock_ourprice', '#priceblock_saleprice',
            '#tp_price_block_total_price_ww .a-price', '#apex_desktop .a-price',
            '#kindle-price', '#price',
        ], skip_struck=True)
        if amount:
            self.price_hints.append(text)
            original = first_money([
                '#corePriceDisplay_desktop_feature_div .basisPrice .a-price',
                '#corePriceDisplay_desktop_feature_div .a-text-price',
                '#corePrice_desktop .a-text-price', '#corePrice_feature_div .a-text-price',
                '#listPrice', '#priceblock_listprice',
            ], skip_struck=False)[0]
            self.set_price(amount, cur, original, 'amazon')
        suffix = re.sub(r'^.*?amazon\.', '', self.host)
        self.set_vendor('Amazon' if suffix == 'com' else 'Amazon.' + suffix)

    def shopify(self, page_url, html):
        parsed = urlparse(page_url)
        m = re.search(r'/products/[^/?#]+', parsed.path)
        if not m:
            return
        js_url = '%s://%s%s.js' % (parsed.scheme, parsed.netloc, parsed.path[:m.end()])
        try:
            status, _, body = fetch(js_url, accept='application/json', timeout=15)
            data = json.loads(body) if status == 200 else None
        except (OSError, ValueError, urllib.error.URLError):
            data = None
        if not isinstance(data, dict):
            return
        variants = data.get('variants') or []
        wanted = (parse_qs(parsed.query).get('variant') or [None])[0]
        variant = next((v for v in variants if str(v.get('id')) == wanted), None)
        if variant is None:
            variant = next((v for v in variants if v.get('available')), variants[0] if variants else {})
        cents = variant.get('price', data.get('price'))
        compare = variant.get('compare_at_price') or data.get('compare_at_price')
        cur = re.search(r'Shopify\.currency\s*=\s*\{\s*"active"\s*:\s*"([A-Z]{3})"', html)
        self.set_title(data.get('title'))
        image = (variant.get('featured_image') or {}).get('src') or data.get('featured_image')
        if image:
            self.set_image('https:' + image if image.startswith('//') else image)
        if isinstance(cents, (int, float)):
            self.set_price(cents / 100.0, cur.group(1) if cur else None,
                           compare / 100.0 if isinstance(compare, (int, float)) else None, 'shopify')

    # -- generic structured data -------------------------------------------
    def jsonld(self, doc):
        products = []
        for script in doc.select('script[type*=ld+json]'):
            raw = script.raw_text().strip()
            raw = re.sub(r'^\s*(<!--|<!\[CDATA\[)|(-->|\]\]>)\s*$', '', raw)
            data = None
            for attempt in (raw, re.sub(r',\s*([}\]])', r'\1', raw)):
                try:
                    data = json.loads(attempt, strict=False)
                    break
                except ValueError:
                    continue
            if data is None:
                continue
            queue = deque([data])
            while queue:
                node = queue.popleft()
                if isinstance(node, list):
                    queue.extend(node)
                    continue
                if not isinstance(node, dict):
                    continue
                types = {str(t).rsplit('/', 1)[-1] for t in _as_list(node.get('@type'))}
                if types & PRODUCT_TYPES:
                    products.append(node)
                for key in ('@graph', 'mainEntity', 'itemListElement', 'item', 'hasVariant'):
                    if key in node:
                        queue.append(node[key])
        for product in products:
            self.set_title(product.get('name'))
            self.set_image(_image_url(product.get('image')))
            offers = product.get('offers')
            if not offers:
                offers = [v.get('offers') for v in _as_list(product.get('hasVariant')) if isinstance(v, dict)]
            if self._offers(offers):
                break

    def _offers(self, offers):
        flat, queue = [], deque(_as_list(offers))
        while queue:
            o = queue.popleft()
            if isinstance(o, list):
                queue.extend(o)
            elif isinstance(o, dict):
                flat.append(o)
                if o.get('offers'):
                    queue.extend(_as_list(o['offers']))
        for offer in flat:
            price = offer.get('price')
            if price in (None, ''):
                price = offer.get('lowPrice')
            currency = offer.get('priceCurrency')
            original = None
            for spec in _as_list(offer.get('priceSpecification')):
                if not isinstance(spec, dict):
                    continue
                kind = str(spec.get('priceType', ''))
                if any(k in kind for k in ('ListPrice', 'StrikethroughPrice', 'MSRP', 'SRP')):
                    original = parse_amount(spec.get('price'), structured=True)
                elif price in (None, ''):
                    price = spec.get('price')
                currency = currency or spec.get('priceCurrency')
            if isinstance(price, str):
                self.price_hints.append(price)
            amount = parse_amount(price, structured=True)
            if self.set_price(amount, currency, original, 'jsonld'):
                return True
        return False

    def meta(self, doc):
        meta = {}
        for node in doc.select('meta'):
            key = (node.get('property') or node.get('name') or node.get('itemprop') or '').lower()
            if key and key not in meta and node.get('content') is not None:
                meta[key] = node.get('content')
        self.set_title(meta.get('og:title') or meta.get('twitter:title'))
        self.set_image(meta.get('og:image:secure_url') or meta.get('og:image')
                       or meta.get('twitter:image') or meta.get('twitter:image:src'))
        self.set_vendor(meta.get('og:site_name') or meta.get('application-name'))

        currency = meta.get('product:price:currency') or meta.get('og:price:currency')
        price = parse_amount(meta.get('product:price:amount') or meta.get('og:price:amount'), structured=True)
        sale = parse_amount(meta.get('product:sale_price:amount'), structured=True)
        original = parse_amount(meta.get('product:original_price:amount'), structured=True)
        if sale and price and sale < price:
            self.set_price(sale, meta.get('product:sale_price:currency') or currency, price, 'meta')
        else:
            self.set_price(price, currency, original, 'meta')
        if self.price is None:
            for i in ('1', '2'):
                if 'price' in (meta.get('twitter:label' + i) or '').lower():
                    amount, cur = money_from_text(meta.get('twitter:data' + i), self.host)
                    self.price_hints.append(meta.get('twitter:data' + i))
                    self.set_price(amount, cur, None, 'meta')
        else:
            self.set_original(original)
        self.set_currency(currency)

    def microdata(self, doc):
        node = doc.select_one('[itemprop=price]')
        if node is not None and self.price is None:
            raw = node.get('content') or node.text()
            self.price_hints.append(raw)
            cur_node = doc.select_one('[itemprop=priceCurrency]')
            currency = cur_node.get('content') or cur_node.text() if cur_node else None
            amount = parse_amount(raw, structured=bool(node.get('content')))
            if self.set_price(amount, currency, None, 'microdata'):
                self.price_node = node
        img = doc.select_one('[itemprop=image]')
        if img is not None:
            self.set_image(img.get('src') or img.get('content') or img.get('href'))

    def visible_price(self, doc):
        """Last resort: elements whose class/id mentions 'price'."""
        for node in doc.iter():
            if node.tag in ('script', 'style', 'noscript', 'option', 'meta', 'link'):
                continue
            label = ' '.join((node.get('class', ''), node.get('id', ''), node.get('data-testid', ''))).lower()
            if 'price' not in label or OLD_PRICE_RE.search(label) or node.tag in ('s', 'del', 'strike'):
                continue
            text = node.text()
            if not text or len(text) > 60:
                continue
            amount, cur = money_from_text(text, self.host)
            if amount and self.set_price(amount, cur, None, 'page'):
                self.price_hints.append(text)
                self.price_node = node
                break

    def nearby_original(self):
        """Look for a struck-through 'was' price close to where the price was found."""
        if self.price_node is None or self.original is not None:
            return
        scope = self.price_node
        for _ in range(3):
            if scope.parent is not None:
                scope = scope.parent
        for node in scope.iter():
            label = ' '.join((node.get('class', ''), node.get('id', ''))).lower()
            if node.tag in ('s', 'del', 'strike') or ('price' in label and OLD_PRICE_RE.search(label)):
                amount, _ = money_from_text(node.text(), self.host)
                self.set_original(amount)
                if self.original:
                    return


def check_url(url):
    parsed = urlparse(url or '')
    if parsed.scheme not in ('http', 'https') or not parsed.netloc:
        raise ScrapeError('Please paste a full link that starts with http:// or https://')
    return parsed


def scrape(url):
    """Fetch a product page from the server and extract its details."""
    parsed = check_url(url)
    try:
        status, final_url, html = fetch(url, timeout=12)
    except (urllib.error.URLError, OSError, ValueError) as e:
        reason = str(getattr(e, 'reason', e))
        if 'timed out' in reason:
            error = ("%s didn't respond. Many big stores block automated lookups: use the "
                     "Add to Wishlist bookmark on the page, or fill in the price manually." % parsed.hostname)
        else:
            error = "Couldn't reach %s (%s). Fill in the details manually." % (parsed.hostname, reason)
        return _result(url, Extractor(parsed.hostname, url), error=error)
    return extract(url if status >= 400 else final_url, html, status)


def extract(url, html, status=200, captured=False):
    """Pull product details out of a page's HTML.

    `captured` means the HTML came from the user's own browser (the bookmarklet),
    so it is the real, fully rendered page rather than a bot-check screen.
    """
    host = (urlparse(url).hostname or '').lower()
    ex = Extractor(host, url)
    doc = parse_html(html)

    if '.amazon.' in '.' + host:
        ex.amazon(doc)
    if '/products/' in urlparse(url).path and ('cdn.shopify.com' in html or 'Shopify.' in html):
        ex.shopify(url, html)
    ex.jsonld(doc)
    ex.meta(doc)
    ex.microdata(doc)
    if ex.price is None:
        ex.visible_price(doc)
    ex.nearby_original()
    if not ex.currency:
        html_tag = doc.select_one('html')
        ex.locale_hint = locale_currency(urlparse(url).path, html_tag.get('lang') if html_tag else None)

    lowered = html[:200000].lower()
    blocked = not captured and ex.price is None and (
        status in (401, 403, 429, 503) or any(m in lowered for m in BLOCK_MARKERS))
    if blocked:
        ex.title = ex.image = None  # those came from the bot-check page, not the product
    if not ex.title and not blocked:
        heading = doc.select_one('h1')
        heading = heading.text() if heading else ''
        if 3 <= len(heading) <= 200:
            ex.set_title(heading)
        else:
            title = doc.select_one('title')
            ex.set_title(title.text() if title else None)
    if ex.title and '.amazon.' in '.' + host:
        ex.title = re.sub(r'^Amazon\.[\w.]+\s*:\s*', '', ex.title)

    error = None
    if blocked:
        error = ('%s blocked the automatic lookup (bot protection). Open the product and click your '
                 'Add to Wishlist bookmark, or fill in the price manually.' % host)
    elif ex.price is None:
        error = "Couldn't find a price on this page. Fill it in manually."
    return _result(url, ex, error)


def title_from_url(url):
    """'/products/nike-air-force-1-07-white.html' -> 'Nike Air Force 1 07 White'."""
    for seg in reversed([s for s in urlparse(url).path.split('/') if s]):
        seg = re.sub(r'\.(html?|php|aspx?)$', '', unquote(seg))
        words = [w for w in re.split(r'[-_+\s]+', seg) if w]
        words = [w for w in words if w.isalpha() or (w.isdigit() and len(w) <= 4)]
        if len(words) >= 2:
            return ' '.join(w if w.isupper() else w.capitalize() for w in words)
    return None


def _result(url, ex, error=None):
    host = (urlparse(url).hostname or '').lower()
    currency = ex.currency
    if not currency:
        for hint in ex.price_hints:
            currency = detect_currency(hint or '', host)
            if currency:
                break
    currency = currency or host_currency(host) or ex.locale_hint or 'USD'
    image = ex.image
    if image:
        image = 'https:' + image if image.startswith('//') else urljoin(url, image)
    vendor = ex.vendor or re.sub(r'^www\d?\.', '', host)
    return {
        'url': url,
        'title': ex.title or title_from_url(url) or 'Item from %s' % vendor,
        'image': image,
        'vendor': vendor,
        'price': round(ex.price, 2) if ex.price is not None else None,
        'originalPrice': round(ex.original, 2) if ex.original is not None else None,
        'currency': currency,
        'source': ex.price_source,
        'error': error,
    }

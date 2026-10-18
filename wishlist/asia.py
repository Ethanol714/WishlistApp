"""Readers for Japanese and Chinese stores.

Each reader fills an Extractor (first good value wins), so anything a store-specific
reader misses still falls through to the generic JSON-LD / meta / visible-price readers.
"""
import json
import re
import urllib.error
from urllib.parse import urlparse

from .money import money_from_text, parse_amount

# "List price ¥3,300" style labels used by Japanese and Chinese stores.
LIST_PRICE_RE = re.compile(
    r'(?:メーカー希望小売価格|希望小売価格|参考小売価格|参考価格|通常価格|定価|原价|划线价|市场价|专柜价)'
    r'\s*[:：]?\s*(?:[（(]税込[)）])?\s*[￥¥]?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?')
YODOBASHI_DISCOUNT_RE = re.compile(r'希望小売価格より\s*[￥¥]\s*([\d,]+)\s*の値引き')


def _first(doc, selectors):
    for sel in selectors:
        node = doc.select_one(sel)
        if node is not None:
            return node
    return None


def _money(doc, selectors, host, lenient=False):
    """First price found under any selector. `lenient` accepts bare numbers (no currency sign)."""
    for sel in selectors:
        for node in doc.select(sel):
            text = node.text()
            if not text or len(text) > 80:
                continue
            amount, cur = money_from_text(text, host)
            if amount is None and lenient:
                amount = parse_amount(text)
            if amount:
                return amount, cur, node
    return None, None, None


def _img(node):
    if node is None:
        return None
    for attr in ('data-origin', 'data-src', 'data-lazy-src', 'src'):
        value = node.get(attr)
        if value and not value.startswith('data:'):
            return value
    return None


# -- DLsite: its own JSON feed has sale and regular prices ---------------------

def dlsite(ex, url, fetch):
    m = re.search(r'product_id/([A-Z]{2}\d{6,})', url)
    if not m:
        return
    pid = m.group(1)
    section = urlparse(url).path.strip('/').split('/')[0] or 'home'
    api = 'https://www.dlsite.com/%s/product/info/ajax?product_id=%s&cdn_cache_min=1' % (section, pid)
    try:
        status, _, body = fetch(api, accept='application/json', timeout=12)
        data = json.loads(body).get(pid) if status == 200 else None
    except (OSError, ValueError, AttributeError, urllib.error.URLError):
        data = None
    if not isinstance(data, dict):
        return
    ex.set_title(data.get('work_name'))
    image = data.get('work_image')
    if image:
        ex.set_image('https:' + image if image.startswith('//') else image)
    ex.set_price(parse_amount(data.get('price'), structured=True), 'JPY',
                 parse_amount(data.get('official_price'), structured=True), 'dlsite')


# -- JD.com --------------------------------------------------------------------

def jd_sku(url):
    m = re.search(r'(?:item(?:\.m)?\.jd\.(?:com|hk)/(?:product/)?|npcitem\.jd\.hk/)(\d+)', url)
    return m.group(1) if m else None


def jd_mobile(ex, url, fetch):
    """JD's mobile page carries the title and photos. Returns the masked price (e.g. '8??9') if hidden."""
    sku = jd_sku(url)
    if not sku:
        return None
    try:
        status, _, page = fetch('https://item.m.jd.com/product/%s.html' % sku, timeout=12)
    except (OSError, ValueError, urllib.error.URLError):
        return None
    name = re.search(r'"skuName":"((?:[^"\\]|\\.)*)"', page)
    if name:
        try:
            ex.set_title(json.loads('"%s"' % name.group(1)))
        except ValueError:
            ex.set_title(name.group(1))
    first = re.search(r'firstImg"\s+src="([^"]+)"', page)
    if first:
        ex.set_image(first.group(1))
    else:
        listed = re.search(r'"image":\["(jfs/[^"]+)"', page)
        if listed:
            ex.set_image('https://img14.360buyimg.com/n0/' + listed.group(1))
    price = re.search(r'"jdPrice":"([^"]*)"', page)
    if price and '?' in price.group(1):
        return price.group(1)
    if price:
        ex.set_price(parse_amount(price.group(1), structured=True), 'CNY', None, 'jd')
    return None


def jd_page(ex, doc):
    """A JD desktop product page as rendered in a signed-in browser."""
    node = _first(doc, ['.sku-name', '[class*=sku-title]', '[class*=skuName]'])
    if node is not None:
        ex.set_title(node.text())
    ex.set_image(_img(_first(doc, ['#spec-img', '[class*=main-img] img', '[class*=mainImg] img'])))
    amount, _, node = _money(doc, ['.summary-price .p-price .price', '.p-price .price', '#jd-price',
                                   '[class*=finalPrice]', '[class*=price-num]', '[class*=priceNum]'],
                             ex.host, lenient=True)
    if amount:
        original, _, _ = _money(doc, ['#page_origin_price', '.summary-price .p-price-plus',
                                      '[class*=originalPrice]', '[class*=originPrice]'], ex.host, lenient=True)
        if ex.set_price(amount, 'CNY', original, 'jd'):
            ex.price_node = node


# -- Taobao / Tmall (only visible to signed-in shoppers) -----------------------

def taobao_page(ex, doc):
    node = _first(doc, ['[class*=MainTitle--mainTitle]', '[class*=mainTitle]', '.tb-main-title',
                        '.tb-detail-hd h1', '[class*=ItemTitle]'])
    if node is not None:
        ex.set_title(node.get('data-title') or node.text())
    ex.set_image(_img(_first(doc, ['[class*=mainPic] img', '[class*=PicGallery] img', '#J_ImgBooth',
                                   '[class*=mainPicWrap] img', '#J_UlThumb img'])))
    amount, _, node = _money(doc, ['[class*=highlightPrice] [class*=priceText]', '[class*=Price--priceText]',
                                   '[class*=priceText]', '#J_PromoPriceNum', '.tm-promo-price .tm-price',
                                   '#J_StrPrice .tb-rmb-num', '.tm-price'], ex.host, lenient=True)
    if amount:
        original, _, _ = _money(doc, ['[class*=subPrice] [class*=priceText]', '[class*=originPrice]',
                                      '#J_StrPriceModBox .tm-price', '#J_StrPrice .tb-rmb-num'],
                                ex.host, lenient=True)
        if ex.set_price(amount, 'CNY', original, 'taobao'):
            ex.price_node = node


# -- Mercari (rendered page) ---------------------------------------------------

def mercari_page(ex, doc):
    amount, cur, node = _money(doc, ['[data-testid=price]'], ex.host, lenient=True)
    if amount and ex.set_price(amount, cur or 'JPY', None, 'mercari'):
        ex.price_node = node
    ex.set_image(_img(_first(doc, ['[data-testid=image-0] img', '[data-testid=carousel-item] img'])))


# -- shared Japanese / Chinese extras ------------------------------------------

def list_price(ex, doc, html):
    """Pick up 定価 / 希望小売価格 / 原价 style regular prices to show the discount."""
    if ex.price is None or ex.original is not None:
        return
    m = YODOBASHI_DISCOUNT_RE.search(html)
    if m:
        ex.set_original(ex.price + parse_amount(m.group(1)))
        return
    if ex.price_node is not None:
        scope = ex.price_node
        for _ in range(6):
            if scope.parent is not None:
                scope = scope.parent
        found = LIST_PRICE_RE.findall(scope.text())
    else:
        found = set(LIST_PRICE_RE.findall(doc.text()[:300000]))
        found = list(found) if len(found) == 1 else []  # ambiguous when several products are listed
    for raw in found:
        ex.set_original(parse_amount(raw))
        if ex.original:
            return


def fix_image(vendor, image):
    if not image or vendor is None:
        return image
    if vendor.suffix == 'biccamera.com':
        return image.split('?')[0]  # drop the 320px resize parameters
    if vendor.suffix in ('jd.com', 'jd.hk'):
        return re.sub(r'!q\d+.*$', '', image)
    return image


def read(ex, doc, url, html, vendor, captured, fetch):
    """Run the store-specific readers for this vendor."""
    suffix = vendor.suffix
    if suffix == 'dlsite.com':
        dlsite(ex, url, fetch)
    elif suffix in ('jd.com', 'jd.hk'):
        jd_page(ex, doc)
    elif suffix in ('taobao.com', 'tmall.com', 'tmall.hk'):
        taobao_page(ex, doc)
    elif suffix == 'jp.mercari.com':
        mercari_page(ex, doc)

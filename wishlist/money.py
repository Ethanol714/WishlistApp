"""Price-string parsing and currency detection."""
import re

from .vendors import vendor_for

ISO_CODES = {
    'USD', 'EUR', 'GBP', 'JPY', 'CNY', 'CAD', 'AUD', 'NZD', 'CHF', 'SEK', 'NOK',
    'DKK', 'ISK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN', 'INR', 'KRW', 'BRL', 'MXN',
    'ARS', 'CLP', 'COP', 'PEN', 'SGD', 'HKD', 'TWD', 'TRY', 'RUB', 'UAH', 'ZAR',
    'AED', 'SAR', 'QAR', 'ILS', 'EGP', 'THB', 'PHP', 'VND', 'MYR', 'IDR', 'PKR',
    'BDT', 'NGN', 'KES',
}

TLD_CURRENCY = {
    'co.uk': 'GBP', 'uk': 'GBP', 'ie': 'EUR', 'de': 'EUR', 'fr': 'EUR', 'it': 'EUR',
    'es': 'EUR', 'nl': 'EUR', 'be': 'EUR', 'at': 'EUR', 'fi': 'EUR', 'pt': 'EUR',
    'gr': 'EUR', 'sk': 'EUR', 'si': 'EUR', 'lt': 'EUR', 'lv': 'EUR', 'ee': 'EUR',
    'lu': 'EUR', 'eu': 'EUR', 'ca': 'CAD', 'com.au': 'AUD', 'au': 'AUD',
    'co.nz': 'NZD', 'nz': 'NZD', 'jp': 'JPY', 'co.jp': 'JPY', 'cn': 'CNY',
    'com.cn': 'CNY', 'kr': 'KRW', 'co.kr': 'KRW', 'in': 'INR', 'co.in': 'INR',
    'com.br': 'BRL', 'br': 'BRL', 'com.mx': 'MXN', 'mx': 'MXN', 'ch': 'CHF',
    'se': 'SEK', 'no': 'NOK', 'dk': 'DKK', 'is': 'ISK', 'pl': 'PLN', 'cz': 'CZK',
    'hu': 'HUF', 'ro': 'RON', 'sg': 'SGD', 'com.sg': 'SGD', 'hk': 'HKD',
    'com.hk': 'HKD', 'tw': 'TWD', 'com.tw': 'TWD', 'tr': 'TRY', 'com.tr': 'TRY',
    'ru': 'RUB', 'ua': 'UAH', 'ae': 'AED', 'sa': 'SAR', 'com.sa': 'SAR',
    'il': 'ILS', 'co.il': 'ILS', 'za': 'ZAR', 'co.za': 'ZAR', 'th': 'THB',
    'co.th': 'THB', 'ph': 'PHP', 'com.ph': 'PHP', 'vn': 'VND', 'my': 'MYR',
    'com.my': 'MYR', 'id': 'IDR', 'co.id': 'IDR', 'ar': 'ARS', 'com.ar': 'ARS',
    'cl': 'CLP', 'co': 'COP', 'com.co': 'COP', 'pe': 'PEN', 'com.pe': 'PEN',
}

DOLLAR_LIKE = {'CAD', 'AUD', 'NZD', 'SGD', 'HKD', 'MXN', 'TWD', 'ARS', 'CLP', 'COP'}

# Longest / most specific symbols first.
SYMBOLS = [
    ('US$', 'USD'), ('CA$', 'CAD'), ('C$', 'CAD'), ('AU$', 'AUD'), ('A$', 'AUD'),
    ('NZ$', 'NZD'), ('HK$', 'HKD'), ('S$', 'SGD'), ('R$', 'BRL'), ('MX$', 'MXN'),
    ('NT$', 'TWD'), ('€', 'EUR'), ('£', 'GBP'), ('₹', 'INR'), ('₩', 'KRW'),
    ('₽', 'RUB'), ('₺', 'TRY'), ('₱', 'PHP'), ('฿', 'THB'), ('₫', 'VND'),
    ('₪', 'ILS'), ('zł', 'PLN'), ('Kč', 'CZK'), ('CHF', 'CHF'), ('RM', 'MYR'),
    ('Rp', 'IDR'), ('円', 'JPY'), ('元', 'CNY'), ('￥', '¥'), ('¥', '¥'),
    ('kr', 'kr'), ('$', '$'),
]

_SYM_RE = (
    r'(?:US\$|CA\$|C\$|AU\$|A\$|NZ\$|HK\$|S\$|R\$|MX\$|NT\$|\$|€|£|¥|￥|₹|₩|₽|₺|₱|฿|₫|₪'
    r'|zł|Kč|CHF|kr|円|USD|EUR|GBP|CAD|AUD|JPY)'
)
# Either grouped thousands (1,299.00 / 1.299,00 / 1 299,00) or plain digits with decimals.
_NUM_RE = r"\d{1,3}(?:[.,'   ]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?"
NUM_RE = re.compile(_NUM_RE)
MONEY_RE = re.compile(r'%s\s?(?:%s)|(?:%s)\s?%s' % (_SYM_RE, _NUM_RE, _NUM_RE, _SYM_RE))


def host_currency(host):
    if not host:
        return None
    known = vendor_for(host)
    if known:
        return known.currency
    parts = host.lower().strip('.').split('.')
    for n in (2, 1):
        if len(parts) > n:
            key = '.'.join(parts[-n:])
            if key in TLD_CURRENCY:
                return TLD_CURRENCY[key]
    return None


def locale_currency(path, lang=None):
    """Guess currency from locale hints such as /jp/ja/, /en-gb/ or <html lang="de-AT">."""
    for seg in (path or '').lower().split('/'):
        m = re.fullmatch(r'(?:[a-z]{2}[-_])?([a-z]{2})', seg)
        if m:
            region = 'co.uk' if m.group(1) == 'gb' else m.group(1)
            if region in TLD_CURRENCY and region not in ('co', 'is', 'id', 'in', 'my'):
                return TLD_CURRENCY[region]
    m = re.fullmatch(r'[a-z]{2}[-_]([a-z]{2})', (lang or '').strip().lower())
    if m:
        region = 'co.uk' if m.group(1) == 'gb' else m.group(1)
        return TLD_CURRENCY.get(region)
    return None


def normalize_code(code):
    if not code:
        return None
    code = str(code).strip().upper()
    if code == 'RMB':
        return 'CNY'
    return code if re.fullmatch(r'[A-Z]{3}', code) else None


def detect_currency(text, host=None):
    """Guess the ISO currency of a short price string like '€1.299,00' or 'CA$12'."""
    if not text:
        return None
    for m in re.finditer(r'(?<![A-Za-z])([A-Z]{3})(?![A-Za-z])', text):
        code = normalize_code(m.group(1))
        if code in ISO_CODES:
            return code
    hint = host_currency(host)
    for sym, code in SYMBOLS:
        if sym in text:
            if code == '$':
                return hint if hint in DOLLAR_LIKE else 'USD'
            if code == '¥':
                return 'CNY' if hint == 'CNY' else 'JPY'
            if code == 'kr':
                return hint if hint in ('SEK', 'NOK', 'DKK', 'ISK') else 'SEK'
            return code
    return None


def parse_amount(raw, structured=False):
    """Turn '1.299,00 €', '$1,299.99', 1299 or '1299.99' into a float.

    `structured` means the value came from machine-readable data (JSON-LD, meta
    tags), where '1.299' really means one-point-two-nine-nine.
    """
    if raw is None or isinstance(raw, bool):
        return None
    if isinstance(raw, (int, float)):
        return float(raw) if raw >= 0 else None
    s = str(raw).strip()
    if structured and re.fullmatch(r'\d+(?:\.\d+)?', s):
        return float(s)
    m = NUM_RE.search(s)
    if not m:
        return None
    s = re.sub(r"[\s'  ]", '', m.group(0))
    dot, comma = s.rfind('.'), s.rfind(',')
    if dot >= 0 and comma >= 0:
        s = s.replace('.', '').replace(',', '.') if comma > dot else s.replace(',', '')
    elif comma >= 0:
        tail = len(s) - comma - 1
        s = s.replace(',', '.') if s.count(',') == 1 and tail in (1, 2) else s.replace(',', '')
    elif dot >= 0:
        tail = len(s) - dot - 1
        if s.count('.') > 1 or (tail == 3 and not structured):
            s = s.replace('.', '')
    try:
        value = float(s)
    except ValueError:
        return None
    return value if value >= 0 else None


def money_from_text(text, host=None):
    """Find the first currency-tagged amount in free text. Returns (amount, currency)."""
    # Some stores split prices into pieces, e.g. "$ 182 . 34".
    text = re.sub(r'(\d)\s+([.,])\s*(\d)', r'\1\2\3', text or '')
    m = MONEY_RE.search(text)
    if not m:
        return None, None
    fragment = m.group(0)
    return parse_amount(fragment), detect_currency(fragment, host)

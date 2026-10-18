"""What we know about specific Japanese and Chinese stores.

access:
  open     the server can read product pages directly
  blocked  the store refuses automated requests; use the bookmarklet
  login    products are only shown to signed-in shoppers; use the bookmarklet
  masked   pages load, but prices are hidden from signed-out visitors
"""
import re


class Vendor:
    __slots__ = ('suffix', 'name', 'native', 'currency', 'country', 'access', 'title_junk')

    def __init__(self, suffix, name, native, currency, country, access='open', title_junk=()):
        self.suffix = suffix
        self.name = name
        self.native = native
        self.currency = currency
        self.country = country
        self.access = access
        self.title_junk = [re.compile(p) for p in title_junk]


VENDORS = [
    # Japan
    Vendor('biccamera.com', 'Bic Camera', 'ビックカメラ', 'JPY', 'JP', 'blocked', (r'^ビックカメラ\.com\s*[-–]\s*',)),
    Vendor('yodobashi.com', 'Yodobashi Camera', 'ヨドバシカメラ', 'JPY', 'JP', 'blocked',
           (r'^ヨドバシ\.com\s*[-–]\s*', r'\s*通販【[^】]*】\s*$')),
    Vendor('dlsite.com', 'DLsite', 'DLsite', 'JPY', 'JP', 'open', (r'\s*\|\s*DLsite.*$',)),
    Vendor('amazon.co.jp', 'Amazon Japan', 'Amazon.co.jp', 'JPY', 'JP', 'blocked'),
    Vendor('rakuten.co.jp', 'Rakuten', '楽天市場', 'JPY', 'JP', 'open', (r'^【楽天市場】\s*', r'\s*[：:]\s*[^：:]+$')),
    Vendor('shopping.yahoo.co.jp', 'Yahoo! Shopping', 'Yahoo!ショッピング', 'JPY', 'JP', 'open',
           (r'\s*[-–]\s*Yahoo!ショッピング.*$',)),
    Vendor('jp.mercari.com', 'Mercari', 'メルカリ', 'JPY', 'JP', 'blocked', (r'\s*(by|[-|])\s*メルカリ.*$',)),
    Vendor('suruga-ya.jp', 'Suruga-ya', '駿河屋', 'JPY', 'JP', 'blocked', (r'\s*[|｜]\s*.*駿河屋.*$',)),
    Vendor('mandarake.co.jp', 'Mandarake', 'まんだらけ', 'JPY', 'JP'),
    Vendor('toranoana.jp', 'Toranoana', 'とらのあな', 'JPY', 'JP'),
    Vendor('melonbooks.co.jp', 'Melonbooks', 'メロンブックス', 'JPY', 'JP', 'blocked'),
    Vendor('animate-onlineshop.jp', 'animate', 'アニメイト', 'JPY', 'JP', 'blocked'),
    Vendor('amiami.jp', 'AmiAmi', 'あみあみ', 'JPY', 'JP', 'blocked'),
    Vendor('amiami.com', 'AmiAmi', 'あみあみ', 'JPY', 'JP', 'blocked'),
    Vendor('1999.co.jp', 'Hobby Search', 'ホビーサーチ', 'JPY', 'JP'),
    Vendor('goodsmile.com', 'Good Smile Company', 'グッドスマイルカンパニー', 'JPY', 'JP'),
    Vendor('p-bandai.jp', 'Premium Bandai', 'プレミアムバンダイ', 'JPY', 'JP'),
    Vendor('booth.pm', 'BOOTH', 'BOOTH', 'JPY', 'JP'),
    Vendor('dmm.co.jp', 'DMM', 'DMM', 'JPY', 'JP'),
    Vendor('joshinweb.jp', 'Joshin', 'ジョーシン', 'JPY', 'JP'),
    Vendor('kojima.net', 'Kojima', 'コジマ', 'JPY', 'JP'),
    Vendor('edion.com', 'EDION', 'エディオン', 'JPY', 'JP'),
    Vendor('nojima.co.jp', 'Nojima', 'ノジマ', 'JPY', 'JP'),
    Vendor('kakaku.com', 'Kakaku.com', '価格.com', 'JPY', 'JP'),
    # China
    Vendor('taobao.com', 'Taobao', '淘宝', 'CNY', 'CN', 'login', (r'\s*[-–]\s*淘宝网?\s*$',)),
    Vendor('tmall.com', 'Tmall', '天猫', 'CNY', 'CN', 'login', (r'\s*[-–]\s*(tmall\.com)?天猫.*$',)),
    Vendor('tmall.hk', 'Tmall Global', '天猫国际', 'CNY', 'CN', 'login', (r'\s*[-–]\s*天猫.*$',)),
    Vendor('jd.com', 'JD.com', '京东', 'CNY', 'CN', 'masked', (r'【[^】]*】\s*[-–]\s*京东\s*$', r'\s*[-–]\s*京东\s*$')),
    Vendor('jd.hk', 'JD Worldwide', '京东国际', 'CNY', 'CN', 'masked', (r'\s*[-–]\s*京东.*$',)),
    Vendor('1688.com', '1688', '阿里巴巴1688', 'CNY', 'CN', 'login'),
    Vendor('yangkeduo.com', 'Pinduoduo', '拼多多', 'CNY', 'CN', 'login'),
    Vendor('pinduoduo.com', 'Pinduoduo', '拼多多', 'CNY', 'CN', 'login'),
    Vendor('goofish.com', 'Xianyu', '闲鱼', 'CNY', 'CN', 'login'),
    Vendor('dangdang.com', 'Dangdang', '当当', 'CNY', 'CN'),
    Vendor('suning.com', 'Suning', '苏宁易购', 'CNY', 'CN'),
    Vendor('vip.com', 'Vipshop', '唯品会', 'CNY', 'CN'),
    Vendor('weidian.com', 'Weidian', '微店', 'CNY', 'CN'),
]


def vendor_for(host):
    host = (host or '').lower()
    for v in VENDORS:
        if host == v.suffix or host.endswith('.' + v.suffix):
            return v
    return None


ACCESS_HELP = {
    'blocked': ("%s blocks automatic lookups. Open the product in your browser and click your "
                "Add to Wishlist bookmark, or type the price in."),
    'login': ("%s only shows products to signed-in shoppers. Open the product in your browser while "
              "signed in and click your Add to Wishlist bookmark, or type the price in."),
    'masked': ("%s hides prices from signed-out visitors%s. Click your Add to Wishlist bookmark while "
               "signed in, or type the price in."),
}


def access_help(vendor, masked_price=None):
    if vendor.access == 'masked':
        shown = ' (it shows ¥%s)' % masked_price if masked_price else ''
        return ACCESS_HELP['masked'] % (vendor.name, shown)
    return ACCESS_HELP.get(vendor.access, ACCESS_HELP['blocked']) % vendor.name

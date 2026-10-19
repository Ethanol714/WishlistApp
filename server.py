#!/usr/bin/env python3
"""Wishlist app server. Uses only the Python standard library.

    python3 server.py            # http://localhost:8080
    python3 server.py --open     # ...and open it in your browser
    PORT=9000 python3 server.py

Your list is stored in the per-user app folder (see default_data_dir), shared with the desktop app.
Set WISHLIST_DATA to use another folder.
"""
import json
import mimetypes
import secrets
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import uuid
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlencode, urlparse

from wishlist.rates import Rates
from wishlist.scraper import ScrapeError, check_url, extract, scrape
from wishlist.store import Store
from wishlist.vendors import VENDORS, vendor_for

mimetypes.add_type('font/woff2', '.woff2')

ROOT = os.path.dirname(os.path.abspath(__file__))
# Inside a packaged app (PyInstaller) the web files are unpacked to sys._MEIPASS.
RESOURCES = getattr(sys, '_MEIPASS', ROOT)
PUBLIC = os.path.join(RESOURCES, 'public')
EXTENSION_SRC = os.path.join(RESOURCES, 'extension')


def default_data_dir():
    """Per-user app data folder, shared by the desktop app and `python3 server.py`."""
    if sys.platform == 'darwin':
        base = os.path.expanduser('~/Library/Application Support')
    elif os.name == 'nt':
        base = os.environ.get('APPDATA') or os.path.expanduser('~')
    else:
        base = os.environ.get('XDG_DATA_HOME') or os.path.expanduser('~/.local/share')
    return os.path.join(base, 'Wishlist')


def migrate_legacy_data(data_dir):
    """Copy (never move) a list saved by earlier versions in the project's data/ folder."""
    legacy = os.path.join(ROOT, 'data')
    if os.path.exists(os.path.join(data_dir, 'wishlist.json')) or not os.path.isfile(os.path.join(legacy, 'wishlist.json')):
        return
    os.makedirs(data_dir, exist_ok=True)
    for name in ('wishlist.json', 'rates.json'):
        if os.path.isfile(os.path.join(legacy, name)):
            shutil.copy2(os.path.join(legacy, name), os.path.join(data_dir, name))


DATA = os.environ.get('WISHLIST_DATA') or default_data_dir()
if not os.environ.get('WISHLIST_DATA'):
    migrate_legacy_data(DATA)

store = Store(os.path.join(DATA, 'wishlist.json'))
rates = Rates(os.path.join(DATA, 'rates.json'))

PRIORITIES = ('high', 'medium', 'low')
MODES = ('domestic', 'import')
MAX_BODY = 20_000_000
LOCAL_HOSTS = ('localhost', '127.0.0.1', '[::1]')
HISTORY_LIMIT = 90


class BadRequest(Exception):
    pass


def _http_url(value, field, required=False):
    value = (value or '').strip()
    if not value:
        if required:
            raise BadRequest('%s is required' % field)
        return ''
    if urlparse(value).scheme not in ('http', 'https'):
        raise BadRequest('%s must start with http:// or https://' % field)
    return value


def _number(value, field):
    if value in (None, ''):
        return None
    try:
        n = float(value)
    except (TypeError, ValueError):
        raise BadRequest('%s must be a number' % field)
    if n < 0:
        raise BadRequest('%s cannot be negative' % field)
    return round(n, 2)


def clean_fields(body):
    """Validate the user-editable fields present in a request body."""
    out = {}
    if 'title' in body:
        out['title'] = str(body['title'] or '').strip()[:300] or 'Untitled item'
    if 'url' in body:
        out['url'] = _http_url(body['url'], 'Product link', required=True)
    if 'image' in body:
        out['image'] = _http_url(body['image'], 'Image link')
    if 'vendor' in body:
        out['vendor'] = str(body['vendor'] or '').strip()[:100]
    if 'price' in body:
        out['price'] = _number(body['price'], 'Price')
    if 'originalPrice' in body:
        out['originalPrice'] = _number(body['originalPrice'], 'Original price')
    if 'currency' in body:
        code = str(body['currency'] or 'USD').strip().upper()
        if not re.fullmatch(r'[A-Z]{3}', code):
            raise BadRequest('Currency must be a 3-letter code like USD or EUR')
        out['currency'] = code
    if 'qty' in body:
        try:
            out['qty'] = max(1, min(999, int(body['qty'])))
        except (TypeError, ValueError):
            raise BadRequest('Quantity must be a whole number')
    if 'category' in body:
        out['category'] = str(body['category'] or '').strip()[:60]
    if 'priority' in body:
        out['priority'] = body['priority'] if body['priority'] in PRIORITIES else 'medium'
    if 'include' in body:
        out['include'] = bool(body['include'])
    if 'notes' in body:
        out['notes'] = str(body['notes'] or '').strip()[:1000]
    if 'mode' in body:
        out['mode'] = body['mode'] if body['mode'] in MODES else 'domestic'
    if 'shipping' in body:
        out['shipping'] = _number(body['shipping'], 'Shipping')
    return out


def now_ms():
    return int(time.time() * 1000)


def new_item(fields):
    item = {
        'id': uuid.uuid4().hex[:12],
        'url': '',
        'title': 'Untitled item',
        'image': '',
        'vendor': '',
        'price': None,
        'originalPrice': None,
        'currency': 'USD',
        'addedPrice': None,
        'qty': 1,
        'category': '',
        'priority': 'medium',
        'include': True,
        'notes': '',
        'mode': 'domestic',
        'shipping': None,
        'country': None,
        'vendorNative': None,
        'addedAt': now_ms(),
        'checkedAt': None,
        'lastError': None,
        'history': [],
    }
    item.update(fields)
    item['addedPrice'] = item['price']
    if item['price'] is not None:
        item['history'] = [{'t': item['addedAt'], 'price': item['price'], 'currency': item['currency']}]
    return item


def apply_scrape(item, data):
    """Merge a fresh scrape into an existing item without wiping manual edits."""
    item['checkedAt'] = now_ms()
    item['lastError'] = data.get('error')
    if data.get('image') and not item.get('image'):
        item['image'] = data['image']
    for key in ('country', 'vendorNative'):
        if data.get(key) and not item.get(key):
            item[key] = data[key]
    if data.get('price') is None:
        return
    changed = data['price'] != item.get('price') or data['currency'] != item.get('currency')
    item['price'] = data['price']
    item['currency'] = data['currency']
    item['originalPrice'] = data.get('originalPrice')
    if item.get('addedPrice') is None:
        item['addedPrice'] = data['price']
    if changed or not item.get('history'):
        item.setdefault('history', []).append(
            {'t': item['checkedAt'], 'price': data['price'], 'currency': data['currency']})
        item['history'] = item['history'][-HISTORY_LIMIT:]


def reveal(path):
    """Show a folder in Finder / File Explorer."""
    if sys.platform == 'darwin':
        subprocess.Popen(['open', '-R', path])
    elif os.name == 'nt':
        subprocess.Popen(['explorer', '/select,', path])
    else:
        subprocess.Popen(['xdg-open', os.path.dirname(path)])


def open_in_chrome(url):
    """Open a URL (including chrome:// pages) in Google Chrome. Returns False if Chrome isn't found."""
    try:
        if sys.platform == 'darwin':
            return subprocess.run(['open', '-a', 'Google Chrome', url], capture_output=True).returncode == 0
        if os.name == 'nt':
            for base in (os.environ.get('PROGRAMFILES'), os.environ.get('PROGRAMFILES(X86)'), os.environ.get('LOCALAPPDATA')):
                exe = os.path.join(base or '', 'Google', 'Chrome', 'Application', 'chrome.exe')
                if base and os.path.isfile(exe):
                    subprocess.Popen([exe, url])
                    return True
            return False
        subprocess.Popen(['google-chrome', url])
        return True
    except OSError:
        return False


class Handler(BaseHTTPRequestHandler):
    server_version = 'Wishlist/1.0'

    # -- plumbing ----------------------------------------------------------
    def log_message(self, fmt, *args):
        if os.environ.get('WISHLIST_DEBUG'):
            super().log_message(fmt, *args)

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        # Lets the page tell whether the list changed since it last loaded it.
        self.send_header('X-Wishlist-Rev', str(store.revision()))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self):
        length = int(self.headers.get('Content-Length') or 0)
        if length > MAX_BODY:
            raise BadRequest('Request is too large')
        return self.rfile.read(length) if length else b''

    def read_json(self):
        # Requiring JSON forces a CORS preflight, so other websites can't call the API.
        if (self.headers.get('Content-Type') or '').split(';')[0].strip() != 'application/json':
            raise BadRequest('Content-Type must be application/json')
        body = self.read_body()
        if not body:
            return {}
        try:
            data = json.loads(body)
        except ValueError:
            raise BadRequest('Request body must be JSON')
        if not isinstance(data, dict):
            raise BadRequest('Request body must be a JSON object')
        return data

    def route(self, method):
        path = urlparse(self.path).path
        # Reject DNS-rebinding style requests that reach us under a foreign hostname.
        host = (self.headers.get('Host') or '').rsplit(':', 1)[0].lower()
        if host not in LOCAL_HOSTS:
            return self.send_json({'error': 'Forbidden host'}, 403)
        try:
            if not path.startswith('/api/'):
                if method == 'GET':
                    return self.serve_static(path)
                return self.send_json({'error': 'Not found'}, 404)
            for pattern, handlers in ROUTES:
                m = re.fullmatch(pattern, path)
                if m and method in handlers:
                    return handlers[method](self, *m.groups())
            self.send_json({'error': 'Not found'}, 404)
        except BadRequest as e:
            self.send_json({'error': str(e)}, 400)
        except ScrapeError as e:
            self.send_json({'error': str(e)}, 400)
        except Exception as e:  # keep the server alive, report the error
            sys.stderr.write('Error handling %s %s: %r\n' % (method, path, e))
            self.send_json({'error': 'Something went wrong: %s' % e}, 500)

    def do_GET(self):
        self.route('GET')

    def do_POST(self):
        self.route('POST')

    def do_PATCH(self):
        self.route('PATCH')

    def do_PUT(self):
        self.route('PUT')

    def do_DELETE(self):
        self.route('DELETE')

    def serve_static(self, path):
        rel = 'index.html' if path in ('', '/') else path.lstrip('/')
        full = os.path.normpath(os.path.join(PUBLIC, rel))
        if not full.startswith(PUBLIC + os.sep) or not os.path.isfile(full):
            return self.send_json({'error': 'Not found'}, 404)
        with open(full, 'rb') as f:
            body = f.read()
        ctype = mimetypes.guess_type(full)[0] or 'application/octet-stream'
        if ctype.startswith('text/') or ctype.endswith('javascript'):
            ctype += '; charset=utf-8'
        self.send_response(200)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(body)))
        # Font files never change (their names are fixed per version), so let the browser keep them.
        self.send_header('Cache-Control', 'max-age=31536000, immutable' if rel.startswith('fonts/') and rel.endswith('.woff2') else 'no-cache')
        self.end_headers()
        self.wfile.write(body)

    # -- API ---------------------------------------------------------------
    def list_items(self):
        self.send_json({'items': store.items(), 'rev': store.revision()})

    def add_item(self):
        body = self.read_json()
        url = _http_url(body.get('url'), 'Product link', required=True)
        data = scrape(url)
        fields = {k: data[k] for k in ('url', 'title', 'image', 'vendor', 'price', 'originalPrice', 'currency',
                                       'country', 'vendorNative')}
        fields['image'] = fields['image'] or ''
        fields.update(clean_fields({k: v for k, v in body.items() if k != 'url'}))
        item = new_item(fields)
        item['checkedAt'] = now_ms()
        item['lastError'] = data.get('error')
        self.send_json({'item': store.insert(item)}, 201)

    def add_manual_item(self):
        fields = clean_fields(self.read_json())
        if not fields.get('url'):
            raise BadRequest('Product link is required')
        host = urlparse(fields['url']).hostname or ''
        known = vendor_for(host)
        if known:
            fields.update(country=known.country, vendorNative=known.native)
            fields.setdefault('currency', known.currency)
        if not fields.get('vendor'):
            fields['vendor'] = known.name if known else re.sub(r'^www\d?\.', '', host)
        self.send_json({'item': store.insert(new_item(fields))}, 201)

    def scan_page(self):
        """The Chrome extension sends the page it's looking at; return what we can read, without saving."""
        body = self.read_json()
        store.mark_extension_seen(now_ms())
        url = _http_url(body.get('url'), 'Page link', required=True)
        data = extract(url, str(body.get('html') or ''), captured=True)
        existing = next((i for i in store.items() if i['url'] in (url, data['url'])), None)
        self.send_json({'product': data, 'existing': existing})

    def add_from_extension(self):
        """Add (or update, when the link is already on the list) an item the extension scanned."""
        body = self.read_json()
        fields = clean_fields(body)
        if not fields.get('url'):
            raise BadRequest('Product link is required')
        known = vendor_for(urlparse(fields['url']).hostname or '')
        if known:
            fields.update(country=known.country, vendorNative=known.native)
        existing = next((i for i in store.items() if i['url'] == fields['url']), None)
        if existing:
            def mutate(item):
                if fields.get('price') is not None and fields['price'] != item.get('price'):
                    item.setdefault('history', []).append(
                        {'t': now_ms(), 'price': fields['price'], 'currency': fields.get('currency', item['currency'])})
                    item['history'] = item['history'][-HISTORY_LIMIT:]
                item.update(fields)
                item['checkedAt'] = now_ms()
                item['lastError'] = None if item.get('price') is not None else item.get('lastError')
            return self.send_json({'item': store.update(existing['id'], mutate), 'updated': True})
        item = new_item(fields)
        item['checkedAt'] = now_ms()
        self.send_json({'item': store.insert(item), 'updated': False}, 201)

    def update_item(self, item_id):
        fields = clean_fields(self.read_json())

        def mutate(item):
            price_changed = 'price' in fields and fields['price'] != item.get('price')
            item.update(fields)
            if price_changed and fields['price'] is not None:
                item['lastError'] = None
                if item.get('addedPrice') is None:
                    item['addedPrice'] = fields['price']
                item.setdefault('history', []).append(
                    {'t': now_ms(), 'price': fields['price'], 'currency': item['currency']})
                item['history'] = item['history'][-HISTORY_LIMIT:]

        item = store.update(item_id, mutate)
        if item is None:
            return self.send_json({'error': 'Item not found'}, 404)
        self.send_json({'item': item})

    def delete_item(self, item_id):
        if not store.delete(item_id):
            return self.send_json({'error': 'Item not found'}, 404)
        self.send_json({'ok': True})

    def refresh_item(self, item_id):
        item = store.get(item_id)
        if item is None:
            return self.send_json({'error': 'Item not found'}, 404)
        data = scrape(item['url'])
        self.send_json({'item': store.update(item_id, lambda it: apply_scrape(it, data))})

    def capture(self):
        """Receives a product page from the bookmarklet (a form POST from the store's tab)."""
        form = parse_qs(self.read_body().decode('utf-8', 'replace'), max_num_fields=10)
        token = (form.get('token') or [''])[0]
        if not secrets.compare_digest(token, store.secret()):
            return self.redirect('/?' + urlencode({'error': 'This bookmark is out of date. Drag the new one from the app.'}))
        url = (form.get('url') or [''])[0]
        html = (form.get('html') or [''])[0]
        try:
            check_url(url)
        except ScrapeError as e:
            return self.redirect('/?' + urlencode({'error': str(e)}))
        data = extract(url, html, captured=True)
        existing = next((i for i in store.items() if i['url'] == data['url']), None)
        if existing:
            item = store.update(existing['id'], lambda it: apply_scrape(it, data))
        else:
            fields = {k: data[k] or '' for k in ('url', 'title', 'image', 'vendor', 'currency')}
            fields.update(price=data['price'], originalPrice=data['originalPrice'],
                          country=data['country'], vendorNative=data['vendorNative'])
            item = new_item(fields)
            item['checkedAt'] = now_ms()
            item['lastError'] = data.get('error')
            item = store.insert(item)
        self.redirect('/?' + urlencode({'added': item['id']}))

    def redirect(self, location):
        self.send_response(303)
        self.send_header('Location', location)
        self.send_header('Content-Length', '0')
        self.end_headers()

    def get_bookmarklet(self):
        self.send_json({'token': store.secret()})

    def list_vendors(self):
        self.send_json({'vendors': [
            {'name': v.name, 'native': v.native, 'country': v.country, 'currency': v.currency,
             'access': v.access, 'domain': v.suffix} for v in VENDORS]})

    def get_revision(self):
        self.send_json({'rev': store.revision()})

    def health(self):
        self.send_json({'app': 'wishlist', 'data': DATA, 'extensionSeen': store.extension_seen()})

    def extension_folder(self):
        """Copy the bundled Chrome extension next to the list and show it in Finder / File Explorer."""
        self.read_json()
        if not os.path.isdir(EXTENSION_SRC):
            raise BadRequest("This copy of Wishlist doesn't include the Chrome extension.")
        target = os.path.join(DATA, 'Chrome Extension')
        if os.path.isdir(target):
            shutil.rmtree(target)
        shutil.copytree(EXTENSION_SRC, target)
        reveal(target)
        self.send_json({'path': target})

    def open_chrome_extensions(self):
        self.read_json()
        if not open_in_chrome('chrome://extensions'):
            raise BadRequest("Couldn't find Google Chrome. Install Chrome, then try again.")
        self.send_json({'ok': True})

    def get_rates(self):
        data = rates.get()
        if data is None:
            return self.send_json({'error': 'Exchange rates are unavailable (are you offline?)'}, 503)
        self.send_json(data)

    def get_settings(self):
        self.send_json({'settings': store.settings()})

    def put_settings(self):
        body = self.read_json()
        settings = {}
        for key, value in body.items():
            if isinstance(value, (int, float, str, bool)) or value is None:
                settings[str(key)[:40]] = value
        self.send_json({'settings': store.set_settings(settings)})


ROUTES = [
    (r'/api/items', {'GET': Handler.list_items, 'POST': Handler.add_item}),
    (r'/api/items/manual', {'POST': Handler.add_manual_item}),
    (r'/api/items/from-extension', {'POST': Handler.add_from_extension}),
    (r'/api/scan', {'POST': Handler.scan_page}),
    (r'/api/items/([\w-]+)', {'PATCH': Handler.update_item, 'DELETE': Handler.delete_item}),
    (r'/api/items/([\w-]+)/refresh', {'POST': Handler.refresh_item}),
    (r'/api/capture', {'POST': Handler.capture}),
    (r'/api/bookmarklet', {'GET': Handler.get_bookmarklet}),
    (r'/api/rates', {'GET': Handler.get_rates}),
    (r'/api/vendors', {'GET': Handler.list_vendors}),
    (r'/api/health', {'GET': Handler.health}),
    (r'/api/revision', {'GET': Handler.get_revision}),
    (r'/api/extension/folder', {'POST': Handler.extension_folder}),
    (r'/api/extension/chrome', {'POST': Handler.open_chrome_extensions}),
    (r'/api/settings', {'GET': Handler.get_settings, 'PUT': Handler.put_settings}),
]


def upgrade_items():
    """Fill in store details for items saved before the store registry existed."""
    for item in store.items():
        host = (urlparse(item.get('url') or '').hostname or '').lower()
        known = vendor_for(host)
        if 'mode' in item and (not known or item.get('country')):
            continue

        def mutate(it):
            it.setdefault('mode', 'domestic')
            it.setdefault('shipping', None)
            if known:
                it['country'] = it.get('country') or known.country
                it['vendorNative'] = it.get('vendorNative') or known.native
                if not it.get('vendor') or it['vendor'] == re.sub(r'^www\d?\.', '', host):
                    it['vendor'] = known.name

        store.update(item['id'], mutate)


def main():
    upgrade_items()
    port = int(os.environ.get('PORT') or 8080)
    server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
    url = 'http://localhost:%d' % port
    print('Wishlist is running at %s  (Ctrl+C to stop)' % url, flush=True)
    if '--open' in sys.argv:
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')


if __name__ == '__main__':
    main()

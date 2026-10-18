#!/usr/bin/env python3
"""Wishlist app server. Uses only the Python standard library.

    python3 server.py            # http://localhost:8080
    python3 server.py --open     # ...and open it in your browser
    PORT=9000 python3 server.py
"""
import json
import mimetypes
import secrets
import os
import re
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

ROOT = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(ROOT, 'public')
DATA = os.path.join(ROOT, 'data')

store = Store(os.path.join(DATA, 'wishlist.json'))
rates = Rates(os.path.join(DATA, 'rates.json'))

PRIORITIES = ('high', 'medium', 'low')
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
        self.send_header('Cache-Control', 'no-cache')
        self.end_headers()
        self.wfile.write(body)

    # -- API ---------------------------------------------------------------
    def list_items(self):
        self.send_json({'items': store.items()})

    def add_item(self):
        body = self.read_json()
        url = _http_url(body.get('url'), 'Product link', required=True)
        data = scrape(url)
        fields = {k: data[k] for k in ('url', 'title', 'image', 'vendor', 'price', 'originalPrice', 'currency')}
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
        if not fields.get('vendor'):
            fields['vendor'] = re.sub(r'^www\d?\.', '', urlparse(fields['url']).hostname or '')
        self.send_json({'item': store.insert(new_item(fields))}, 201)

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
            fields.update(price=data['price'], originalPrice=data['originalPrice'])
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
    (r'/api/items/([\w-]+)', {'PATCH': Handler.update_item, 'DELETE': Handler.delete_item}),
    (r'/api/items/([\w-]+)/refresh', {'POST': Handler.refresh_item}),
    (r'/api/capture', {'POST': Handler.capture}),
    (r'/api/bookmarklet', {'GET': Handler.get_bookmarklet}),
    (r'/api/rates', {'GET': Handler.get_rates}),
    (r'/api/settings', {'GET': Handler.get_settings, 'PUT': Handler.put_settings}),
]


def main():
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

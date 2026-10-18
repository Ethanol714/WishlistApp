#!/usr/bin/env python3
"""Wishlist desktop app: the Wishlist server in a native window.

The window is WebKit on macOS and Edge WebView2 on Windows. While it is open the server keeps
listening on http://localhost:8080, so the Chrome extension and the bookmark button connect to it
exactly as they do with `python3 server.py`. Closing the window quits the app.

    python3 desktop.py           # run from source (needs: pip install pywebview)
    pyinstaller wishlist.spec    # build Wishlist.app / Wishlist.exe
"""
import json
import threading
import urllib.request
from http.server import ThreadingHTTPServer

import webview

import server

PORT = 8080  # the Chrome extension looks for the app here


def wishlist_already_running(port):
    try:
        with urllib.request.urlopen('http://127.0.0.1:%d/api/health' % port, timeout=1.5) as r:
            return json.load(r).get('app') == 'wishlist'
    except Exception:
        return False


def start_server():
    """Serve on port 8080, or on any free port if something else holds 8080."""
    for port in (PORT, 0):
        try:
            httpd = ThreadingHTTPServer(('127.0.0.1', port), server.Handler)
        except OSError:
            continue
        threading.Thread(target=httpd.serve_forever, daemon=True).start()
        return httpd.server_address[1]
    raise RuntimeError('Could not start the Wishlist server')


def main():
    if wishlist_already_running(PORT):
        port = PORT  # e.g. `python3 server.py` is already running: show that list
    else:
        server.upgrade_items()
        port = start_server()

    window = webview.create_window(
        'Wishlist', 'http://127.0.0.1:%d/' % port,
        width=1380, height=900, min_size=(400, 600), background_color='#EEF3FA')

    if port != PORT:
        message = ('Port %d is in use by another program, so the Wishlist Chrome extension '
                   "can't reach this window. Close that program and reopen Wishlist." % PORT)
        window.events.loaded += lambda: window.evaluate_js('toast(%s, "warn", 12000)' % json.dumps(message))

    webview.start()


if __name__ == '__main__':
    main()

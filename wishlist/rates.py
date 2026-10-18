"""Daily USD exchange rates, cached in memory and on disk."""
import json
import os
import threading
import time
import urllib.request
from datetime import datetime, timezone

PRIMARY = 'https://open.er-api.com/v6/latest/USD'
FALLBACK = 'https://api.frankfurter.app/latest?from=USD'
RETRY_AFTER_FAILURE = 300


class Rates:
    """Rates are 'units of currency per 1 USD'. USD value = amount / rates[currency]."""

    def __init__(self, cache_path):
        self.cache_path = cache_path
        self.lock = threading.Lock()
        self.data = self._load()
        self.retry_at = 0

    def _load(self):
        try:
            with open(self.cache_path) as f:
                return json.load(f)
        except (OSError, ValueError):
            return None

    def _save(self):
        os.makedirs(os.path.dirname(self.cache_path), exist_ok=True)
        tmp = self.cache_path + '.tmp'
        with open(tmp, 'w') as f:
            json.dump(self.data, f)
        os.replace(tmp, self.cache_path)

    def get(self):
        with self.lock:
            now = time.time()
            fresh = self.data and now < self.data.get('nextUpdate', 0)
            if not fresh and now >= self.retry_at:
                fetched = self._fetch()
                if fetched:
                    self.data = fetched
                    self._save()
                else:
                    self.retry_at = now + RETRY_AFTER_FAILURE
            if not self.data:
                return None
            out = dict(self.data)
            out['stale'] = now >= self.data.get('nextUpdate', 0) + 3600
            return out

    def _fetch(self):
        try:
            with urllib.request.urlopen(PRIMARY, timeout=10) as r:
                j = json.load(r)
            if j.get('result') == 'success':
                return {
                    'base': 'USD',
                    'rates': j['rates'],
                    'updated': j['time_last_update_unix'],
                    'nextUpdate': j['time_next_update_unix'],
                    'source': 'ExchangeRate-API',
                }
        except (OSError, ValueError, KeyError):
            pass
        try:
            with urllib.request.urlopen(FALLBACK, timeout=10) as r:
                j = json.load(r)
            rates = dict(j['rates'])
            rates['USD'] = 1.0
            day = datetime.strptime(j['date'], '%Y-%m-%d').replace(tzinfo=timezone.utc)
            return {
                'base': 'USD',
                'rates': rates,
                'updated': int(day.timestamp()),
                'nextUpdate': int(time.time()) + 6 * 3600,
                'source': 'Frankfurter (European Central Bank)',
            }
        except (OSError, ValueError, KeyError):
            return None

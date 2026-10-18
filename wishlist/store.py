"""JSON-file storage for wishlist items and planner settings."""
import copy
import json
import os
import secrets
import threading
import time


class Store:
    def __init__(self, path):
        self.path = path
        self.lock = threading.RLock()
        os.makedirs(os.path.dirname(path), exist_ok=True)
        self.db = self._load()

    def _load(self):
        try:
            with open(self.path) as f:
                db = json.load(f)
        except FileNotFoundError:
            db = {}
        except ValueError:
            # Keep the unreadable file around instead of silently losing it.
            os.replace(self.path, '%s.corrupt-%d' % (self.path, time.time()))
            db = {}
        db.setdefault('items', [])
        db.setdefault('settings', {})
        if not db.get('secret'):
            db['secret'] = secrets.token_urlsafe(18)
        return db

    def _save(self):
        tmp = self.path + '.tmp'
        with open(tmp, 'w') as f:
            json.dump(self.db, f, indent=2)
        os.replace(tmp, self.path)

    def items(self):
        with self.lock:
            return copy.deepcopy(self.db['items'])

    def get(self, item_id):
        with self.lock:
            for item in self.db['items']:
                if item['id'] == item_id:
                    return copy.deepcopy(item)
        return None

    def insert(self, item):
        with self.lock:
            self.db['items'].append(item)
            self._save()
            return copy.deepcopy(item)

    def update(self, item_id, mutate):
        with self.lock:
            for item in self.db['items']:
                if item['id'] == item_id:
                    mutate(item)
                    self._save()
                    return copy.deepcopy(item)
        return None

    def delete(self, item_id):
        with self.lock:
            before = len(self.db['items'])
            self.db['items'] = [i for i in self.db['items'] if i['id'] != item_id]
            if len(self.db['items']) != before:
                self._save()
                return True
        return False

    def settings(self):
        with self.lock:
            return copy.deepcopy(self.db['settings'])

    def set_settings(self, settings):
        with self.lock:
            self.db['settings'] = settings
            self._save()
            return copy.deepcopy(settings)

    def secret(self):
        with self.lock:
            if not os.path.exists(self.path):
                self._save()
            return self.db['secret']

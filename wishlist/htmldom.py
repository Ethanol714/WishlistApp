"""A tiny, forgiving HTML tree + CSS-ish selector, built on the standard library.

Supports selectors made of tag, #id, .class and [attr], [attr=value],
[attr*=value] parts, joined by descendant combinators (spaces) and commas.
"""
import re
from html.parser import HTMLParser

VOID = {
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link',
    'meta', 'param', 'source', 'track', 'wbr',
}


class Node:
    __slots__ = ('tag', 'attrs', 'children', 'parent')

    def __init__(self, tag, attrs=None, parent=None):
        self.tag = tag
        self.attrs = attrs or {}
        self.children = []
        self.parent = parent

    def get(self, key, default=None):
        return self.attrs.get(key, default)

    def classes(self):
        return (self.attrs.get('class') or '').split()

    def iter(self):
        """Yield every element below this one, in document order."""
        stack = list(reversed([c for c in self.children if isinstance(c, Node)]))
        while stack:
            node = stack.pop()
            yield node
            stack.extend(reversed([c for c in node.children if isinstance(c, Node)]))

    def raw_text(self):
        return ''.join(c for c in self.children if isinstance(c, str))

    def text(self):
        parts = []
        stack = [self]
        while stack:
            node = stack.pop()
            if isinstance(node, str):
                parts.append(node)
            elif node.tag not in ('script', 'style', 'noscript', 'template'):
                stack.extend(reversed(node.children))
        return ' '.join(' '.join(parts).split())

    def select(self, selector):
        return select(self, selector)

    def select_one(self, selector):
        found = select(self, selector, first=True)
        return found[0] if found else None


class _TreeBuilder(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.root = Node('#root')
        self.cur = self.root

    def handle_starttag(self, tag, attrs):
        node = Node(tag, {k: (v if v is not None else '') for k, v in attrs}, self.cur)
        self.cur.children.append(node)
        if tag not in VOID:
            self.cur = node

    def handle_startendtag(self, tag, attrs):
        node = Node(tag, {k: (v if v is not None else '') for k, v in attrs}, self.cur)
        self.cur.children.append(node)

    def handle_endtag(self, tag):
        node = self.cur
        while node is not self.root and node.tag != tag:
            node = node.parent
        if node is not self.root:
            self.cur = node.parent

    def handle_data(self, data):
        self.cur.children.append(data)


def parse_html(html):
    builder = _TreeBuilder()
    try:
        builder.feed(html or '')
        builder.close()
    except Exception:
        pass  # keep whatever was parsed before the error
    return builder.root


_TOKEN = re.compile(
    r'([a-zA-Z][a-zA-Z0-9-]*)'
    r'|#([\w-]+)'
    r'|\.([\w-]+)'
    r'|\[([\w:-]+)(?:([*^$]?=)"?([^"\]]*)"?)?\]'
)


def _compile(compound):
    tag, conds = None, []
    for m in _TOKEN.finditer(compound):
        if m.group(1):
            tag = m.group(1).lower()
        elif m.group(2):
            conds.append(('id', m.group(2)))
        elif m.group(3):
            conds.append(('class', m.group(3)))
        else:
            conds.append(('attr', m.group(4), m.group(5), m.group(6)))
    return tag, conds


def _matches(node, compiled):
    tag, conds = compiled
    if tag and node.tag != tag:
        return False
    for cond in conds:
        if cond[0] == 'id':
            if node.attrs.get('id') != cond[1]:
                return False
        elif cond[0] == 'class':
            if cond[1] not in node.classes():
                return False
        else:
            _, name, op, value = cond
            if name not in node.attrs:
                return False
            actual = node.attrs[name]
            if op == '=' and actual != value:
                return False
            if op == '*=' and value not in actual:
                return False
            if op == '^=' and not actual.startswith(value):
                return False
            if op == '$=' and not actual.endswith(value):
                return False
    return True


def _ancestors_match(node, chain):
    i = len(chain) - 1
    parent = node.parent
    while i >= 0 and parent is not None:
        if _matches(parent, chain[i]):
            i -= 1
        parent = parent.parent
    return i < 0


def select(root, selector, first=False):
    groups = [[_compile(p) for p in part.split()] for part in selector.split(',') if part.strip()]
    out = []
    for node in root.iter():
        for chain in groups:
            if _matches(node, chain[-1]) and _ancestors_match(node, chain[:-1]):
                out.append(node)
                if first:
                    return out
                break
    return out

from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit, unquote
import re

ROOT = Path(__file__).resolve().parents[1]
PAGES = sorted(ROOT.glob("*.html"))
EXPECTED = {"index.html", "about.html", "programs.html", "participation.html", "research.html", "news.html", "contact.html", "sitemap.html"}
errors = []

class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []
        self.ids = []
        self.main_count = 0
        self.h1_count = 0
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs: self.ids.append(attrs["id"])
        if tag == "main": self.main_count += 1
        if tag == "h1": self.h1_count += 1
        for attr in ("href", "src"):
            if attr in attrs: self.refs.append(attrs[attr])

docs = {}
for page in PAGES:
    source = page.read_text(encoding="utf-8")
    doc = Document()
    doc.feed(source)
    docs[page.name] = doc
    if doc.main_count != 1 or doc.h1_count != 1: errors.append(f"{page.name}: main/h1 count")
    if len(doc.ids) != len(set(doc.ids)): errors.append(f"{page.name}: duplicate IDs")
    if 'GTCC Institute for Well-Aging and Lifelong Health' not in source: errors.append(f"{page.name}: brand missing")
    if re.search(r'총회신학|대한예수교장로회|신학 공동체|hyts.sc.kr|\\ufffd', source): errors.append(f"{page.name}: legacy or encoding content")
    for link in doc.refs:
        url = urlsplit(link)
        if url.scheme or url.netloc: continue
        target = page.parent / unquote(url.path) if url.path else page
        if not target.is_file(): errors.append(f"{page.name}: missing {link}")
        elif url.fragment and target.suffix == ".html":
            parsed = Document()
            parsed.feed(target.read_text(encoding="utf-8"))
            if url.fragment not in parsed.ids: errors.append(f"{page.name}: missing anchor {link}")
if set(docs) != EXPECTED: errors.append("Unexpected page set")
if not EXPECTED.issubset({urlsplit(ref).path for ref in docs["sitemap.html"].refs}): errors.append("Incomplete sitemap")
for name in ("CNAME", ".openai/hosting.json"):
    if (ROOT / name).exists(): errors.append(f"Unexpected deployment configuration: {name}")
if errors:
    raise SystemExit("\n".join(errors))
print(f"PASS: {len(PAGES)} pages; internal links, assets, anchors, sitemap, branding and standalone configuration")

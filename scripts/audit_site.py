from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import json,re
ROOT=Path(__file__).resolve().parents[1]
class Page(HTMLParser):
    def __init__(self): super().__init__(); self.links=[]; self.text=[]; self.nav=False
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        if attrs.get("class")=="main-category-nav": self.nav=True
        for key in ("href","src"):
            if key in attrs: self.links.append(attrs[key])
    def handle_data(self,data): self.text.append(data)
errors=[]
pages=list(ROOT.glob("*.html"))+list((ROOT/"board_posts").rglob("*.html"))
expected=set(json.loads((ROOT/"content/site.json").read_text(encoding="utf-8"))["pages"])
if {p.relative_to(ROOT).as_posix() for p in pages}!=expected: errors.append("Unexpected or missing pages")
legacy=r"학교|대학|신학|입학|학위|학사|석사|박사|교수|총회|목회|장학|학생|졸업|등록금|성경|선교|예수|교회|모세|돌봄·건강관리 상담|이용 비용 안내"
for path in pages:
    text=path.read_text(encoding="utf-8"); doc=Page();doc.feed(text)
    if re.search(legacy,text): errors.append(f"Legacy content: {path.relative_to(ROOT)}")
    if not doc.nav: errors.append(f"Missing template navigation: {path.name}")
    for link in doc.links:
        url=urlsplit(link)
        if url.scheme or url.netloc or not url.path: continue
        target=ROOT/unquote(url.path).lstrip('/') if url.path.startswith('/') else path.parent/unquote(url.path)
        if not target.is_file(): errors.append(f"Broken link: {path.name}: {link}")
# Template layout remains unchanged; only approved hero image sources differ.
source=ROOT/".template-reference/css/style.css"
if source.exists():
    css=source.read_text(encoding="utf-8").replace("../assets/images/hero.png","../assets/images/hero-gerontology-academy.png").replace("../assets/images/study.png","../assets/images/hero-library-learning.png")
    if css!=(ROOT/"css/style.css").read_text(encoding="utf-8"): errors.append("Unexpected template stylesheet change")
for name in ("hero-gerontology-academy.png","hero-library-learning.png"):
    if not (ROOT/"assets/images"/name).exists(): errors.append("Missing care image")
for folder in ("content","board_data","js"):
    for path in (ROOT/folder).rglob("*"):
        if path.suffix in (".json",".md",".js") and re.search(legacy,path.read_text(encoding="utf-8")):
            errors.append(f"Legacy source content: {path.relative_to(ROOT)}")
if (ROOT/"CNAME").exists(): errors.append("Unexpected old domain")
if errors: raise SystemExit("\n".join(errors))
print(f"PASS: {len(pages)} research institute pages, template layout preserved, no obsolete copy, all local links valid.")

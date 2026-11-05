from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit,unquote
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/".template-reference"
BRAND="GTCC Institute for Well-Aging and Lifelong Health"
def brand(text):
    for old in ("대한예수교장로회(한영)총회신학학술연구원","대한예수교장로회(한영)<br>총회신학학술연구원","총회신학학술연구원","총회신학연구원"):
        text=text.replace(old,BRAND)
    return text.replace("<span>"+BRAND+"</span>\n                </div>","<span>General Trias College of Cavite</span>\n                </div>").replace("hyts_lang","gtcc_wellaging_lang")
class Links(HTMLParser):
    def __init__(self): super().__init__(); self.links=[]
    def handle_starttag(self,tag,attrs):
        for key,value in attrs:
            if key in ("href","src"): self.links.append(value)
errors=[]; count=0
pages=list(ROOT.glob("*.html"))+list((ROOT/"board_posts").rglob("*.html"))
for page in pages:
    doc=Links(); text=page.read_text(encoding="utf-8"); doc.feed(text)
    if "총회신학학술연구원" in text: errors.append(f"Old brand: {page.name}")
    for link in doc.links:
        url=urlsplit(link)
        if url.scheme or url.netloc or not url.path: continue
        target=ROOT/unquote(url.path).lstrip('/') if url.path.startswith('/') else page.parent/unquote(url.path)
        if not target.is_file(): errors.append(f"Missing local link: {page.relative_to(ROOT)}: {link}")
    if SOURCE.is_dir():
        original=SOURCE/page.relative_to(ROOT)
        expected=brand(original.read_text(encoding="utf-8")) if original.exists() else ''
        if page.parent != ROOT:
            expected=expected.replace('href="/', 'href="../../')
        if not original.exists() or expected.strip()!=text.strip():
            errors.append(f"Unexpected template difference: {page.relative_to(ROOT)}")
    count+=1
if SOURCE.is_dir():
    if (ROOT/"css/style.css").read_bytes()!=(SOURCE/"css/style.css").read_bytes(): errors.append("Original stylesheet changed")
    if len(pages)!=len(list(SOURCE.glob("*.html"))+list((SOURCE/"board_posts").rglob("*.html"))): errors.append("Page count changed")
if (ROOT/"CNAME").exists(): errors.append("Original CNAME copied")
if errors: raise SystemExit("\n".join(errors))
print(f"PASS: {count} original pages, original CSS, all local links, images and embeds; only branding changed.")

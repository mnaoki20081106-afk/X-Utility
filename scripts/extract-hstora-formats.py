"""Extract public delivery format declarations from cached HStora HTML.
Fetch category pages and all their product links with curl first; pass the cache folder.
Only format declarations and public product metadata are retained, never delivered accounts.
"""
import html, json, re, sys, unicodedata
from pathlib import Path
from html.parser import HTMLParser

class Product(HTMLParser):
    def __init__(self):
        super().__init__(); self.depth=0; self.text=[]; self.script=False; self.ld=[]; self.current=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='div':
            if self.depth:self.depth+=1
            elif 'product-description-content' in a.get('class',''):self.depth=1
        if tag=='script' and a.get('type')=='application/ld+json':self.script=True;self.current=[]
        if self.depth and tag in ['br','p','li']:self.text.append('\n')
    def handle_endtag(self,tag):
        if tag=='div' and self.depth:self.depth-=1
        if tag=='script' and self.script:
            try:self.ld.append(json.loads(''.join(self.current)))
            except ValueError:pass
            self.script=False
    def handle_data(self,data):
        if self.depth:self.text.append(data)
        if self.script:self.current.append(data)

records=[]
for f in sorted(Path(sys.argv[1]).glob('*product*html')):
    p=Product();p.feed(f.read_text())
    product=next((x for x in p.ld if x.get('@type')=='Product'),{})
    if not product:continue
    text=unicodedata.normalize('NFKC',''.join(p.text))
    # Declarations can be inline prose or their own line. Stop at punctuation,
    # URLs, emoji, or prose; retain separator order, including nested mail fields.
    pattern=r'(?i)(?:format(?:\s+of\s+accounts)?|accounts?\s+format|格式|формат)[\s:：]*([^\n]+)'
    declarations=[]
    for m in re.finditer(pattern,text):
        tail=m.group(1)
        # Locate a sequence beginning with an account field and containing separators.
        seq=re.search(r'(?i)(?:username|login|user|email|mail|auth[_ ]?token|token|password)[a-zA-Z0-9_ :|;\-\t+/()]*',tail)
        if seq and re.search(r':|\||;|-{2,}',seq.group()):
            declarations.append(seq.group().strip())
    # Some listings label it "Account data" or only show the raw sequence.
    for m in re.finditer(r'(?i)\b(?:login|username|user)\s*(?::|\||-{2,})\s*(?:password|pass|pwd)[a-zA-Z0-9_ :|;\-\t+/()]*',text):
        value=m.group().strip()
        if value not in declarations:declarations.append(value)
    records.append({'id':str(product.get('sku','')),'url':product.get('url',''),'title':product.get('name',''),'seller':product.get('offers',{}).get('seller',{}).get('name',''),'declarations':declarations})
Path(sys.argv[2] if len(sys.argv)>2 else '/tmp/hstora-declarations.json').write_text(json.dumps(records,ensure_ascii=False,indent=2))
print('products',len(records),'with declarations',sum(bool(r['declarations']) for r in records))
for r in records:
    if r['declarations']:print(r['id'],r['seller'],repr(r['declarations']))

import re,html,json,concurrent.futures,pathlib,subprocess,sys
root=pathlib.Path(sys.argv[1]);root.mkdir(parents=True,exist_ok=True)
def fetch(url):
 name=re.sub(r'[^a-zA-Z0-9]','_',url)+'.html';p=root/name
 if p.exists():return p.read_text()
 for i in range(3):
  try:
   r=subprocess.run(['curl','-fsSL','--max-time','25',url],capture_output=True)
   if r.returncode:raise RuntimeError('fetch failed')
   s=r.stdout.decode()
   p.write_text(s);return s
  except Exception as e:
   if i==2:return ''
first=fetch('https://hstora.com/en/category/twitter')
if not first:raise SystemExit('Failed to retrieve first category page')
last=max([1]+[int(n) for n in re.findall(r'page=(\d+)',first)])
urls=['https://hstora.com/en/category/twitter?sort=popular&min_price=0&max_price=0&page='+str(i) for i in range(1,last+1)]
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex: pages=list(ex.map(fetch,urls))
products=sorted(set(html.unescape(u) for s in pages for u in re.findall(r'href="(https://hstora.com/en/product/[^"#?]+)',s)))
print('category pages',sum(bool(s) for s in pages),'products',len(products),flush=True)
with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex: descriptions=list(ex.map(fetch,products))
records=[]
for url,s in zip(products,descriptions):
 text=html.unescape(re.sub('<[^>]*>','\n',re.sub(r'<(script|style)\b.*?</\1>','',s,flags=re.S)))
 lines=[re.sub(r'\s+',' ',l).strip() for l in text.splitlines() if l.strip()]
 hits=[]
 for i,l in enumerate(lines):
  if re.search(r'format|login:|username:|user:pass|格式|формат',l,re.I):hits.append(' '.join(lines[max(0,i-1):i+4]))
 records.append({'url':url,'ok':bool(s),'formatExcerpts':hits})
(root/'retrieval-status.json').write_text(json.dumps({'pages':len(pages),'failedPages':[u for u,s in zip(urls,pages) if not s],'products':records},ensure_ascii=False,indent=2))
print('retrieved',sum(bool(s) for s in descriptions),'format listings',sum(bool(r['formatExcerpts']) for r in records),flush=True)

if any(not s for s in pages+descriptions):raise SystemExit('Some pages failed; review retrieval-status.json before updating the catalogue')

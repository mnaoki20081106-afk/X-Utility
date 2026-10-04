"""Snapshot public Twitter/X listings and their original English descriptions.
Usage: python scripts/crawl-hstockplus.py /path/to/scratch-cache
No account, authentication, purchase, or delivery credentials are accessed.
"""
import concurrent.futures, json, pathlib, subprocess, sys
ROOT=pathlib.Path(sys.argv[1]);ROOT.mkdir(parents=True,exist_ok=True)
def fetch(url,path):
 if path.exists():return path.read_text()
 for attempt in range(3):
  r=subprocess.run(['curl','-fsSL','--max-time','25',url],capture_output=True)
  if r.returncode==0:
   text=r.stdout.decode();path.write_text(text);return text
 raise RuntimeError(url)
def category(n):
 s=fetch('https://api.hstockplus.com/api/products/rsc_products?category=accounts&subcategory=twitter-x-accounts&status=approved&limit=30&page='+str(n)+'&sortBy=recommended&related_tags=true',ROOT/f'listing-{n}.json')
 data=json.loads(s)
 return data['products'],data['pagination']
listing,pagination=category(1);pages=pagination['pages']
products={};page_counts={};failures=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
 futures={pool.submit(category,n):n for n in range(1,pages+1)}
 for f in concurrent.futures.as_completed(futures):
  n=futures[f]
  try:
   listing,meta=f.result();page_counts[str(n)]={'listed':len(listing),'pagination':meta}
   for p in listing:products[p['_id']]=p
  except Exception as e:failures.append({'page':n,'error':str(e)})
print(json.dumps({'pages':len(page_counts),'products':len(products),'shops':len(set(p['supplierId']['_id'] for p in products.values()))}),flush=True)
(ROOT/'category-index.json').write_text(json.dumps({'pages':page_counts,'products':list(products.values()),'failures':failures},ensure_ascii=False,indent=2))
def detail(p):
 id=p['_id'];dest=ROOT/f'product-{id}.json'
 if dest.exists():return json.loads(dest.read_text())
 s=fetch('https://api.hstockplus.com/api/public/products/'+id,ROOT/f'public-product-{id}.json')
 record=json.loads(s);dest.write_text(json.dumps(record,ensure_ascii=False,indent=2));return record
records=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
 futures={pool.submit(detail,p):p for p in products.values()}
 for f in concurrent.futures.as_completed(futures):
  p=futures[f]
  try:records.append(f.result())
  except Exception as e:failures.append({'product':p['_id'],'error':str(e)})
  if (len(records)+len(failures))%50==0:print(json.dumps({'details':len(records),'failures':len(failures)}),flush=True)
records.sort(key=lambda p:p['_id'])
(ROOT/'snapshot.json').write_text(json.dumps({'checkedAt':'2026-10-04','pages':page_counts,'products':records,'failures':failures},ensure_ascii=False,indent=2))
print(json.dumps({'complete':len(records),'shops':len(set(p['supplierId']['_id'] for p in records)),'failures':failures}),flush=True)
if failures:sys.exit(1)

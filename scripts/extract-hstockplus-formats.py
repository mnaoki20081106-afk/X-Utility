"""Extract public delivery declarations for manual review; does not guess schemas."""
import json,re,html,pathlib,sys
snap=json.load(open(sys.argv[1]));out=[]
for p in snap['products']:
 text=html.unescape(re.sub(r'<[^>]+>','\n',p.get('description','')))
 for v in p.get('subproducts',[]):text+='\n'+html.unescape(re.sub(r'<[^>]+>','\n',v.get('shortDescription','') or ''))
 text=re.sub(r'\n\s*([|:;—–-]+)\s*\n',r'\1',text)
 lines=[re.sub(r'\s+',' ',x).strip() for x in text.splitlines() if x.strip()]
 declarations=[]
 for line in lines:
  line=re.sub(r'[\U0001F000-\U0001FFFF\u2600-\u27ff\ufe0f\u200d]','',line).replace('**','').replace('`','')
  for segment in re.split(r'\s+OR\s*',line,flags=re.I):
   matches=list(re.finditer(r'(?<![\w])(?:Twitter (?:Email|mail)|username|login(?:\s*\((?:e-mail|Email)\))?|login_twitter|xusername|profile|account|user|log|id|email)\s*[-—–:|;,]+\s*(?:Twitter )?(?:password|pass|pwd|email password|pas_twitter|xpassword)',segment,re.I))
   for m in matches[:1]:
    chain=segment[m.start():].strip(' •🧾')
    chain=re.split(r'\.\s|\.\.\.|\s(?:To |The |20[0-9]{2}(?:-[0-9]{4})? |✔|💡|— )',chain)[0].strip().rstrip('.')
    declarations.append(chain)
 out.append({'id':'hstockplus:'+p['_id'],'aliases':[p['_id'],str(p.get('friendlyId',''))],'title':p['name'],'seller':p['supplierId']['name'].strip(),'url':'https://hstockplus.com/products/'+p['_id'],'declarations':list(dict.fromkeys(declarations)),'formats':[]})
pathlib.Path(sys.argv[2]).write_text(json.dumps(out,ensure_ascii=False,indent=2))
print(json.dumps({'products':len(out),'withDeclarations':sum(bool(x['declarations']) for x in out),'unique':len(set(d for x in out for d in x['declarations']))}))

import fs from 'node:fs';
import {build} from 'esbuild';
const bundle=await build({entryPoints:['src/account-format.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {templateFields}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const rows=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const rejected=new Map();
const overrides={
 'hstockplus:6a07f29e82fb9a8722101858':['USERNAME|PASS|2FA|TINYHOST EMAIL|BACKUPCODE|COOKIES|Registration Date','Username|PASS|2FA|HOTMAIL|PASSMAIL|REFRESH_TOKEN|CLIENT_ID|BACKUPCODE|COOKIES|Registration Date'],
 'hstockplus:6a8d32143c67e807161ba4dc':['Email|XPassword|TwitterLogin|Followers|CookiesJson'],
};
for(const row of rows){
 for(const declaration of row.declarations){
  let format=declaration.normalize('NFKC').replace(/login\s*\(e-?mail\)\s*:\s*password/gi,'Email:XPassword').replace(/Cookies \(auth_token, ct0\)/gi,'Cookies').replace(/Cookies auth_token ct0/gi,'Cookies').replace(/EmailAccessInfo \(Email access instructions\):[\s\S]*$/i,'EmailAccessInfo').replace(/ Warranty Policy:[\s\S]*$/i,'').replace(/ \(Use 2FA to log in[\s\S]*$/i,'').replace(/JSON cookie \( contain auth token \+ ct0 \)/gi,'Cookies').replace(/Email \(Outlook\/Hotmail\)/gi,'Email').replace(/email password \(or none\)/gi,'EmailPassword').replace(/--- How to use AUTH_TOKEN:[\s\S]*$/i,'').replace(/ \(for decode use 2fa.Live\)$/i,'').replace(/; Email Address:[\s\S]*$/i,'').split('。')[0].replace(/\s*([-:|;]+)\s*/g,'$1').replace(/\be-mail\b/gi,'email').replace(/login from email address/gi,'Email').replace(/password from email(?: address| password)?/gi,'EmailPassword').replace(/\s+Mail access link:[\s\S]*$/i,'').replace(/\s+100% Replacement[\s\S]*$/i,'').replace(/✅[\s\S]*$/,'').replace(/ — just copy and use$/,'').replace(/ \(may differ slightly[\s\S]*$/,'').replace(/ \(sometimes with ct0\)$/i,'').replace(/[; ]*[🔒🔑]+$/u,'').trim();
  try{
   const variants=/phone\[(?:or )?email\]/i.test(format)?[format.replace(/phone\[(?:or )?email\]/i,'Phone'),format.replace(/phone\[(?:or )?email\]/i,'Email')]:[format];
   for(const variant of variants){templateFields(variant);row.formats.push(variant);}
  }catch{const ids=rejected.get(declaration)??[];ids.push(row.id);rejected.set(declaration,ids);}
 }
 row.formats=[...new Set(overrides[row.id]??row.formats)];
 for(const format of row.formats)templateFields(format);
}
const coverage={checkedAt:'2026-10-04',products:rows.length,shops:new Set(rows.map(x=>x.seller)).size,withFormats:rows.filter(x=>x.formats.length).length,uniqueFormats:new Set(rows.flatMap(x=>x.formats)).size,categoryPages:36,shopsWithFormats:new Set(rows.filter(x=>x.formats.length).map(x=>x.seller)).size,distinctLayouts:new Set(rows.flatMap(x=>x.formats).map(f=>JSON.stringify(templateFields(f)))).size};
coverage.summary=`2026年10月4日確認: hStockPlus Twitter/Xカテゴリ ${coverage.products}商品・${coverage.shops}ショップを調査。形式を確認できた${coverage.withFormats}商品の表記を登録。未記載・曖昧な商品は自動確定できません。`;
fs.writeFileSync('src/generated/hstockplus-formats.ts','import type { FormatSource } from "../account-format";\nexport const FORMAT_CATALOG: FormatSource[] = '+JSON.stringify(rows,null,2)+';\nexport const FORMAT_COVERAGE = '+JSON.stringify(coverage,null,2)+';\n');
fs.writeFileSync('/tmp/hstock-rejected.json',JSON.stringify([...rejected],null,2));
const md=(v)=>String(v).replaceAll('|','\\|').replaceAll('\n',' ');
const byShop=new Map();for(const r of rows){const group=byShop.get(r.seller)??[];group.push(r);byShop.set(r.seller,group);}
let doc='# hStockPlus Twitter/X アカウント形式調査\n\n'+coverage.summary+'\n\n対象は公開Twitter/Xカテゴリの一覧API全36ページです。在庫ありの画面より範囲を広げ、売り切れを含む1,053商品・102ショップを確認。全商品の説明取得に成功し、購入や認証情報の取得は行っていません。取得日以降の新規出品・変更は含みません。\n\n47ショップ・516商品に登録形式があります。異なる表記299件を保持し、項目順・区切り文字が異なる構造は139種類です。残る55ショップは公開説明から確定できる形式がありません。商品ごとの登録有無は以下の一覧に記録しています。\n\n元の英語説明を使用します。日本語自動翻訳でハイフンの本数が変わった例があり、翻訳の区切り文字を原文へ勝手に置換しません。メール2FAとXの2FA、OAuth Tokenとauth_tokenなどの区別を保持します。意味が不明なID_2FA_codeは原文項目として表示し、Xの認証コード生成に流用しません。区切り文字・項目数・項目名に欠落がある宣言は推測で補いません。\n\n商品URL（日本語URLも可）・商品ID・ショップ名で絞り込めます。ショップ内に複数形式がある場合は候補を残します。数値IDがサイト間で重複する場合は商品URLを求めます。購入元未指定の一致は公開形式との一致を意味し、認証情報の有効性の保証ではありません。\n\n## 更新手順\n\n```bash\npython scripts/crawl-hstockplus.py /tmp/hstockplus-cache\npython scripts/extract-hstockplus-formats.py /tmp/hstockplus-cache/snapshot.json /tmp/hstockplus-declarations.json\n# 全ての新規宣言と未抽出商品を確認し、手動補正を更新してから生成\nnode scripts/build-hstockplus-catalog.mjs /tmp/hstockplus-declarations.json\nnpm run typecheck\nnpm test\nnpx wrangler deploy --dry-run\n```\n\n一覧は初期HTMLにページ番号を付けるだけでは先頭ページが返るため、サイト自身が使用する公開 products/rsc_products APIを使用します。全ページの商品IDを重複排除し、公開 public/products/:id の説明を取得します。\n\n## ショップ別対応\n\n| ショップ | 調査商品 | 形式登録商品 |\n| --- | ---: | ---: |\n';
for(const [shop,group]of [...byShop].sort((a,b)=>a[0].localeCompare(b[0])))doc+='| '+md(shop)+' | '+group.length+' | '+group.filter(x=>x.formats.length).length+' |\n';
doc+='\n## 商品別対応\n\n| 商品 | ショップ | 状態 |\n| --- | --- | --- |\n';for(const r of rows)doc+='| ['+md(r.aliases[1]||r.aliases[0])+']('+r.url+') | '+md(r.seller)+' | '+(r.formats.length?'登録済み':'未記載・未確定')+' |\n';
fs.writeFileSync('docs/hstockplus-format-coverage.md',doc);
console.log(coverage);console.log('Rejected unique declarations:',rejected.size);

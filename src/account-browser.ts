import { LoginTutorial } from "./login-tutorial";
import { parseAccount, FIELD_LABELS, type AccountField, type ParsedAccount } from "./account-format";
import { FORMAT_CATALOG, FORMAT_COVERAGE } from "./format-catalog";

const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const account=el<HTMLTextAreaElement>("account"), product=el<HTMLSelectElement>("product");
const template=el<HTMLInputElement>("template"), separator=el<HTMLSelectElement>("separator");
let parsed: ParsedAccount | null = null;
let activeFields: AccountField[]=[];
const tutorial=new LoginTutorial(copy);
el("tutorial-show").addEventListener("click",()=>tutorial.open(activeFields));
function productOptions(filter="") {
  const previous=product.value;
  product.replaceChildren(new Option("自動判別", ""));
  const query=filter.trim().toLowerCase();
  for (const source of FORMAT_CATALOG) {
    if (!query || [source.id,...(source.aliases??[]),source.title,source.seller,source.url].some(v=>v.toLowerCase().includes(query))) {
      product.add(new Option(source.seller+" / #"+source.id+" / "+source.title,source.id));
    }
  }
  if (previous && [...product.options].some(o=>o.value===previous)) product.value=previous;
  else if (query && product.options.length===2) product.selectedIndex=1;
  sourceInfo();
}
function sourceInfo() {
  const source=FORMAT_CATALOG.find(s=>s.id===product.value);
  el("source-info").textContent=source ? (source.formats.length?"登録Format:\n"+source.formats.join("\n"):"この商品には確定できるFormat表記がありません。商品説明のFormatを入力してください。") : "区切り文字・項目数・値の形を組み合わせて判別します。";
}
async function copy(value: string, label: string) {
  el("status").textContent="";
  if (!value) {el("status").textContent="この項目は空欄です";return;}
  try {
    await navigator.clipboard.writeText(value);
    el("status").textContent=label+"をコピーしました";
  } catch {
    // Retain the exact value for older/in-app browsers. No network fallback.
    const field=document.createElement("textarea");field.value=value;field.style.position="fixed";field.style.top="0";field.style.opacity="0";
    document.body.append(field);field.select();field.setSelectionRange(0,value.length);
    let ok=false;
    try {ok=typeof document.execCommand === "function" && document.execCommand("copy");} catch {ok=false;} finally {field.remove();}
    el("status").textContent=ok?label+"をコピーしました":"コピーできませんでした。値を長押ししてコピーしてください。";
  }
}
function fieldsView(fields: AccountField[]) {
  tutorial.close();activeFields=fields;
  el("fields").replaceChildren();
  fields.forEach((field,i)=>{
    const row=document.createElement("div");row.className="field";
    const selector=document.createElement("select");selector.setAttribute("aria-label",`項目${i+1}の表示名`);
    for (const [key,label] of Object.entries(FIELD_LABELS)) selector.add(new Option(label,key));
    selector.value=field.key;
    const button=document.createElement("button");button.type="button";button.textContent="コピー";button.disabled=!field.value;
    button.setAttribute("aria-label",field.label+"をコピー");
    const input=document.createElement("input");input.readOnly=true;input.value=field.value;input.autocomplete="off";input.spellcheck=false;
    input.setAttribute("aria-label",field.label);input.addEventListener("focus",()=>input.select());
    selector.addEventListener("change",()=>{tutorial.close();field.key=selector.value;field.label=FIELD_LABELS[field.key]!;button.setAttribute("aria-label",field.label+"をコピー");input.setAttribute("aria-label",field.label);});
    button.addEventListener("click",()=>void copy(field.value,FIELD_LABELS[selector.value]!));
    row.append(selector,button,input);
    if (field.confidence!=="format") {const note=document.createElement("small");note.textContent=field.confidence==="candidate"?"値の形による候補・要確認":"未判別・項目名を選択してください";row.append(note);}
    el("fields").append(row);
  });
}
function sourcesView(ids: string[]) {
  el("sources").replaceChildren();
  const sellers=[...new Set(ids.map(id=>FORMAT_CATALOG.find(s=>s.id===id)?.seller).filter(Boolean))];
  el("sources").textContent=sellers.length?"形式の掲載ショップ: "+sellers.join(" / "):"";
}
function reset() {
  tutorial.close();activeFields=[];
  account.value="";template.value="";parsed=null;
  el("fields").replaceChildren();el("sources").replaceChildren();el("candidate").replaceChildren();
  el("results").hidden=true;el("error").textContent="";el("status").textContent="";el("warning").textContent="";
}
el("parse").addEventListener("click",()=>{
  tutorial.close();activeFields=[];
  el("error").textContent="";el("status").textContent="";
  try {
    parsed=parseAccount(account.value,FORMAT_CATALOG,{productId:product.value,format:template.value,separator:separator.value});
    el("warning").textContent=parsed.warnings.join("\n")+"\n検出した区切り: "+(parsed.separators.map(s=>s==="\t"?"タブ":s).join(" / ")||"なし");
    const select=el<HTMLSelectElement>("candidate");select.replaceChildren(new Option("候補を選択してください（未確定）",""));
    parsed.candidates.forEach((c,i)=>select.add(new Option(c.format,String(i))));
    select.hidden=parsed.candidates.length<2;el("candidate-label").hidden=select.hidden;
    fieldsView(parsed.fields);sourcesView(parsed.candidates.length===1?parsed.candidates[0]!.sources:[]);
    el("results").hidden=false;
  } catch (e) {parsed=null;el("results").hidden=true;el("fields").replaceChildren();el("error").textContent=e instanceof Error?e.message:"判別できませんでした";}
});
el<HTMLSelectElement>("candidate").addEventListener("change",event=>{
  const index=(event.target as HTMLSelectElement).value;
  if (!parsed)return;
  if (index==="") {fieldsView(parsed.fields);sourcesView([]);return;}
  const candidate=parsed.candidates[Number(index)];
  if (candidate) {fieldsView(candidate.fields);sourcesView(candidate.sources);el("status").textContent="形式の候補を選択しました。購入元の説明と一致することを確認してください。";}
});
el("clear").addEventListener("click",reset);
el<HTMLInputElement>("product-filter").addEventListener("input",e=>productOptions((e.target as HTMLInputElement).value));
product.addEventListener("change",sourceInfo);
window.addEventListener("pagehide",reset);
productOptions();
el("coverage").textContent=FORMAT_COVERAGE.summary;

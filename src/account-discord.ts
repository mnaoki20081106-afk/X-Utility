import { parseAccount, FIELD_LABELS, type AccountField } from './account-format';
import { FORMAT_CATALOG } from './generated/hstora-formats';
import { generateTotp } from './totp';

export const ACCOUNT_OPEN = 'xutil:account:open';
const PREFIX='xutil:account:';
type Env={XUTILITY_BRIDGE_SECRET:string};
type Embed={title?:string;description?:string;fields?:{name:string;value:string;inline?:boolean}[];color?:number;footer?:{text:string}};
const block=(value:string)=>'```\n'+value+'\n```';
const tapValue=(value:string)=>value && !value.includes('`')?'**`'+value+'`**':block(value);
function readValue(value:string):string {
 if(value.startsWith('**`') && value.endsWith('`**'))return value.slice(3,-3);
 return unblock(value);
}
function unblock(value:string):string {
 if(!value.startsWith('```\n') || !value.endsWith('\n```'))throw new Error('INVALID_STATE');
 return value.slice(4,-4);
}
const row=(...components:unknown[])=>({type:1,components});
const button=(label:string,custom_id:string,style=2)=>({type:2,style,label,custom_id});
const input=(id:string,label:string,value='',required=false,style=1,max_length=4000)=>row({type:4,custom_id:id,label,style,required,max_length,...(value?{value}: {})});
const modal=(custom_id:string,title:string,components:unknown[])=>({type:9,data:{custom_id,title,components}});
const privateMessage=(content:string)=>({type:4,data:{flags:64,content,allowed_mentions:{parse:[]}}});
function value(interaction:any,id:string):string {
 for(const r of interaction.data?.components??[])for(const c of r.components??[])if(c.custom_id===id)return String(c.value??'');
 return '';
}
function actor(interaction:any):string {return String(interaction.member?.user?.id??interaction.user?.id??'');}
function form(format='',tutorial=false) {
 return modal(PREFIX+(tutorial?'submit-tutorial':'submit'),'X アカウント形式判別',[
  input('account','納品文字列（1アカウント分）','',true,2),
  input('format','購入元のFormat（任意）',format,false,1,500),
  input('product','購入元の商品ID / URL（任意）','',false,1,300)
 ]);
}
export function accountFormatPanelPayload() {
 return {embeds:[{title:'X アカウント形式判別',description:'Discord内のフォームに納品文字列を入力すると、あなたにだけ判別結果を表示します。\n表示された値をタップしてコピーできます。ログインチュートリアル・2FA生成もこの中で使えます。\n入力はDiscord経由で処理し、DBやログには保存しません。',color:0x2676dd}],components:[row(button('形式判別',ACCOUNT_OPEN,1),button('チュートリアル',PREFIX+'open-tutorial',2))],allowed_mentions:{parse:[]}};
}
// All state is the user's visible ephemeral message. Bind its content to the
// user and expiry so no raw credentials are stored in custom IDs or a database.
async function key(env:Env) {
 if(!env.XUTILITY_BRIDGE_SECRET || env.XUTILITY_BRIDGE_SECRET.length<32)throw new Error('SECRET_NOT_CONFIGURED');
 return crypto.subtle.importKey('raw',new TextEncoder().encode('xutil:account-message:'+env.XUTILITY_BRIDGE_SECRET),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);
}
function bytes(text:string):Uint8Array {return Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
function buffer(data:Uint8Array):ArrayBuffer {return Uint8Array.from(data).buffer;}
function canonical(embeds:Embed[]) {
 return JSON.stringify(embeds.map(e=>({title:e.title??'',description:e.description??'',fields:(e.fields??[]).map(f=>({name:f.name,value:f.value})),footer:e.footer?.text??''})));
}
async function token(embeds:Embed[],user:string,env:Env) {
 if(!user)throw new Error('INVALID_ACTOR');
 const expiry=Math.floor(Date.now()/1000)+900;
 const signature=new Uint8Array(await crypto.subtle.sign('HMAC',await key(env),new TextEncoder().encode(user+'\n'+expiry+'\n'+canonical(embeds))));
 return expiry.toString(36)+'.'+btoa(String.fromCharCode(...signature)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
async function verify(interaction:any,t:string,env:Env):Promise<Embed[]> {
 const [time,signature]=t.split('.');const expiry=parseInt(time??'',36);
 if(!actor(interaction) || !signature || !Number.isFinite(expiry) || expiry<Math.floor(Date.now()/1000) || expiry>Math.floor(Date.now()/1000)+900 || !(interaction.message?.flags&64))throw new Error('EXPIRED_STATE');
 const embeds=interaction.message.embeds as Embed[];
 if(!Array.isArray(embeds) || embeds.length>10)throw new Error('INVALID_STATE');
 if(!await crypto.subtle.verify('HMAC',await key(env),buffer(bytes(signature)),new TextEncoder().encode(actor(interaction)+'\n'+expiry+'\n'+canonical(embeds))))throw new Error('INVALID_STATE');
 return embeds;
}
function displayFields(fields:AccountField[]):Embed[] {
 if(fields.length>24)throw new Error('TOO_MANY_FIELDS');
 const entries:{name:string;value:string;inline:boolean}[]=[];
 for(const [index,f] of fields.entries()) {
  const count=Math.max(1,Math.ceil(f.value.length/1000));
  for(let part=0;part<count;part++)entries.push({name:`${index+1}. ${FIELD_LABELS[f.key]??'未判別'}${count>1?` (${part+1}/${count})`:''}`,value:tapValue(f.value.slice(part*1000,(part+1)*1000)),inline:false});
 }
 const embeds:Embed[]=[];
 for(let i=0;i<entries.length;i+=25)embeds.push({fields:entries.slice(i,i+25)});
 if(!embeds.length)embeds.push({fields:[]});
 return embeds;
}
function restoreFields(embeds:Embed[]):AccountField[] {
 const fields:AccountField[]=[];
 for(const entry of embeds.flatMap(e=>e.fields??[])) {
  const m=entry.name.match(/^(\d+)\. (.+?)(?: \((\d+)\/(\d+)\))?$/);if(!m)continue;
  const index=Number(m[1])-1;const key=Object.keys(FIELD_LABELS).find(k=>FIELD_LABELS[k]===m[2]);
  if(!key || index<0 || index>=24)throw new Error('INVALID_STATE');
  const raw=readValue(entry.value);
  if(!m[3] || m[3]==='1')fields[index]={key,label:FIELD_LABELS[key]!,value:raw,confidence:embeds[0]?.footer?.text==='確認済み'?'format':'candidate'};
  else {if(!fields[index])throw new Error('INVALID_STATE');fields[index]!.value+=raw;}
 }
 if(fields.some(f=>!f) || !fields.length)throw new Error('INVALID_STATE');
 return fields;
}
function checked(fields:AccountField[]) {
 return fields.every(f=>f.confidence==='format') && ['email','username','password','totp'].every(k=>fields.filter(f=>f.key===k && f.value).length<=1);
}
async function result(fields:AccountField[],warnings:string[],user:string,env:Env,tutorial=false,code?:{code:string;validUntil:number}) {
 if(tutorial)fields=fields.filter(f=>['email','username','password','totp'].includes(f.key));
 const embeds=displayFields(fields);
 embeds[0]!.title=tutorial?'X垢のログイン方法':'X アカウント形式判別結果';
 embeds[0]!.color=0x2676dd;
 embeds[0]!.footer={text:checked(fields)?'確認済み':'候補・未判別'};
 embeds[0]!.description=tutorial?
  '**① アカウント追加画面を開く**\nXアプリの左上プロフィール → アカウント切り替え・追加 →「作成済みのアカウントを使う」→「メールアドレスで続ける」。表記が違う場合は既存アカウントのログイン画面へ。\n\n**② ログイン情報を入力する**\n下のX登録メールアドレスまたはXアカウントIDを、タップしてコピーし、貼り付けます。\n\n**③ Xのパスワードを入力する**\n下のXパスワードをタップしてコピーし、貼り付けます。\n\n**④ 2FA認証コードを生成する**\n認証コードを求められたら「2FAコードを生成」を押します。生成した6桁のコードをXに入力します。英数字の2FAキーをそのまま入力するわけではありません。\n\n**⑤ ログイン完了**\nホーム画面が表示されたら完了です。':
  warnings.join('\n')+'\n\nコピーしたい値の表示をタップしてください。候補・未判別は購入元の情報と照合してください。';
 if(code)embeds[0]!.description+='\n\n**認証コード**\n'+tapValue(code.code)+'\n次の更新：<t:'+Math.floor(code.validUntil/1000)+':R>\n期限を過ぎたら「2FAコードを更新」を押してください。';
 const total=embeds.reduce((n,e)=>n+(e.title?.length??0)+(e.description?.length??0)+(e.footer?.text.length??0)+(e.fields??[]).reduce((s,f)=>s+f.name.length+f.value.length,0),0);
 if(total>6000)throw new Error('RESULT_TOO_LONG');
 const t=await token(embeds,user,env);const components:unknown[]=[];
 const buttons=[];
 if(tutorial){if(fields.some(f=>f.key==='totp' && f.value))buttons.push(button(code?'2FAコードを更新':'2FAコードを生成',PREFIX+'totp:'+t,3));}
 else buttons.push(button(checked(fields)?'チュートリアルを表示':'ログイン情報を確認して進む',PREFIX+(checked(fields)?'tutorial:':'confirm:')+t,1));
 buttons.push(button('別の文字列 / Formatで判別',ACCOUNT_OPEN));
 buttons.push(button('結果を消す',PREFIX+'clear:'+t));
 components.push(row(...buttons));
 return {flags:64,embeds,components,allowed_mentions:{parse:[]}};
}
async function parseResult(raw:string,format:string,product:string,user:string,env:Env,tutorial=false) {
 const productId=product?FORMAT_CATALOG.find(s=>s.id===product.trim() || s.url===product.trim())?.id:undefined;
 if(product && !productId)throw new Error('購入元の商品IDまたはURLを確認してください。');
 const parsed=parseAccount(raw,FORMAT_CATALOG,{format:format.trim()||undefined,productId});
 if(parsed.candidates.length>1) {
  const embeds:Embed[]=[{title:tutorial?'チュートリアル用の形式を選択してください':'購入元の形式を選択してください',description:block(raw),footer:{text:productId??'全商品'},color:0x2676dd}];
  if(embeds[0]!.description!.length>4096)throw new Error('RESULT_TOO_LONG');
  const t=await token(embeds,user,env);
  return {flags:64,embeds,components:[row({type:3,custom_id:PREFIX+'candidate:'+t,placeholder:'購入元の商品説明に一致する形式を選択',options:parsed.candidates.slice(0,25).map((c,i)=>({label:c.format.slice(0,100),description:(c.sources.map(id=>FORMAT_CATALOG.find(s=>s.id===id)?.seller??id).join(' / ')||'手入力形式').slice(0,100),value:String(i)}))}),row(button('Formatを入力して判別',ACCOUNT_OPEN),button('結果を消す',PREFIX+'clear:'+t))],allowed_mentions:{parse:[]}};
 }
 return result(parsed.fields,parsed.warnings,user,env,tutorial && checked(parsed.fields));
}
function confirmation(fields:AccountField[]) {
 const unique=(key:string)=>{const values=fields.filter(f=>f.key===key && f.value);return values.length===1?values[0]!.value:'';};
 return modal(PREFIX+'confirmed','購入元のログイン情報を確認',[
  input('email','X登録メールアドレス（購入元で確認）',unique('email')),
  input('username','Xユーザー名（購入元で確認）',unique('username')),
  input('password','Xパスワード（購入元で確認）',unique('password')),
  input('totp','Xの2FAキー（購入元で確認）',unique('totp'))
 ]);
}
export async function handleAccountInteraction(interaction:any,env:Env):Promise<Record<string,unknown>|null> {
 const id=String(interaction.data?.custom_id??'');if(!id.startsWith(PREFIX))return null;
 try {
  if(interaction.type===3 && id===ACCOUNT_OPEN)return form();
  if(interaction.type===3 && id===PREFIX+'open-tutorial')return form('',true);
  if(interaction.type===5 && id===PREFIX+'copy-close')return privateMessage('コピーしたい値の表示をタップしてください。');
  if(interaction.type===5 && [PREFIX+'submit',PREFIX+'submit-tutorial'].includes(id))return {type:4,data:await parseResult(value(interaction,'account'),value(interaction,'format'),value(interaction,'product'),actor(interaction),env,id===PREFIX+'submit-tutorial')};
  if(interaction.type===5 && id===PREFIX+'confirmed') {
   const fields=['email','username','password','totp'].map(k=>({key:k,label:FIELD_LABELS[k]!,value:value(interaction,k),confidence:'format' as const})).filter(f=>f.value);
   if(!fields.some(f=>['email','username'].includes(f.key)) || !fields.some(f=>f.key==='password'))return privateMessage('X登録メールアドレスまたはユーザー名と、Xパスワードを確認してください。');
   return {type:4,data:await result(fields,[],actor(interaction),env,true)};
  }
  if(interaction.type!==3)return privateMessage('判別パネルから入力し直してください。');
  const m=id.match(/^xutil:account:(copy|candidate|tutorial|confirm|totp|clear):(.+)$/);if(!m)return privateMessage('判別パネルから入力し直してください。');
  const embeds=await verify(interaction,m[2]!,env);
  if(m[1]==='clear')return {type:7,data:{content:'結果を消しました。',embeds:[],components:[],allowed_mentions:{parse:[]}}};
  if(m[1]==='candidate') {
   const raw=unblock(embeds[0]!.description!);const parsed=parseAccount(raw,FORMAT_CATALOG,{productId:embeds[0]!.footer?.text==='全商品'?undefined:embeds[0]!.footer?.text});
   const selected=String(interaction.data.values?.[0]??'');if(!/^\d+$/.test(selected))throw new Error('INVALID_STATE');
   const candidate=parsed.candidates[Number(selected)];if(!candidate)throw new Error('INVALID_STATE');
   return {type:7,data:await result(candidate.fields,['選択したFormat：'+candidate.format,'購入元の形式との一致です。ログインやキーの有効性は未検証です。'],actor(interaction),env,embeds[0]!.title!.includes('チュートリアル') && checked(candidate.fields))};
  }
  const fields=restoreFields(embeds);
  if(m[1]==='copy')return privateMessage('値の表示をタップする方式へ変更しました。判別パネルから開き直してください。');
  if(m[1]==='confirm')return confirmation(fields);
  if(!checked(fields))return privateMessage('購入元のログイン情報を確認してから進んでください。');
  const login=fields.filter(f=>['email','username','password','totp'].includes(f.key));
  if(m[1]==='tutorial')return {type:7,data:await result(login,[],actor(interaction),env,true)};
  if(m[1]==='totp') {
   const secret=login.find(f=>f.key==='totp')?.value;if(!secret)throw new Error('NO_TOTP');
   const code=await generateTotp(secret);
   return {type:7,data:await result(login,[],actor(interaction),env,true,code)};
  }
  return null;
 } catch(error) {
  const known=error instanceof Error && !/^[A-Z_]+$/.test(error.message);
  return privateMessage(known?error.message:'この操作を続けられません。2FAキーや入力内容を確認し、判別パネルから入力し直してください（結果の操作期限は15分です）。');
 }
}

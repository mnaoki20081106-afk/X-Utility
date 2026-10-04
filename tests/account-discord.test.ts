import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const bundled=await build({entryPoints:['src/account-discord.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {accountFormatPanelPayload,handleAccountInteraction}=await import('data:text/javascript;base64,'+Buffer.from(bundled.outputFiles[0]!.text).toString('base64')); 
import { generateTotp } from '../src/totp.ts';
const env={XUTILITY_BRIDGE_SECRET:'fixture-bridge-secret-at-least-32-characters'};
const user={id:'123456789012345678'};
const secret='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const raw=`sample_user: Pass908! :sample@outlook.com:Mail908!:${secret}:${'a'.repeat(40)}`;
const format='Login:Password:Email:MailPass:2FA:Token';
function submit(id:string,values:Record<string,string>) {return {type:5,user,data:{custom_id:id,components:Object.entries(values).map(([custom_id,value])=>({type:1,components:[{type:4,custom_id,value}]}))}};}
function component(data:any,label:string) {return data.components.flatMap((r:any)=>r.components).find((c:any)=>c.label===label);}
function select(data:any) {return data.components.flatMap((r:any)=>r.components).find((c:any)=>c.type===3);}
async function action(data:any,id:string,values?:string[],who=user) {return await handleAccountInteraction({type:3,user:who,message:{...data,flags:64},data:{custom_id:id,values}},env) as any;}
function limits(data:any) {
 assert.ok(data.components.length<=5);
 for(const r of data.components)for(const c of r.components) {assert.ok(c.custom_id?.length<=100);assert.equal(c.url,undefined);if(c.options)assert.ok(c.options.length<=25);}
 let total=0;
 for(const e of data.embeds??[]) {assert.ok((e.description??'').length<=4096);assert.ok((e.fields??[]).length<=25);total+=(e.title??'').length+(e.description??'').length+(e.footer?.text??'').length;for(const f of e.fields??[]) {assert.ok(f.value.length<=1024);total+=f.name.length+f.value.length;}}
 assert.ok(total<=6000);
}
test('initial panel has two native buttons and both open Discord forms',async()=>{
 const panel=accountFormatPanelPayload();limits(panel);
 assert.deepEqual(panel.components[0]!.components.map((c:any)=>c.label),['形式判別','チュートリアル']);
 for(const button of panel.components[0]!.components as any[]) {
  const r:any=await handleAccountInteraction({type:3,user,data:{custom_id:button.custom_id}},env);
  assert.equal(r.type,9);assert.equal(r.data.components[0].components[0].custom_id,'account');
  assert.ok(r.data.custom_id.endsWith(button.label==='チュートリアル'?'submit-tutorial':'submit'));
 }
});
test('parse, exact-value copy form, tutorial, 2FA update and clear stay private and stateless',async()=>{
 const response:any=await handleAccountInteraction(submit('xutil:account:submit',{account:raw,format}),env);
 assert.equal(response.type,4);assert.equal(response.data.flags,64);limits(response.data);
 const copied=await action(response.data,select(response.data).custom_id,['1']);assert.equal(copied.type,9);assert.equal(copied.data.components[0].components[0].value,' Pass908! ');
 const tutorial=await action(response.data,component(response.data,'チュートリアルを表示').custom_id);assert.equal(tutorial.type,7);assert.match(tutorial.data.embeds[0].description,/メールアドレスで続ける/);assert.equal(tutorial.data.embeds[0].fields[2].value,'```\nsample@outlook.com\n```');limits(tutorial.data);
 const code=await action(tutorial.data,component(tutorial.data,'2FAコードを生成').custom_id);assert.equal(code.type,7);assert.match(code.data.embeds[0].description,new RegExp((await generateTotp(secret)).code));assert.match(code.data.embeds[0].description,/<t:\d+:R>/);limits(code.data);
 const copyCode=await action(code.data,select(code.data).custom_id,['code']);assert.equal(copyCode.type,9);assert.equal(copyCode.data.components[0].components[0].value,(await generateTotp(secret)).code);
 const updated=await action(code.data,component(code.data,'2FAコードを更新').custom_id);assert.equal(updated.type,7);limits(updated.data);
 const cleared=await action(updated.data,component(updated.data,'結果を消す').custom_id);assert.deepEqual(cleared.data.embeds,[]);assert.deepEqual(cleared.data.components,[]);
});
test('tutorial button proceeds directly after an explicit format and guesses require an info form',async()=>{
 const direct:any=await handleAccountInteraction(submit('xutil:account:submit-tutorial',{account:raw,format}),env);assert.equal(direct.data.embeds[0].title,'X垢のログイン方法');
 const guessed:any=await handleAccountInteraction(submit('xutil:account:submit',{account:'sample_user: Pass908! :sample@outlook.com'}),env);
 const confirm=component(guessed.data,'ログイン情報を確認して進む');assert.ok(confirm);
 const form=await action(guessed.data,confirm.custom_id);assert.equal(form.type,9);
 const tutorial:any=await handleAccountInteraction(submit(form.data.custom_id,{email:'sample@outlook.com',username:'sample_user',password:' Pass908! ',totp:secret}),env);assert.equal(tutorial.data.flags,64);assert.equal(tutorial.data.embeds[0].title,'X垢のログイン方法');limits(tutorial.data);
});
test('signed message state rejects another user, changes, public messages and expiry',async()=>{
 const r:any=await handleAccountInteraction(submit('xutil:account:submit',{account:raw,format}),env);const id=select(r.data).custom_id;
 for(const result of [await action(r.data,id,['1'],{id:'999999999999999999'}),await action({...r.data,embeds:[{...r.data.embeds[0],title:'tampered'}]},id,['1']),await handleAccountInteraction({type:3,user,message:{...r.data,flags:0},data:{custom_id:id,values:['1']}},env)]) {assert.equal((result as any).type,4);assert.equal((result as any).data.flags,64);assert.doesNotMatch((result as any).data.content,/Pass908/);}
 const original=Date.now;try {Date.now=()=>original()+901000;const expired=await action(r.data,id,['1']);assert.equal(expired.type,4);assert.match(expired.data.content,/15分/);}finally {Date.now=original;}
});
test('ambiguous formats can be selected within the ephemeral message',async()=>{
 const response:any=await handleAccountInteraction(submit('xutil:account:submit-tutorial',{account:`sample_user:Pass908!:sample@outlook.com:${'c'.repeat(40)}:${'a'.repeat(40)}`}),env);assert.match(response.data.embeds[0].title,/形式を選択/);limits(response.data);
 const picked=await action(response.data,select(response.data).custom_id,['0']);assert.equal(picked.type,7);limits(picked.data);
 assert.equal(picked.data.embeds[0].title,'X垢のログイン方法');
});
test('long field chunks preserve exact copy content within Discord embed limits',async()=>{
 const password='!'.repeat(3500);const r:any=await handleAccountInteraction(submit('xutil:account:submit',{account:`sample_user:${password}`,format:'Login:Password'}),env);assert.equal(r.type,4);limits(r.data);
 const copied=await action(r.data,select(r.data).custom_id,['1']);assert.equal(copied.data.components[0].components[0].value,password);
});
test('signed Discord HTTP interactions dispatch to the native account form and private result',async()=>{
 const buildResult=await build({entryPoints:['src/index.ts'],bundle:true,write:false,platform:'node',format:'esm',loader:{'.txt':'text'}});
 const worker=(await import('data:text/javascript;base64,'+Buffer.from(buildResult.outputFiles[0]!.text).toString('base64'))).default;
 const keys=await crypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']);
 const publicKey=Buffer.from(await crypto.subtle.exportKey('raw',keys.publicKey)).toString('hex');
 const workerEnv={...env,DISCORD_PUBLIC_KEY:publicKey};
 async function request(payload:unknown) {
  const body=JSON.stringify(payload),timestamp=String(Math.floor(Date.now()/1000));
  const signature=Buffer.from(await crypto.subtle.sign('Ed25519',keys.privateKey,new TextEncoder().encode(timestamp+body))).toString('hex');
  const response=await worker.fetch(new Request('https://utility.example/interactions',{method:'POST',body,headers:{'X-Signature-Ed25519':signature,'X-Signature-Timestamp':timestamp}}),workerEnv,{});
  assert.equal(response.status,200);return response.json();
 }
 const form=await request({type:3,user,data:{custom_id:'xutil:account:open-tutorial'}});assert.equal(form.type,9);
 const result=await request(submit(form.data.custom_id,{account:raw,format}));assert.equal(result.type,4);assert.equal(result.data.flags,64);assert.equal(result.data.embeds[0].title,'X垢のログイン方法');
});

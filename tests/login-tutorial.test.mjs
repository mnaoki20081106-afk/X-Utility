import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {generateTotp} from '../src/totp.ts';

async function fixture(t) {
 const result=await build({entryPoints:['src/account-page.ts'],bundle:true,write:false,platform:'node',format:'esm',loader:{'.txt':'text'}});
 const {accountPageResponse}=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
 const dom=new JSDOM(await accountPageResponse().text(),{url:'https://utility.example/account-format',runScripts:'outside-only'});t.after(()=>dom.window.close());
 const w=dom.window;let now=59000,copied='',network=0;
 const timers=new Map();let next=0;
 w.Date.now=()=>now;w.setInterval=fn=>{timers.set(++next,fn);return next;};w.clearInterval=id=>timers.delete(id);
 Object.defineProperty(w,'crypto',{value:webcrypto});
 Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async value=>{copied=value;}}});
 w.fetch=()=>{network++;throw new Error('network forbidden')};
 w.eval(await readFile('src/generated/account-browser.txt','utf8'));
 const q=id=>w.document.getElementById(id);
 const flush=async()=>{for(let i=0;i<12;i++)await new Promise(r=>setImmediate(r));};
 const until=async predicate=>{const deadline=Date.now()+2000;while(!predicate() && Date.now()<deadline)await new Promise(r=>setTimeout(r,5));assert.ok(predicate(),`async result missing: ${q('tutorial-code-error').textContent}; timers=${timers.size}`);};
 const parse=(raw,format)=>{q('account').value=raw;q('template').value=format;q('parse').click();q('tutorial-show').click();};
 return {w,q,parse,flush,until,timers,get copied(){return copied},get network(){return network},setNow(value){now=value}};
}
const key='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',auth='a'.repeat(40);
test('tutorial substitutes account fields and generates current TOTP with rollover and exact copy',async t=>{
 const f=await fixture(t);
 f.parse(`sample_user: Pass908! :sample@outlook.com:Mail908!:${key}:${auth}`,'Login:Password:Email:MailPass:2FA:Token');
 assert.equal(f.q('tutorial').hidden,false);assert.equal(f.q('tutorial-email-value').value,'sample@outlook.com');assert.equal(f.q('tutorial-username-value').value,'sample_user');assert.equal(f.q('tutorial-password-value').value,' Pass908! ');
 assert.equal(f.q('tutorial-confirm-wrap').hidden,true);
 for(const [button,value] of [['tutorial-email-copy','sample@outlook.com'],['tutorial-username-copy','sample_user'],['tutorial-password-copy',' Pass908! ']]){f.q(button).click();await f.flush();assert.equal(f.copied,value);}
 f.q('tutorial-generate').click();await f.until(()=>f.timers.size===1);assert.equal(f.q('tutorial-code').value,(await generateTotp(key,59000)).code);assert.match(f.q('tutorial-code-copy').textContent,/あと1秒/);assert.equal(f.timers.size,1);
 const nextCode=(await generateTotp(key,60000)).code;f.setNow(60000);for(const fn of f.timers.values())fn();await f.until(()=>f.q('tutorial-code').value===nextCode);assert.equal(f.q('tutorial-code').value,(await generateTotp(key,60000)).code);assert.match(f.q('tutorial-code-copy').textContent,/あと30秒/);
 // Simulate an app switch: no timer callback, then copy after a period change.
 const copyCode=(await generateTotp(key,90000)).code;f.setNow(90000);f.q('tutorial-code-copy').click();await f.until(()=>f.copied===copyCode);assert.equal(f.copied,(await generateTotp(key,90000)).code);
 assert.equal(f.network,0);assert.equal(f.w.localStorage.length,0);assert.equal(f.w.sessionStorage.length,0);
 f.q('clear').click();assert.equal(f.q('tutorial').hidden,true);assert.equal(f.q('tutorial-email-value').value,'');assert.equal(f.q('tutorial-code').value,'');assert.equal(f.timers.size,0);
});
test('unconfirmed guesses require acknowledgement and missing or invalid keys do not generate',async t=>{
 const f=await fixture(t);
 f.parse(`sample_user:Pass908!:sample@outlook.com:Mail908!:backup@gmail.com:${key}:${auth}`,'');
 assert.equal(f.q('tutorial-confirm-wrap').hidden,false);assert.equal(f.q('tutorial-generate').disabled,true);assert.equal(f.q('tutorial-email-select').hidden,false);assert.equal(f.q('tutorial-email-value').value,'');
 f.q('tutorial-email-select').value='2';f.q('tutorial-email-select').dispatchEvent(new f.w.Event('change'));f.q('tutorial-confirm').checked=true;f.q('tutorial-confirm').dispatchEvent(new f.w.Event('change'));
 assert.equal(f.q('tutorial-email-copy').disabled,false);assert.equal(f.q('tutorial-generate').disabled,false);
 f.q('tutorial-generate').click();await f.until(()=>f.timers.size===1);assert.match(f.q('tutorial-code').value,/^\d{6}$/);
 // Change the mapping while a code is active: discard the old key/code immediately.
 f.w.document.querySelectorAll('#fields select')[5].value='unknown';f.w.document.querySelectorAll('#fields select')[5].dispatchEvent(new f.w.Event('change'));
 assert.equal(f.q('tutorial').hidden,true);assert.equal(f.q('tutorial-code').value,'');assert.equal(f.timers.size,0);
 f.q('tutorial-show').click();assert.equal(f.q('tutorial-generate').disabled,true);
 f.parse(`sample_user:Pass908!:sample@outlook.com:${auth}`,'User:Pass:Email:Token');assert.equal(f.q('tutorial-generate').disabled,true);
 f.parse(`sample_user:Pass908!:sample@outlook.com:${'A'.repeat(17)}:${auth}`,'User:Pass:Email:2FA:Token');
 f.q('tutorial-generate').click();await f.flush();assert.equal(f.q('tutorial-code-wrap').hidden,true);assert.match(f.q('tutorial-code-error').textContent,/生成できません/);assert.equal(f.timers.size,0);
});
test('fast repeated generation and reparse do not leave stale code or timers',async t=>{
 const f=await fixture(t);f.parse(`sample_user:Pass908!:sample@outlook.com:${key}:${auth}`,'User:Pass:Email:2FA:Token');
 f.q('tutorial-generate').click();f.q('tutorial-generate').click();await f.until(()=>f.timers.size===1);assert.equal(f.timers.size,1);
 f.q('tutorial-generate').click();f.q('parse').click();await f.flush();assert.equal(f.q('tutorial-code').value,'');assert.equal(f.timers.size,0);
});

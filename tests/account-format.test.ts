import assert from 'node:assert/strict';
import test from 'node:test';
import { parseAccount, matchFormat, templateFields } from '../src/account-format.ts';
import { FORMAT_CATALOG } from '../src/generated/hstora-formats.ts';
const auth='a'.repeat(40),ct0='b'.repeat(64),totp='JBSWY3DPEHPK3PXP';
const client='12345678-1234-1234-1234-123456789abc';

test('all confirmed catalogue formats parse a representative delivery with exact values',()=>{
  const values:Record<string,string>={username:'sample_user',password:'Pass908!',email:'sample@outlook.com',emailPassword:'Mail908!',recoveryEmail:'backup@gmail.com',recoveryPassword:'Backup908!',phone:'+819012345678',totp,authToken:auth,ct0,refreshToken:'M.Refresh123_long',clientId:client,cookies:'[{"name":"auth_token","value":"'+auth+'"}]',followers:'20',tweets:'2',year:'2026',premiumDue:'2026/12/31',emailToken:'mailToken12345',emailTotp:totp,verificationUrl:'https://example.com/mail',backupCode:'12345678'};
  for(const source of FORMAT_CATALOG)for(const format of source.formats){
    const {keys,separators,trailingSeparator}=templateFields(format);
    const raw=keys.map((k,i)=>values[k]+(separators[i]??'')).join('')+(trailingSeparator??'');
    const fields=matchFormat(raw,format);
    assert.ok(fields,`catalogue #${source.id}: ${format}`);
    assert.deepEqual(fields.map(f=>f.value),keys.map(k=>values[k]));
  }
});
test('colon plus nested mail pipes uses published product format',()=>{
  const raw=`sample_user:Pass908!:sample@outlook.com|Mail908!|Refresh123|${client}:${auth}:${totp}`;
  const result=parseAccount(raw,FORMAT_CATALOG,{productId:'1206'});
  assert.equal(result.candidates.length,1);
  assert.deepEqual(result.fields.map(f=>f.key),['username','password','email','emailPassword','refreshToken','clientId','authToken','totp']);
});
test('known Top Search product has no mail password field',()=>{
  const result=parseAccount(`sample_user----Pass908!----sample@outlook.com----${totp}----${auth}`,FORMAT_CATALOG,{productId:'4841'});
  assert.equal(result.candidates.length,1);
  assert.equal(result.fields.some(f=>f.key==='emailPassword'),false);
});
test('same separators and same shape can remain ambiguous',()=>{
  const result=parseAccount(`sample_user:Pass908!:sample@outlook.com:${'c'.repeat(40)}:${auth}`,FORMAT_CATALOG);
  assert.ok(result.candidates.length>1);
  assert.ok(result.fields.every(f=>f.confidence!=='format'));
});
test('password whitespace and empty fields are preserved',()=>{
  const result=parseAccount(`sample_user: Pass908! :sample@outlook.com::${totp}:${auth}`,FORMAT_CATALOG,{format:'Login:Password:Email:MailPassword:2FA:Token'});
  assert.equal(result.candidates.length,1);
  assert.equal(result.fields[1]?.value,' Pass908! ');
  assert.equal(result.fields[3]?.value,'');
});
test('generic sample with two mail addresses does not invent recovery role',()=>{
  const raw=`sample_user:Pass908!:sample@outlook.com:Mail908!:backup@gmail.com:${totp}:${auth}`;
  const result=parseAccount(raw,FORMAT_CATALOG);
  assert.equal(result.candidates.length,0);
  assert.equal(result.fields.filter(f=>f.key==='email').length,2);
  assert.equal(result.fields[1]?.key,'password');
  assert.deepEqual(result.fields.map(f=>f.value).join(':'),raw);
});
test('password containing active delimiter is not silently reassigned',()=>{
  assert.equal(matchFormat(`sample_user:pass:with:colons:sample@outlook.com:${auth}`,'User:Pass:Email:Token'),null);
});
test('invalid or multi-account input and unknown template labels are rejected without echoing secrets',()=>{
  for(const raw of ['', 'secret\nsecret', 'x'.repeat(4001)])assert.throws(()=>parseAccount(raw,FORMAT_CATALOG));
  assert.throws(()=>parseAccount('secret',FORMAT_CATALOG,{format:'Login:NotAField'}),e=>e instanceof Error && !e.message.includes('secret'));
});
test('explicit mixed sequence with different dash lengths is supported',()=>{
  const raw=`sample_user---Pass908!----sample@outlook.com----Mail908!---Refresh123----${client}----${totp}----${auth}`;
  const r=parseAccount(raw,FORMAT_CATALOG,{productId:'1584'});
  assert.equal(r.candidates.length,1);assert.equal(r.fields[3]?.value,'Mail908!');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const buildResult=await build({entryPoints:['src/format-catalog.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const {FORMAT_CATALOG,resolveFormatSources}=await import('data:text/javascript;base64,'+Buffer.from(buildResult.outputFiles[0].text).toString('base64'));
import {matchFormat,templateFields,parseAccount} from '../src/account-format.ts';
const values={username:'sample_user',password:' Pass908! ',email:'sample@outlook.com',emailPassword:'Mail908!',recoveryEmail:'backup@gmail.com',recoveryPassword:'Backup908!',phone:'+819012345678',totp:'JBSWY3DPEHPK3PXP',authToken:'a'.repeat(40),ct0:'b'.repeat(64),refreshToken:'M.Refresh123_long',clientId:'12345678-1234-1234-1234-123456789abc',cookies:'[{"name":"auth_token","value":"'+'a'.repeat(40)+'"}]',followers:'20',tweets:'2',year:'2026',premiumDue:'2026/12/31',emailToken:'mailToken12345',emailTotp:'JBSWY3DPEHPK3PXP',verificationUrl:'https://example.com/mail',backupCode:'12345678',emailAccessInfo:'mail_access123',oauthToken:'12345-accessToken',oauthSecret:'accessSecret',oauth2:'oauth2value',registrationDate:'2026/01/01',country:'US',avatar:'yes',userAgent:'Mozilla/5.0',twoFactorId:'providedId',additionalEmail:'extra@gmail.com',profileUrl:'https://x.com/sample_user',device:'deviceValue',secretToken:'secretValue',deviceToken:'deviceTokenValue',data:'2026',unknown:'None'};
test('every combined catalogue declaration preserves representative delivery values',()=>{
 for(const source of FORMAT_CATALOG)for(const format of source.formats){
  const {keys,separators,trailingSeparator}=templateFields(format);
  for(const key of keys)assert.ok(values[key],`Missing fixture ${key}`);
  const expected=keys.map(k=>k==='clientId'&&separators.includes('-')?'0123456789abcdef0123456789abcdef':values[k]);
  const raw=expected.map((v,i)=>v+(separators[i]??'')).join('')+(trailingSeparator??'');
  const fields=matchFormat(raw,format);assert.ok(fields,`${source.id}: ${format}`);
  assert.deepEqual(fields.map(f=>f.value),expected);
 }
});
test('hStockPlus product URLs, IDs and shop names resolve without changing HStora IDs',()=>{
 const source=FORMAT_CATALOG.find(x=>x.id==='hstockplus:6aaef856dbc83945af55f0e1');assert.ok(source);
 for(const query of [source.id,...source.aliases,source.url,source.url.replace('/products/','/ja/products/')+'/?page=1'])assert.equal(resolveFormatSources(query)[0].id,source.id);
 assert.ok(resolveFormatSources(source.seller).every(x=>x.seller===source.seller));
 assert.equal(resolveFormatSources('1584')[0].id,'1584');
 assert.throws(()=>resolveFormatSources('42',[{...source,id:'a',aliases:['42']},{...source,id:'b',aliases:['42']}]));
 assert.throws(()=>resolveFormatSources('missing-shop'));
});
test('translated separator counts are not silently substituted and email 2FA stays separate',()=>{
 const source=resolveFormatSources('hstockplus:6aaef856dbc83945af55f0e1');
 const raw=`${values.username}---${values.password}----${values.email}----${values.emailPassword}---${values.refreshToken}----${values.clientId}----${values.totp}----${values.authToken}`;
 assert.equal(parseAccount(raw,source).candidates.length,1);
 assert.equal(parseAccount(raw.replace('---','----'),source).candidates.length,0);
 assert.deepEqual(templateFields('Twitter Email:Twitter Password:Twitter 2FA:Twitter Username:Email Password:Email Recovery:2FA Key of Email').keys,['email','password','totp','username','emailPassword','recoveryEmail','emailTotp']);
});
test('cookies and user agents do not swallow unrelated credentials to force a match',()=>{
 assert.equal(matchFormat(`${values.username}:pass:${values.email}:mailpass:backup@gmail.com:${values.totp}:${values.authToken}`,'Login:Password:Email:EmailPassword:UserAgent:Cookies'),null);
});

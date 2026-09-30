import test from 'node:test';
import assert from 'node:assert/strict';
import {generateTotp,decodeBase32} from '../src/totp.ts';

test('RFC 6238 SHA1 vectors truncated to six digits',async()=>{
 const key='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
 for(const [seconds,expected] of [[59,'287082'],[1111111109,'081804'],[1111111111,'050471'],[1234567890,'005924'],[2000000000,'279037'],[20000000000,'353130']] as const){
  assert.equal((await generateTotp(key,seconds*1000)).code,expected);
 }
});
test('malformed keys are rejected instead of silently dropping bits',()=>{
 for(const key of ['AAA','AAAAAA','AB','ABCDEF']) assert.throws(()=>decodeBase32(key));
 assert.deepEqual(decodeBase32('MY======'),new Uint8Array([102]));
 assert.deepEqual(decodeBase32('MZ XW-6==='),new Uint8Array([102,111,111]));
});
test('period boundary resets remaining time and validity',async()=>{
 const key='GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
 assert.equal((await generateTotp(key,29999)).remainingSeconds,1);
 const next=await generateTotp(key,30000);
 assert.equal(next.remainingSeconds,30);assert.equal(next.validFrom,30000);assert.equal(next.validUntil,60000);
});

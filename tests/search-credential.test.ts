import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {saveCredential,loadCredential,clearCredential,credentialStatus} from '../src/search-credential.ts';

test('first credential save initializes storage and round trips encrypted credentials',async()=>{
 const db=new DatabaseSync(':memory:');
 const env={XUTILITY_BRIDGE_SECRET:'test-only-secret-with-sufficient-length',DB:{prepare(sql:string){
  // D1 prepares lazily, including schema creation statements.
  const statement=(args:unknown[]=[])=>({bind(...values:unknown[]){return statement(values);},async run(){return db.prepare(sql).run(...args as any[]);},async first(){return db.prepare(sql).get(...args as any[])??null;}});
  return statement();
 }}} as any;
 try{
  await saveCredential(env,{session:'example-session',csrf:'example-csrf'});
  const row=db.prepare('SELECT session_enc,csrf_enc FROM search_credentials').get()!;
  assert.ok(!String(row.session_enc).includes('example-session'));
  const loaded=await loadCredential(env);
  assert.equal(loaded?.session,'example-session');assert.equal(loaded?.csrf,'example-csrf');
  await clearCredential(env);assert.equal((await credentialStatus(env)).configured,false);
 }finally{db.close();}
});

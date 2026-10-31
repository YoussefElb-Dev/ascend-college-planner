import test from 'node:test';
import assert from 'node:assert/strict';
import {GitHubFile,newSyncKey} from '../dist/sync-core.js';

test('sync supports browser fetch implementations that require the global Window receiver',async()=>{
 let requests=0;
 async function browserFetch(url,options){
  assert.equal(this,globalThis,'Browser fetch must receive its Window, not the GitHubFile instance.');
  assert.equal(url,'https://api.github.com/repos/owner/private-sync');assert.equal(options.credentials,'omit');requests++;
  return Response.json({private:true});
 }
 const file=new GitHubFile({owner:'owner',repo:'private-sync',token:'synthetic-test-token',key:newSyncKey()},browserFetch);
 await file.verify();assert.equal(requests,1);
});

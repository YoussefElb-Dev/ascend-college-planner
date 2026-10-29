import test from 'node:test';
import assert from 'node:assert/strict';
import {blankState,STORAGE_KEY} from '../dist/core.js';
import {sealWorkspace,newSyncKey} from '../dist/sync-core.js';
import {createDeviceSync} from '../dist/device-sync.js';

test('password-unlocked browsers restore cloud records and retain only connection metadata',async()=>{
 const originals=Object.fromEntries(['fetch','navigator','document','location','localStorage'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 try{
  const map=new Map(),cloud=blankState(),key=newSyncKey();cloud.notes=[{id:'synced-note',title:'Plans from another device',body:'Keep this record'}];
  const encrypted=await sealWorkspace(cloud,key);let local=blankState(),writes=0;
  const values={navigator:{onLine:true},document:{querySelectorAll:()=>[],querySelector:()=>null},location:{hash:'#home'},localStorage:{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},fetch:async(url,options={})=>{
   if(options.method==='PUT'){writes++;throw Error('A new browser must not overwrite the cloud');}
   if(url==='/api/account?mode=session')return Response.json({configured:true,authenticated:true,user:{login:'owner'}});
   if(url==='/api/account?mode=connection')return Response.json({format:'ascend-sync-connection-v1',owner:'owner',repo:'private-sync',token:'test-only-token',key});
   if(url.endsWith('/contents/workspace.enc.json'))return Response.json({sha:'remote-revision',size:encrypted.length,encoding:'base64',content:Buffer.from(encrypted).toString('base64')});
   if(url==='https://api.github.com/repos/owner/private-sync')return Response.json({private:true});
   throw Error('Unexpected sync request');
  }};
  for(const [k,v] of Object.entries(values))Object.defineProperty(globalThis,k,{value:v,writable:true,configurable:true});
  let locked=true,rendered=0;
  const ctx={getState:()=>local,isLocked:()=>locked,isFreshDevice:()=>!map.has(STORAGE_KEY),applyRemote:w=>{local=w;map.set(STORAGE_KEY,JSON.stringify(w));return true;},render:()=>rendered++,header:()=>'',btn:(title)=>title};
  const sync=createDeviceSync(ctx);await sync.sync();assert.equal(map.size,0);
  locked=false;await sync.initialize();assert.equal(local.notes[0].title,'Plans from another device');assert.equal(writes,0);
  const metadata=map.get('ascend.sync.account.v1');assert.ok(metadata);assert.ok(!metadata.includes(key));assert.ok(!metadata.includes('test-only-token'));assert.ok(!map.has('ascend.sync.connection.v1'));
  assert.match(sync.page(),/Up to date/);assert.ok(!sync.page().includes('Fine-grained'));assert.equal(rendered,0);
  local=blankState();local.notes=[{id:'local-note',title:'Independent local edits'}];map.set(STORAGE_KEY,JSON.stringify(local));map.delete('ascend.sync.account.v1');
  const other=createDeviceSync(ctx);await other.initialize();assert.equal(local.notes[0].title,'Independent local edits');assert.match(other.page(),/Both devices have changes/);assert.equal(writes,0);
 }finally{for(const [k,v] of Object.entries(originals)){if(v)Object.defineProperty(globalThis,k,v);else delete globalThis[k];}}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('offline worker activates without retaining old caches and bypasses account responses',async()=>{
 const handlers={},deleted=[];let skipped=false,claimed=false,intercepted=false;
 const context={URL,Response,fetch:()=>Promise.reject(Error('offline')),caches:{open:async()=>({addAll:async()=>{}}),keys:async()=>['ascend-static-v17','ascend-static-v18','ascend-static-v19','unrelated'],delete:async name=>deleted.push(name)},self:{location:{origin:'https://ascend.example'},addEventListener:(type,handler)=>handlers[type]=handler,skipWaiting:async()=>{skipped=true},clients:{claim:async()=>{claimed=true}}}};
 vm.runInNewContext(fs.readFileSync(new URL('../dist/sw.js',import.meta.url),'utf8'),context);
 let pending;handlers.install({waitUntil:p=>pending=p});await pending;assert.ok(skipped);
 handlers.activate({waitUntil:p=>pending=p});await pending;assert.deepEqual(deleted,['ascend-static-v17','ascend-static-v18']);assert.ok(claimed);
 handlers.fetch({request:{url:'https://ascend.example/api/account?mode=connection',method:'GET'},respondWith:()=>intercepted=true});assert.equal(intercepted,false);
});

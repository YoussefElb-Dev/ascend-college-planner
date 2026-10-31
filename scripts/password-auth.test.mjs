import test from 'node:test';
import assert from 'node:assert/strict';
import {sealPasswordPolicy,openPasswordPolicy,checkPassword} from '../server/password-policy.js';
import {createAccountHandler} from '../server/account-service.js';
import {offlineVerifier,verifyOfflinePassword} from '../dist/password-lock-model.js';

const secret=Buffer.alloc(32,5).toString('base64'),password='synthetic-test-password';
const sealed=await sealPasswordPolicy(password,secret);
const env={ASCEND_ORIGIN:'https://ascend.example',ASCEND_GITHUB_OWNER:'owner',ASCEND_GITHUB_OWNER_ID:'123',ASCEND_GITHUB_REPO:'private-sync',ASCEND_GITHUB_TOKEN:'synthetic-token',ASCEND_SYNC_KEY:secret,ASCEND_SESSION_SECRET:Buffer.alloc(32,8).toString('base64'),ASCEND_PASSWORD_POLICY:sealed};
const headers={origin:env.ASCEND_ORIGIN,'sec-fetch-site':'same-origin','x-ascend-client':'web','x-real-ip':'192.0.2.1'};
let at=1800000000000;
function client(settings={}){
 const handler=createAccountHandler({env,now:()=>at,transport:()=>{throw Error('Website password sign-in must not contact an identity provider.');},...settings});
 return async(mode,options={})=>{const res={headers:{},setHeader(k,v){this.headers[k.toLowerCase()]=v;},end(body=''){this.body=body;}};await handler({url:'/api/account?mode='+mode,method:options.method||'GET',headers:options.headers||headers,body:options.body},res);return res;};
}
test('sealed server password policies hide the verifier and reject tampering or another server key',async()=>{
 const policy=openPasswordPolicy(secret,sealed);assert.ok(policy);assert.equal(await checkPassword(password,policy),true);assert.equal(await checkPassword('wrong',policy),false);
 assert.equal(openPasswordPolicy(Buffer.alloc(32,4).toString('base64'),sealed),null);
 const altered=Buffer.from(sealed,'base64url');altered[35]^=1;assert.equal(openPasswordPolicy(secret,altered.toString('base64url')),null);
 assert.ok(!sealed.includes(password));assert.notEqual(await sealPasswordPolicy(password,secret),sealed);
});
test('a fresh browser authenticates with only its website password and receives a protected sync session',async()=>{
 const call=client(),session=await call('session');assert.equal(JSON.parse(session.body).passwordEnabled,true);assert.equal(JSON.parse(session.body).authenticated,false);
 const denied=await call('connection');assert.equal(denied.statusCode,401);
 const wrong=await call('password-login',{method:'POST',body:{password:'old-test-password'}});assert.equal(wrong.statusCode,401);assert.equal(wrong.headers['set-cookie'],undefined);
 const login=await call('password-login',{method:'POST',body:{password}});assert.equal(login.statusCode,200);assert.match(login.headers['set-cookie'],/HttpOnly; Secure; SameSite=Lax/);assert.ok(!login.body.includes('synthetic-token'));assert.ok(!login.body.includes(secret));
 const cookie=login.headers['set-cookie'].split(';')[0],connection=await call('connection',{headers:{...headers,cookie}});assert.equal(connection.statusCode,200);assert.equal(JSON.parse(connection.body).repo,'private-sync');assert.equal(connection.headers['cache-control'],'private, no-store, max-age=0');
 const legacyLink=await call('login');assert.equal(legacyLink.headers.location,'https://ascend.example/#home');
});
test('password sign-in rejects cross-origin requests and an unconfigured verifier',async()=>{
 const call=client();for(const bad of [{...headers,origin:'https://other.example'},{...headers,'sec-fetch-site':'cross-site'},{...headers,'x-ascend-client':'other'}])assert.equal((await call('password-login',{method:'POST',headers:bad,body:{password}})).statusCode,403);
 const disabled=client({env:{...env,ASCEND_PASSWORD_POLICY:'invalid'}});assert.equal((await disabled('password-login',{method:'POST',body:{password}})).statusCode,503);
 assert.equal((await call('password-login',{method:'POST',body:{password:'x'.repeat(13000)}})).statusCode,400);
});
test('server throttling limits password attempts and expires without storing plain IP addresses',async()=>{
 const call=client();for(let i=0;i<5;i++)assert.equal((await call('password-login',{method:'POST',body:{password:'incorrect'}})).statusCode,401);
 const blocked=await call('password-login',{method:'POST',body:{password}});assert.equal(blocked.statusCode,429);assert.equal(blocked.headers['retry-after'],'900');
 const other=await call('password-login',{method:'POST',headers:{...headers,'x-real-ip':'192.0.2.2'},body:{password}});assert.equal(other.statusCode,200);
 at+=900001;assert.equal((await call('password-login',{method:'POST',body:{password}})).statusCode,200);
});
test('rotating a sealed policy invalidates sessions authenticated with the previous password',async()=>{
 const call=client(),login=await call('password-login',{method:'POST',body:{password}}),cookie=login.headers['set-cookie'].split(';')[0];
 const rotated=client({env:{...env,ASCEND_PASSWORD_POLICY:await sealPasswordPolicy('replacement-test-password',secret)}});
 assert.equal((await rotated('connection',{headers:{...headers,cookie}})).statusCode,401);
});
test('offline access uses a salted expiring verifier and never accepts the wrong password',async()=>{
 const record=await offlineVerifier(password,'policy-version',at);assert.ok(!JSON.stringify(record).includes(password));assert.equal(await verifyOfflinePassword(password,record,at),true);assert.equal(await verifyOfflinePassword('incorrect',record,at),false);assert.equal(await verifyOfflinePassword(password,record,record.expiresAt),false);assert.equal(await verifyOfflinePassword(password,{...record,v:1},at),false);assert.notEqual((await offlineVerifier(password,'policy-version',at)).salt,record.salt);
});

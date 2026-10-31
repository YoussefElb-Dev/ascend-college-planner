import {createHmac,randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {openPasswordPolicy,checkPassword} from './password-policy.js';

const SESSION_COOKIE='__Host-ascend_session',FLOW_COOKIE='__Host-ascend_oauth';
const random=()=>randomBytes(32).toString('base64url');
export function accountConfig(env=process.env){
 const c={origin:env.ASCEND_ORIGIN,owner:env.ASCEND_GITHUB_OWNER,ownerId:env.ASCEND_GITHUB_OWNER_ID,repo:env.ASCEND_GITHUB_REPO,token:env.ASCEND_GITHUB_TOKEN,key:env.ASCEND_SYNC_KEY,clientId:env.ASCEND_GITHUB_CLIENT_ID,clientSecret:env.ASCEND_GITHUB_CLIENT_SECRET,sessionSecret:env.ASCEND_SESSION_SECRET};
 if(Object.entries(c).some(([k,v])=>!['clientId','clientSecret'].includes(k)&&(typeof v!=='string'||!v)))return null;
 try{if(new URL(c.origin).origin!==c.origin||!c.origin.startsWith('https://')||!/^\d+$/.test(c.ownerId)||!/^[-\w]+$/.test(c.owner)||!/^[-\w.]+$/.test(c.repo)||['.','..'].includes(c.repo)||Buffer.from(c.key,'base64').length!==32||Buffer.from(c.sessionSecret,'base64').length<32)return null;}catch{return null;}
 return {...c,passwordPolicy:openPasswordPolicy(c.key,env.ASCEND_PASSWORD_POLICY||undefined)};
}
export function signClaim(value,secret){const payload=Buffer.from(JSON.stringify(value)).toString('base64url');return `${payload}.${createHmac('sha256',secret).update(payload).digest('base64url')}`;}
export function verifyClaim(token,secret,purpose,now=Date.now()){
 try{if(typeof token!=='string'||token.length>5000)return null;const [payload,signature,extra]=token.split('.');if(extra||!payload||!signature)return null;const actual=Buffer.from(signature,'base64url'),expected=createHmac('sha256',secret).update(payload).digest();if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return null;const value=JSON.parse(Buffer.from(payload,'base64url'));if(value.purpose!==purpose||!Number.isSafeInteger(value.exp)||value.exp<=now||!Number.isSafeInteger(value.iat)||value.iat>now+30000)return null;return value;}catch{return null;}
}
function cookies(req){const values={};for(const item of String(req.headers?.cookie||'').split(';')){const at=item.indexOf('=');if(at>0){const name=item.slice(0,at).trim();if(values[name])return {};values[name]=item.slice(at+1).trim();}}return values;}
const cookie=(name,value,seconds)=>`${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${seconds}`;
function json(res,status,value){res.statusCode=status;res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value));}
function redirect(res,url){res.statusCode=303;res.setHeader('Location',url);res.end();}
function sameOrigin(req,c){return req.headers.origin===c.origin&&!['cross-site','same-site'].includes(req.headers['sec-fetch-site']);}
async function requestBody(req){if(req.body){const body=typeof req.body==='string'?req.body:JSON.stringify(req.body);if(Buffer.byteLength(body)>12000)throw Error();return JSON.parse(body);}let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>12000)throw Error();}return JSON.parse(data);}
async function githubJSON(url,options,transport){const r=await transport(url,{...options,redirect:'error',signal:AbortSignal.timeout(20000),headers:{Accept:'application/json',...options.headers}});if(!r.ok)throw Error('GitHub sign-in could not be completed.');return r.json();}

export function createAccountHandler({env=process.env,transport=fetch,now=Date.now}={}){
 const attempts=new Map();let activeChecks=0,windowStart=0,windowChecks=0;
 return async function handle(req,res){
  res.setHeader('Cache-Control','private, no-store, max-age=0');res.setHeader('Vary','Cookie');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  const c=accountConfig(env),url=new URL(req.url,'https://ascend.invalid'),mode=url.searchParams.get('mode')||(url.searchParams.has('code')||url.searchParams.has('error')?'callback':'session');
  if(!['GET','POST'].includes(req.method))return json(res,405,{error:'Method not allowed.'});
  if(!c)return json(res,mode==='session'?200:503,{configured:false,authenticated:false,error:mode==='session'?undefined:'Account sign-in has not been configured yet.'});
  const jar=cookies(req),session=verifyClaim(jar[SESSION_COOKIE],c.sessionSecret,'session',now());
  const authenticated=Boolean(session&&session.id===c.ownerId&&(session.auth!=='password'||session.policy===c.passwordPolicy?.version));
  const connection=()=>({format:'ascend-sync-connection-v1',owner:c.owner,repo:c.repo,token:c.token,key:c.key});
  function nativeReturn(challenge){const at=now(),ticket=signClaim({purpose:'native',id:c.ownerId,challenge,iat:at,exp:at+90000},c.sessionSecret);return redirect(res,'ascend://signin?ticket='+encodeURIComponent(ticket));}
  if(mode==='session'&&req.method==='GET')return json(res,200,{configured:true,passwordEnabled:Boolean(c.passwordPolicy),authenticated,...(authenticated?{user:{login:session.login}}:{})});
  if(mode==='password-login'&&req.method==='POST'){
   if(!sameOrigin(req,c)||req.headers['x-ascend-client']!=='web')return json(res,403,{error:'Open Ascend directly to sign in.'});
   if(!c.passwordPolicy)return json(res,503,{error:'Website sign-in is unavailable. Your saved data is preserved.'});
   const at=now(),identity=createHmac('sha256',c.sessionSecret).update(String(req.headers['x-real-ip']||req.socket?.remoteAddress||'unknown').slice(0,128)).digest('hex');
   for(const [key,value] of attempts)if(value.until<=at)attempts.delete(key);
   if(at-windowStart>=60000){windowStart=at;windowChecks=0;}
   const previous=attempts.get(identity),bucket=previous||{count:0,until:at+15*60000};
   if(bucket.count>=5||activeChecks>=3||windowChecks>=60){res.setHeader('Retry-After',String(bucket.count>=5?Math.max(1,Math.ceil((bucket.until-at)/1000)):60));return json(res,429,{error:'Too many sign-in attempts. Please wait before trying again.'});}
   if(attempts.size>=5000&&!previous){res.setHeader('Retry-After','60');return json(res,429,{error:'Please wait before trying again.'});}
   bucket.count++;attempts.set(identity,bucket);windowChecks++;activeChecks++;
   try{
    const body=await requestBody(req);
    if(!await checkPassword(body.password,c.passwordPolicy))return json(res,401,{error:'That password is incorrect.'});
    attempts.delete(identity);
    const claim=signClaim({purpose:'session',id:c.ownerId,login:c.owner,auth:'password',policy:c.passwordPolicy.version,nonce:random(),iat:at,exp:at+7*86400000},c.sessionSecret);
    res.setHeader('Set-Cookie',cookie(SESSION_COOKIE,claim,7*86400));
    return json(res,200,{authenticated:true,user:{login:c.owner},passwordVersion:c.passwordPolicy.version});
   }catch{return json(res,400,{error:'Sign-in could not be completed. Try again.'});}finally{activeChecks--;}
  }
  if(mode==='connection'&&req.method==='GET'){
   if(!authenticated)return json(res,401,{error:'Enter your website password to restore your workspace.'});
   if(req.headers['x-ascend-client']!=='web'||['cross-site','same-site'].includes(req.headers['sec-fetch-site']))return json(res,403,{error:'Open Ascend directly to connect your workspace.'});
   const at=now();res.setHeader('Set-Cookie',cookie(SESSION_COOKIE,signClaim({...session,iat:at,exp:at+7*86400000},c.sessionSecret),7*86400));
   return json(res,200,connection());
  }
  if(mode==='native-connection'&&req.method==='POST'){
   try{if(req.headers['x-ascend-client']!=='native')return json(res,403,{error:'Open sign-in from the Ascend app.'});const body=await requestBody(req),ticket=verifyClaim(body.ticket,c.sessionSecret,'native',now());if(!ticket||ticket.id!==c.ownerId||typeof body.verifier!=='string'||!/^[A-Za-z0-9_-]{43,128}$/.test(body.verifier)||createHash('sha256').update(body.verifier).digest('base64url')!==ticket.challenge)return json(res,401,{error:'Start sign-in again from the Ascend app.'});return json(res,200,connection());}catch{return json(res,400,{error:'Invalid sign-in request.'});}
  }
  if(mode==='login'&&req.method==='GET'){
   const native=url.searchParams.get('native')==='1',challenge=url.searchParams.get('challenge');
   if(native&&!/^[A-Za-z0-9_-]{43}$/.test(challenge||''))return json(res,400,{error:'Start sign-in from the Ascend app.'});
   if(authenticated&&native)return nativeReturn(challenge);
   if(authenticated)return redirect(res,c.origin+'/#sync');
   if(!native&&c.passwordPolicy)return redirect(res,c.origin+'/#home');
   if(!c.clientId||!c.clientSecret)return json(res,503,{error:'App account sign-in is unavailable.'});
   const state=random(),verifier=random(),at=now();
   const flow=signClaim({purpose:'oauth',state,verifier,...(native?{native:true,challenge}:{}),iat:at,exp:at+600000},c.sessionSecret);
   res.setHeader('Set-Cookie',cookie(FLOW_COOKIE,flow,600));
   const target=new URL('https://github.com/login/oauth/authorize');target.search=new URLSearchParams({client_id:c.clientId,redirect_uri:c.origin+'/api/account',state,code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',scope:''}).toString();
   return redirect(res,target.href);
  }
  if(mode==='callback'&&req.method==='GET'){
   const flow=verifyClaim(jar[FLOW_COOKIE],c.sessionSecret,'oauth',now());
   res.setHeader('Set-Cookie',cookie(FLOW_COOKIE,'',0));
   if(!flow||!url.searchParams.get('state')||flow.state!==url.searchParams.get('state')||!url.searchParams.get('code'))return redirect(res,c.origin+'/?account-error=signin#sync');
   try{
    const token=await githubJSON('https://github.com/login/oauth/access_token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:c.clientId,client_secret:c.clientSecret,code:url.searchParams.get('code'),redirect_uri:c.origin+'/api/account',code_verifier:flow.verifier}).toString()},transport);
    if(!token.access_token||token.error)throw Error('Invalid sign-in.');
    const user=await githubJSON('https://api.github.com/user',{headers:{Authorization:`Bearer ${token.access_token}`,'X-GitHub-Api-Version':'2022-11-28','User-Agent':'Ascend-private-workspace'}},transport);
    if(String(user.id)!==c.ownerId)return redirect(res,flow.native?'ascend://signin?error=owner':c.origin+'/?account-error=owner#sync');
    if(flow.native)return nativeReturn(flow.challenge);
    const at=now(),claim=signClaim({purpose:'session',id:String(user.id),login:String(user.login),nonce:random(),iat:at,exp:at+7*86400000},c.sessionSecret);
    res.setHeader('Set-Cookie',[cookie(FLOW_COOKIE,'',0),cookie(SESSION_COOKIE,claim,7*86400)]);
    return redirect(res,c.origin+'/#sync');
   }catch{return redirect(res,flow.native?'ascend://signin?error=signin':c.origin+'/?account-error=signin#sync');}
  }
  if(mode==='logout'&&req.method==='POST'){
   if(!sameOrigin(req,c))return json(res,403,{error:'Open Ascend directly to sign out.'});
   res.setHeader('Set-Cookie',[cookie(SESSION_COOKIE,'',0),cookie(FLOW_COOKIE,'',0)]);return json(res,200,{authenticated:false});
  }
  return json(res,405,{error:'Method not allowed.'});
 };
}

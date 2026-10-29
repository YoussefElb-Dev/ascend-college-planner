import {GitHubFile,fingerprint} from './sync-core.js';
import {escapeHTML as h,download} from './core.js';
import {accountSession,accountConnection,accountLogout} from './account.js';
import {accountSyncDecision} from './account-sync-model.js';

export function createDeviceSync(ctx){
 const storage='ascend.sync.connection.v1',accountStorage='ascend.sync.account.v1';
 let config=null,legacy=null,busy=false,pending=null,status='Connecting your workspace…',enabled=true,account={configured:false,authenticated:false},initializing=false;
 try{const old=JSON.parse(localStorage.getItem(storage)||'null');if(old)legacy={owner:old.owner,repo:old.repo,baseline:old.baseline,sha:old.sha,lastSync:old.lastSync};}catch{}
 const refresh=()=>{for(const el of document.querySelectorAll('[data-sync-status]'))el.textContent=status;if(!initializing&&location.hash==='#sync'&&!document.querySelector('dialog[open]'))ctx.render();};
 function persist(){const {owner,repo,baseline,sha,lastSync}=config;localStorage.setItem(accountStorage,JSON.stringify({owner,repo,baseline,sha,lastSync}));localStorage.removeItem(storage);legacy=null;}
 async function connectAccount(){
  account=await accountSession(true);
  if(account.authenticated){
   const next=await accountConnection();let meta=null;
   try{meta=JSON.parse(localStorage.getItem(accountStorage)||'null');}catch{}
   const prior=meta?.owner===next.owner&&meta?.repo===next.repo?meta:legacy?.owner===next.owner&&legacy?.repo===next.repo?legacy:null;
   config={...next,...(prior?{baseline:prior.baseline,sha:prior.sha,lastSync:prior.lastSync}:{})};
  }else{if(!account.offline)config=null;status=account.offline?'Offline · edits are saved on this device.':account.configured?'Connect GitHub once. Your password will then open and sync this browser automatically.':'Account sync is unavailable. Your saved workspace is preserved.';}
 }
 async function sync(choice=''){
  if(busy||!enabled||ctx.isLocked())return;
  busy=true;status='Syncing your workspace…';refresh();
  try{
   if(!config)await connectAccount();
   if(!config)return;
   const api=new GitHubFile(config);await api.verify();
   const local=structuredClone(ctx.getState()),localHash=await fingerprint(local),fresh=ctx.isFreshDevice?.()===true,remote=await api.read();
   if(!remote){config.sha=await api.write(local);config.baseline=localHash;pending=null;}
   else{
    if(choice&&pending?.remote&&(pending.remote.sha!==remote.sha||pending.localHash!==localHash)){pending={remote,localHash};status='A copy changed after review. Review both versions again.';return;}
    const remoteHash=await fingerprint(remote.workspace),decision=choice||accountSyncDecision(localHash,remoteHash,config.baseline,fresh);
    if(decision==='conflict'){pending={remote,localHash};status='Both devices have changes. Review the two versions below.';return;}
    if(decision==='pull'){
     if(await fingerprint(ctx.getState())!==localHash){status='New local edits detected. Sync again.';return;}
     if(!ctx.applyRemote(remote.workspace))throw Error('The cloud workspace could not be saved locally. Your current copy is preserved.');
     config.baseline=remoteHash;config.sha=remote.sha;
    }else if(decision==='push'){config.sha=await api.write(local,remote.sha);config.baseline=localHash;}
    else{config.baseline=localHash;config.sha=remote.sha;}
    pending=null;
   }
   config.lastSync=new Date().toISOString();persist();status='Up to date';
  }catch(e){status=navigator.onLine===false?'Offline · edits are saved here and will sync when you reconnect.':e.message||'Sync failed. Your saved workspace is preserved.';if(e.status===409||e.status===422)pending={retry:true};}
  finally{busy=false;refresh();}
 }
 async function initialize(){initializing=true;try{await connectAccount();await sync();}catch(e){status=e.message||'Your saved copy is available. Reconnect from Device sync.';}finally{initializing=false;}}
 function page(){
  const counts=w=>`${w.applications.length} applications · ${w.tasks.length} tasks · ${(w.events||[]).length} events`;
  return ctx.header('Your workspace, everywhere','Open Ascend, enter your password, and pick up where you left off.')+
   `<section class="panel"><h2 data-sync-status>${h(status)}</h2><p>${account.authenticated?`Connected to <strong>${h(account.user.login)}</strong>. Your applications, documents, and plans stay together across your devices.`:'Link this browser to your GitHub account once. After that, your website password opens the workspace and starts syncing automatically.'}</p>${config?.lastSync?`<p>Last synced ${h(new Date(config.lastSync).toLocaleString())}</p>`:''}<div class="button-group">${account.configured&&!account.authenticated?'<a class="btn primary" href="/api/account?mode=login">Connect GitHub once</a>':''}${config?ctx.btn('Sync now','cloud-now','primary'):''}${account.authenticated?ctx.btn('Sign out of this browser','cloud-signout','secondary'):''}</div><p class="body-copy">Edits sync after about 15 seconds while Ascend is open. Open devices check for updates every minute. Offline changes stay saved here and sync when you reconnect. If both copies change, you choose which one to keep.</p><p class="body-copy">Your workspace is encrypted in your private GitHub repository. No connection files, tokens, or keys to transfer.</p></section>`+
   (pending?.remote?`<section class="panel sync-conflict"><h2>Choose which workspace to keep</h2><p>This device: ${counts(ctx.getState())}</p><p>Cloud: ${counts(pending.remote.workspace)}</p><p>Both copies are preserved until you choose. Save backups if each contains edits you need.</p><div class="button-group">${ctx.btn('Download this device backup','cloud-backup-local','secondary')}${ctx.btn('Download cloud backup','cloud-backup-remote','secondary')}</div><div class="button-group">${ctx.btn('Use cloud workspace on this device','cloud-use-remote','primary')}${ctx.btn('Replace cloud with this device','cloud-use-local','secondary')}</div></section>`:'');
 }
 async function handle(key){
  if(!key.startsWith('cloud-'))return false;if(busy){ctx.toast('Wait for the current sync to finish.');return true;}
  switch(key){
   case 'cloud-now':await sync();break;
   case 'cloud-signout':await accountLogout();config=null;legacy=null;account={...account,authenticated:false};pending=null;localStorage.removeItem(storage);status='Signed out. Your local copy is preserved.';ctx.lock?.();break;
   case 'cloud-backup-local':download('ascend-device-before-sync.json',JSON.stringify(ctx.getState(),null,2),'application/json');break;
   case 'cloud-backup-remote':if(pending?.remote)download('ascend-cloud-before-sync.json',JSON.stringify(pending.remote.workspace,null,2),'application/json');break;
   case 'cloud-use-remote':case 'cloud-use-local':{const choice=key==='cloud-use-remote'?'pull':'push';ctx.formDialog('Confirm workspace replacement','<p>The complete '+(choice==='pull'?'workspace on this device':'encrypted cloud workspace')+' will be replaced. Download both backups first if needed.</p>',async()=>{await sync(choice);setTimeout(()=>ctx.render(),0);return !pending;},'Replace workspace');break;}
   default:return false;
  }return true;
 }
 let debounce;
 return {page,handle,sync,initialize,changed:()=>{clearTimeout(debounce);debounce=setTimeout(()=>{if(!pending)sync();},15000);},start:()=>{setInterval(()=>{if(!document.hidden&&!pending)sync();},60000);window.addEventListener('online',async()=>{try{await connectAccount();await sync();}catch(e){status=e.message;refresh();}});window.addEventListener('ascend:unlock',()=>sync());},setEnabled:v=>{enabled=v;}};
}

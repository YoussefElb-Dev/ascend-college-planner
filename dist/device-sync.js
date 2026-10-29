import {GitHubFile,fingerprint,newSyncKey,validateConnection} from './sync-core.js';
import {escapeHTML as h,download} from './core.js';
import {accountSession,accountConnection,accountLogout} from './account.js';
import {accountSyncDecision} from './account-sync-model.js';

export function createDeviceSync(ctx){
 const storage='ascend.sync.connection.v1',accountStorage='ascend.sync.account.v1';
 let config=null,legacy=null,busy=false,pending=null,status='Checking sign-in…',enabled=true,mode='legacy',account={configured:false,authenticated:false},initializing=false;
 try{legacy=JSON.parse(localStorage.getItem(storage)||'null');if(legacy)validateConnection(legacy);config=legacy;}catch{legacy=null;config=null;}
 const refresh=()=>{for(const el of document.querySelectorAll('[data-sync-status]'))el.textContent=status;if(!initializing&&location.hash==='#sync'&&!document.querySelector('dialog[open]'))ctx.render();};
 function persist(){
  if(mode==='account'){
   const {owner,repo,baseline,sha,lastSync}=config;
   localStorage.setItem(accountStorage,JSON.stringify({owner,repo,baseline,sha,lastSync}));
   localStorage.removeItem(storage);legacy=null;
  }else localStorage.setItem(storage,JSON.stringify(config));
 }
 async function connectAccount(){
  account=await accountSession(true);
  if(account.authenticated){
   const next=validateConnection(await accountConnection());let meta=null;
   try{meta=JSON.parse(localStorage.getItem(accountStorage)||'null');}catch{}
   const prior=meta?.owner===next.owner&&meta?.repo===next.repo?meta:legacy?.owner===next.owner&&legacy?.repo===next.repo?legacy:null;
   config={...next,...(prior?{baseline:prior.baseline,sha:prior.sha,lastSync:prior.lastSync}:{})};mode='account';
  }else{if(mode==='account'&&!account.offline)config=null;if(!config)status=account.offline?'Offline · your saved copy is available on this device.':account.configured?'Sign in with GitHub to restore your workspace.':'Private sync is not connected.';}
 }
 async function sync(choice=''){
  if(busy||!enabled||ctx.isLocked())return;
  busy=true;status='Checking encrypted workspace…';refresh();
  try{
   if(!config)await connectAccount();
   if(!config){refresh();return;}
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
  }catch(e){status=navigator.onLine===false?'Offline · edits are saved on this device and will sync when you reconnect.':e.message||'Sync failed. Your local records are preserved.';if(e.status===409||e.status===422)pending={retry:true};}
  finally{busy=false;refresh();}
 }
 async function initialize(){initializing=true;try{await connectAccount();await sync();}catch(e){status=e.message||'Your saved copy is available. Reconnect from Device sync.';}finally{initializing=false;}}
 const signin=()=>'<a class="btn primary" href="/api/account?mode=login">Sign in with GitHub</a>';
 function page(){
  const counts=w=>`${w.applications.length} applications · ${w.tasks.length} tasks · ${(w.events||[]).length} events`;
  return ctx.header('Your synced workspace','Open Ascend anywhere, sign in, and pick up where you left off.')+
   `<section class="panel"><h2 data-sync-status>${h(status)}</h2><p>${mode==='account'&&account.authenticated?`Signed in as <strong>${h(account.user.login)}</strong>. Your encrypted workspace is saved in your private GitHub repository.`:config?'This device is connected to your private workspace. Sign in with GitHub to open it on other browsers without a connection file.':'Sign in with your GitHub account to load your saved applications, documents, and planner on this browser.'}</p>${config?.lastSync?`<p>Last synced ${h(new Date(config.lastSync).toLocaleString())}</p>`:''}<div class="button-group">${account.configured&&!account.authenticated?signin():''}${config?ctx.btn('Sync now','cloud-now','primary'):''}${account.authenticated?ctx.btn('Sign out of sync','cloud-signout','secondary'):''}${!account.configured&&!config?ctx.btn('Connect this device','cloud-setup','primary')+ctx.btn('Import existing connection','cloud-import','secondary'):''}</div><p class="body-copy">Saved edits sync after about 15 seconds while Ascend is open, and open devices check for changes every minute. Offline edits stay on this browser and sync when it reconnects. If two devices change independently, Ascend asks which copy to keep.</p><p class="body-copy">Only your GitHub account can restore this workspace. The private repository stores encrypted data. On browsers connected through sign-in, connection credentials stay in memory; signing out disconnects this browser and keeps its local copy behind the device lock.</p></section>`+
   (pending?.remote?`<section class="panel sync-conflict"><h2>Choose which workspace to keep</h2><p>This device: ${counts(ctx.getState())}</p><p>Cloud: ${counts(pending.remote.workspace)}</p><p>Both copies are preserved until you choose. Save backups if each contains edits you need.</p><div class="button-group">${ctx.btn('Download this device backup','cloud-backup-local','secondary')}${ctx.btn('Download cloud backup','cloud-backup-remote','secondary')}</div><div class="button-group">${ctx.btn('Use cloud workspace on this device','cloud-use-remote','primary')}${ctx.btn('Replace cloud with this device','cloud-use-local','secondary')}</div></section>`:'')+
   `<details class="panel"><summary>Other connection options</summary><p class="body-copy">Your existing native iPhone app can continue using its saved connection to the same encrypted workspace. Account sign-in restores the website on new browsers without a file.</p><div class="button-group">${config?ctx.btn('Export native app connection','cloud-export','secondary'):''}${ctx.btn('Manual connection','cloud-setup','ghost')}${ctx.btn('Import connection','cloud-import','ghost')}</div><input type="file" id="sync-connection-file" accept=".json" hidden><p class="body-copy">An exported native connection contains private credentials. Workspace backups do not include those credentials.</p></details>`;
 }
 function setup(){ctx.formDialog('Connect private sync',ctx.field('GitHub owner','owner','YoussefElb-Dev','text','required autocomplete="off"')+ctx.field('Private repository','repo','ascend-private-sync','text','required autocomplete="off"')+ctx.field('Fine-grained GitHub token','token','','password','required autocomplete="off"')+ctx.field('Existing sync key','key','','password','autocomplete="off"')+'<p class="full-width body-copy">Use the original key for an existing workspace. A replacement key cannot decrypt its history.</p>',async v=>{if(busy)throw Error('Wait for the current sync to finish.');busy=true;try{const next={format:'ascend-sync-connection-v1',owner:v.owner.trim(),repo:v.repo.trim(),token:v.token.trim(),key:v.key.trim()||newSyncKey()};validateConnection(next);await new GitHubFile(next).verify();mode='legacy';config=next;persist();status='Connected. Choose Sync now.';ctx.render();}finally{busy=false;}},'Save connection');}
 async function handle(key){
  if(!key.startsWith('cloud-'))return false;if(busy){ctx.toast('Wait for the current sync to finish.');return true;}
  switch(key){
   case 'cloud-now':await sync();break;
   case 'cloud-signout':await accountLogout();config=null;legacy=null;mode='legacy';account={...account,authenticated:false};pending=null;localStorage.removeItem(storage);status='Signed out. Your local copy is preserved.';ctx.lock?.();break;
   case 'cloud-setup':setup();break;
   case 'cloud-disconnect':localStorage.removeItem(storage);config=null;legacy=null;pending=null;status='Disconnected. Your saved copies remain.';ctx.render();break;
   case 'cloud-export':if(config)download('ascend-private-device-connection.json',JSON.stringify({...config,baseline:undefined,sha:undefined,lastSync:undefined},null,2),'application/json');break;
   case 'cloud-import':document.querySelector('#sync-connection-file')?.click();break;
   case 'cloud-backup-local':download('ascend-device-before-sync.json',JSON.stringify(ctx.getState(),null,2),'application/json');break;
   case 'cloud-backup-remote':if(pending?.remote)download('ascend-cloud-before-sync.json',JSON.stringify(pending.remote.workspace,null,2),'application/json');break;
   case 'cloud-use-remote':case 'cloud-use-local':{const choice=key==='cloud-use-remote'?'pull':'push';ctx.formDialog('Confirm workspace replacement','<p>The complete '+(choice==='pull'?'workspace on this device':'encrypted cloud workspace')+' will be replaced. Download both backups first if needed.</p>',async()=>{await sync(choice);setTimeout(()=>ctx.render(),0);return !pending;},'Replace workspace');break;}
   default:return false;
  }return true;
 }
 document.addEventListener('change',async e=>{if(e.target.id!=='sync-connection-file'||!e.target.files[0])return;if(busy){ctx.toast('Wait for sync to finish.');return;}busy=true;try{const f=e.target.files[0];if(f.size>16000)throw Error('Choose an Ascend connection file.');const next=JSON.parse(await f.text());if(next.format!=='ascend-sync-connection-v1')throw Error('This is not an Ascend connection.');validateConnection(next);await new GitHubFile(next).verify();config=next;mode='legacy';persist();pending=null;status='Connection imported. Choose Sync now.';ctx.render();}catch(e){ctx.toast(e.message);}finally{busy=false;}});
 let debounce;
 return {page,handle,sync,initialize,changed:()=>{clearTimeout(debounce);debounce=setTimeout(()=>{if(!pending)sync();},15000);},start:()=>{setInterval(()=>{if(!document.hidden&&!pending)sync();},60000);window.addEventListener('online',async()=>{try{await connectAccount();await sync();}catch(e){status=e.message;refresh();}});window.addEventListener('ascend:unlock',()=>sync());},setEnabled:v=>{enabled=v;}};
}

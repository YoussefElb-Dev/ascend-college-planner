import {passwordLogin} from './account.js';
import {offlineVerifier,verifyOfflinePassword} from './password-lock-model.js';
const verifierStorage='ascend.lock.offline.v2';
const themeStorage='ascend.theme.v1';
let locked=true,timer,resolveReady;
export const privacyReady=new Promise(resolve=>resolveReady=resolve);
export const isPrivacyLocked=()=>locked;
function applyInitialTheme(){
 let pref='';
 try{
  pref=localStorage.getItem(themeStorage)||'';
  if(!pref){const raw=localStorage.getItem('ascend.workspace.v1');if(raw)pref=JSON.parse(raw)?.profile?.theme||'';}
 }catch{}
 const resolved=pref==='dark'||pref==='monochrome'||pref==='light'?pref:(pref==='system'||!pref)?(matchMedia?.('(prefers-color-scheme: dark)').matches?'dark':'light'):'light';
 document.documentElement.dataset.theme=resolved;
 document.documentElement.style.colorScheme=resolved==='dark'?'dark':'light';
 const meta=document.querySelector('meta[name="theme-color"]');
 if(meta)meta.content=resolved==='dark'?'#1b1a24':resolved==='monochrome'?'#f4f4f4':'#f5f4f8';
}
export function lockWorkspace(){
 locked=true;clearTimeout(timer);
 applyInitialTheme();
 document.title='Ascend — Private workspace';
 const toasts=document.getElementById('toasts');
 if(toasts&&typeof toasts.hidePopover==='function'){try{toasts.hidePopover();}catch{}}
 for(const id of ['dialogs','print-root','toasts'])document.getElementById(id)?.replaceChildren();
 document.body.classList.add('workspace-locked');
 document.getElementById('app').innerHTML=`<main class="privacy-screen"><form id="privacy-unlock" class="panel"><img src="./assets/ascend-mark.png" alt="Ascend" width="64" height="64"><span class="eyebrow">YOUR PRIVATE WORKSPACE</span><h1>Welcome back.</h1><p>Your next chapter, wherever you are.</p><label class="field"><span>Website password</span><input name="password" type="password" autocomplete="current-password" required maxlength="128" autofocus></label><p id="privacy-error" role="alert"></p><button type="submit" class="btn primary">Open workspace →</button><div class="account-access"><p class="body-copy">One password. Your applications and plans, automatically in sync.</p></div><small>${navigator.onLine===false?'You’re offline. A recently verified password can open your saved copy.':'Your password is checked securely before your private workspace loads.'}</small></form></main>`;
 document.getElementById('privacy-unlock').addEventListener('submit',unlock);document.querySelector('#privacy-unlock input')?.focus();window.dispatchEvent(new Event('ascend:lock'));
}
function finishUnlock(){locked=false;document.body.classList.remove('workspace-locked');resolveReady();arm();window.dispatchEvent(new Event('ascend:unlock'));}
function arm(){clearTimeout(timer);if(!locked)timer=setTimeout(lockWorkspace,5*60*1000);}
async function offlineUnlock(password){let record;try{record=JSON.parse(localStorage.getItem(verifierStorage)||'null');}catch{}if(!await verifyOfflinePassword(password,record))throw Error('Connect to the internet to verify your password and restore your workspace.');}
async function unlock(event){
 event.preventDefault();const button=event.target.querySelector('button[type=submit]'),label=button.textContent;button.disabled=true;button.textContent='Checking…';document.getElementById('privacy-error').textContent='';
 try{
  const until=Number(localStorage.getItem('ascend.lock.until')||0);if(Date.now()<until)throw Error('Please wait '+Math.ceil((until-Date.now())/1000)+' seconds before trying again.');
  const password=new FormData(event.target).get('password');
  if(navigator.onLine===false)await offlineUnlock(password);
  else{try{const session=await passwordLogin(password);try{localStorage.setItem(verifierStorage,JSON.stringify(await offlineVerifier(password,session.passwordVersion)));}catch{}}catch(error){if(error?.offlineFallback||['TypeError','TimeoutError','AbortError'].includes(error?.name))await offlineUnlock(password);else{if(error.status===401){const failures=Number(localStorage.getItem('ascend.lock.failures')||0)+1;localStorage.setItem('ascend.lock.failures',String(failures));if(failures%5===0)localStorage.setItem('ascend.lock.until',String(Date.now()+30000));}if(error.retryAfter)localStorage.setItem('ascend.lock.until',String(Date.now()+error.retryAfter*1000));throw error;}}}
  localStorage.removeItem('ascend.lock.failures');localStorage.removeItem('ascend.lock.until');finishUnlock();
 }catch(error){const errEl=document.getElementById('privacy-error');if(errEl)errEl.textContent=error?.message||'Sign-in did not finish. Try again.';}finally{button.disabled=false;button.textContent=label;}
}
document.addEventListener('pointerdown',arm,{passive:true});document.addEventListener('keydown',arm);let hiddenAt=0;document.addEventListener('visibilitychange',()=>{if(document.hidden){hiddenAt=Date.now();}else{const elapsed=hiddenAt?Date.now()-hiddenAt:0;hiddenAt=0;if(!locked&&elapsed>=5*60*1000)lockWorkspace();}});
lockWorkspace();

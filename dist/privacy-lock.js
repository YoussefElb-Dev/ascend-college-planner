import {passwordLogin} from './account.js';
import {offlineVerifier,verifyOfflinePassword} from './password-lock-model.js';
const verifierStorage='ascend.lock.offline.v2';
let locked=true,timer,resolveReady;
export const privacyReady=new Promise(resolve=>resolveReady=resolve);
export const isPrivacyLocked=()=>locked;
export function lockWorkspace(){
 locked=true;clearTimeout(timer);for(const id of ['dialogs','print-root','toasts'])document.getElementById(id)?.replaceChildren();
 document.body.classList.add('workspace-locked');
 document.getElementById('app').innerHTML=`<main class="privacy-screen"><form id="privacy-unlock" class="panel"><img src="./assets/ascend-mark.png" alt="Ascend" width="64" height="64"><span class="eyebrow">YOUR PRIVATE WORKSPACE</span><h1>Welcome back.</h1><p>Your next chapter, wherever you are.</p><label class="field"><span>Website password</span><input name="password" type="password" inputmode="numeric" autocomplete="current-password" required maxlength="128" autofocus></label><p id="privacy-error" role="alert"></p><button type="submit" class="btn primary">Open workspace →</button><div class="account-access"><p class="body-copy">One password. Your applications and plans, automatically in sync.</p></div><small>${navigator.onLine===false?'You’re offline. A recently verified password can open your saved copy.':'Your password is checked securely before your private workspace loads.'}</small></form></main>`;
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
  else{try{const session=await passwordLogin(password);try{localStorage.setItem(verifierStorage,JSON.stringify(await offlineVerifier(password,session.passwordVersion)));}catch{}}catch(error){if(['TypeError','TimeoutError','AbortError'].includes(error.name))await offlineUnlock(password);else{if(error.status===401){const failures=Number(localStorage.getItem('ascend.lock.failures')||0)+1;localStorage.setItem('ascend.lock.failures',String(failures));if(failures%5===0)localStorage.setItem('ascend.lock.until',String(Date.now()+30000));}if(error.retryAfter)localStorage.setItem('ascend.lock.until',String(Date.now()+error.retryAfter*1000));throw error;}}}
  localStorage.removeItem('ascend.lock.failures');localStorage.removeItem('ascend.lock.until');finishUnlock();
 }catch(error){document.getElementById('privacy-error').textContent=error.message;}finally{button.disabled=false;button.textContent=label;}
}
document.addEventListener('pointerdown',arm,{passive:true});document.addEventListener('keydown',arm);let hiddenAt=0;document.addEventListener('visibilitychange',()=>{if(document.hidden)hiddenAt=Date.now();else if(hiddenAt&&Date.now()-hiddenAt>=5*60*1000)lockWorkspace();});
lockWorkspace();

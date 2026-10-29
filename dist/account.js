let cached=null;
async function privateResponseWorker(){
 if(!('serviceWorker' in navigator))return;
 const registration=await navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'});await registration.update();
 const next=registration.installing||registration.waiting;if(!next||next.state==='activated')return;
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>{next.removeEventListener('statechange',check);reject(Error('The offline app is updating. Reload Ascend and sign in again.'));},35000);function check(){if(next.state==='activated'){clearTimeout(timeout);next.removeEventListener('statechange',check);resolve();}else if(next.state==='redundant'){clearTimeout(timeout);next.removeEventListener('statechange',check);reject(Error('The offline update did not finish. Reload Ascend.'));}}next.addEventListener('statechange',check);check();});
}
export async function accountSession(refresh=false){
 if(cached&&!refresh)return cached;
 try{const r=await fetch('/api/account?mode=session',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(10000),headers:{'X-Ascend-Client':'web'}});if(!r.ok)return {configured:false,authenticated:false};const s=await r.json();if(typeof s.configured!=='boolean')throw Error();cached=s;return s;}catch{return {configured:false,authenticated:false,offline:!navigator.onLine};}
}
export async function accountConnection(){await privateResponseWorker();const r=await fetch('/api/account?mode=connection',{credentials:'same-origin',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{'X-Ascend-Client':'web'}});if(!r.ok){const e=Error(r.status===401?'Sign in with GitHub again to reconnect this browser.':'Your account connection is unavailable. Your saved workspace is preserved.');e.status=r.status;throw e;}return r.json();}
export async function accountLogout(){const r=await fetch('/api/account?mode=logout',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'X-Ascend-Client':'web'}});if(!r.ok)throw Error('Sign-out did not finish. Try again while online.');cached=null;}

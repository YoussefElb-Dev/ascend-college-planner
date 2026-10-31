const iterations=210000;
const hex=bytes=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
async function digest(password,salt){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 return hex(new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:Uint8Array.from(salt.match(/../g),pair=>parseInt(pair,16)),iterations},key,256)));
}
export async function offlineVerifier(password,version,now=Date.now()){
 const salt=hex(crypto.getRandomValues(new Uint8Array(16)));
 return {v:2,salt,hash:await digest(password,salt),version,expiresAt:now+7*86400000};
}
export async function verifyOfflinePassword(password,record,now=Date.now()){
 if(!record||record.v!==2||typeof password!=='string'||password.length>128||!Number.isSafeInteger(record.expiresAt)||record.expiresAt<=now||record.expiresAt>now+7*86400000||!/^([a-f0-9]{32})$/.test(record.salt)||!/^([a-f0-9]{64})$/.test(record.hash))return false;
 const actual=await digest(password,record.salt);let difference=0;for(let i=0;i<actual.length;i++)difference|=actual.charCodeAt(i)^record.hash.charCodeAt(i);return difference===0;
}

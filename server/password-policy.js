import {createCipheriv,createDecipheriv,createHash,hkdfSync,randomBytes,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';

const derive=promisify(scrypt);
const aad=Buffer.from('ascend-password-policy-v1');
const options={N:32768,r:8,p:1,maxmem:64*1024*1024};
// Sealed with a purpose-specific key derived from the existing server secret.
// Neither the password nor its verifier is published in the source repository.
export const SEALED_PASSWORD_POLICY='LeF-4StorrMqyg9rezvIx2rEBngfkjLp7Unu6OOCiQy1XhbevM97rpeI6yXc2DliLYmbBXg2L1dhWasCBeZtwRIZObjSaCYfs10-w41TUmZdrZkztlJAGAkOUd2JIJ0pW3-MMkS3VHCiR0m8dcSlIy2-bX37e4MQ63sX';
const sealingKey=key=>hkdfSync('sha256',Buffer.from(key,'base64'),Buffer.from('ascend-auth-policy'),aad,32);
export async function sealPasswordPolicy(password,key){
 if(typeof password!=='string'||password.length<8||password.length>128||Buffer.from(key,'base64').length!==32)throw Error('Invalid password policy.');
 const salt=randomBytes(16),hash=await derive(password,salt,32,options),iv=randomBytes(12);
 const cipher=createCipheriv('aes-256-gcm',sealingKey(key),iv);cipher.setAAD(aad);
 const encrypted=Buffer.concat([cipher.update(JSON.stringify({v:1,salt:salt.toString('base64'),hash:hash.toString('base64')}),'utf8'),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');
}
export function openPasswordPolicy(key,sealed=SEALED_PASSWORD_POLICY){
 try{
  const bytes=Buffer.from(sealed,'base64url');if(bytes.length<40||bytes.length>2048)return null;
  const decipher=createDecipheriv('aes-256-gcm',sealingKey(key),bytes.subarray(0,12));decipher.setAAD(aad);decipher.setAuthTag(bytes.subarray(12,28));
  const policy=JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8'));
  if(policy.v!==1||Buffer.from(policy.salt,'base64').length!==16||Buffer.from(policy.hash,'base64').length!==32)return null;
  return {...policy,version:createHash('sha256').update(sealed).digest('base64url')};
 }catch{return null;}
}
export async function checkPassword(password,policy){
 if(!policy||typeof password!=='string'||password.length<1||password.length>128)return false;
 const actual=await derive(password,Buffer.from(policy.salt,'base64'),32,options);
 return timingSafeEqual(actual,Buffer.from(policy.hash,'base64'));
}

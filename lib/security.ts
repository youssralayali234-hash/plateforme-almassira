import {getToken} from 'next-auth/jwt';
import bcrypt from 'bcryptjs';
import {read} from './db';
export const hash=(s:string)=>bcrypt.hash(s,12);
export const verify=(s:string,h:string)=>bcrypt.compare(s,h);
export async function authenticated(r:Request){
 try{
  const tok=await getToken({req:r as any,secret:process.env.NEXTAUTH_SECRET||process.env.AUTH_SECRET});
  if(!tok?.sub)return null;
  const u=(await read('users')).find(x=>x.id===tok.sub);
  return u&&u.role===(tok as any).role?u:null;
 }catch{return null;}
}
export const safeUser=(u:any)=>{const {password_hash,parent_code_hash,...rest}=u;return rest;};
export const safeStudent=(u:any)=>{const {parent_code_hash,student_code_hash,...rest}=u;return rest;};
export const norm=(x:any)=>String(x??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('fr');
export const studentName=(s:any)=>`${s.first_name||''} ${s.last_name||''}`.trim()||s.full_name||'';

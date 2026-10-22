import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import {read} from '../../../../lib/db';
import {verify,norm,safeUser} from '../../../../lib/security';
const handler=NextAuth({secret:process.env.NEXTAUTH_SECRET||process.env.AUTH_SECRET,providers:[CredentialsProvider({name:'AL MASSIRA',credentials:{identifier:{label:'Identifiant',type:'text'},password:{label:'Mot de passe',type:'password'}},async authorize(c){const u=(await read('users')).find(x=>norm(x.identifier)===norm(c?.identifier)&&['admin','teacher'].includes(x.role));if(!u||!await verify(c?.password||'',u.password_hash||''))return null;return {id:u.id,name:u.name||u.identifier,email:u.identifier,role:u.role} as any;}})],session:{strategy:'jwt'},callbacks:{jwt({token,user}){if(user)(token as any).role=(user as any).role;return token;},session({session,token}){(session.user as any).role=(token as any).role;return session;}}});
export {handler as GET,handler as POST};

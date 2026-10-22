import {NextRequest,NextResponse} from 'next/server';
import {createClient} from '@supabase/supabase-js';
import {authenticated} from '../../../lib/security';
import {read} from '../../../lib/db';
export const runtime='nodejs';
export async function GET(req:NextRequest,{params}:{params:Promise<{filename:string}>}){
 const user=await authenticated(req);if(!user||!['admin','teacher'].includes(user.role))return new Response('Connexion requise',{status:401});
 const {filename}=await params;if(!/^[a-f0-9-]{36}\.(pdf|png|jpe?g|webp|pptx?)$/i.test(filename))return new Response('Fichier introuvable',{status:404});
 const courses=await read('courses');const linked=courses.some(c=>String(c.file_url||'')==='/uploads/'+filename&&(user.role==='admin'||c.created_by===user.id));
 if(!linked)return new Response('Accès interdit',{status:403});
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)return new Response('Stockage non configuré',{status:503});
 const store=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}).storage.from(process.env.SUPABASE_STORAGE_BUCKET||'almassira-documents');
 const {data,error}=await store.download(filename);if(error||!data)return new Response('Fichier introuvable',{status:404});
 return new NextResponse(data.stream(),{headers:{'Content-Type':data.type||'application/octet-stream','Cache-Control':'private, max-age=60','X-Content-Type-Options':'nosniff'}});
}

import {NextRequest,NextResponse} from 'next/server';
import {read,insert,update,remove,collections} from '../../../lib/db';
import {authenticated,hash,verify,norm,safeStudent,safeUser,studentName} from '../../../lib/security';
import {PDFDocument,rgb} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createClient} from '@supabase/supabase-js';
export const runtime='nodejs';
const response=(data:any,status=200)=>NextResponse.json(data,{status});
const error=(detail:string,status=400)=>response({detail},status);
const normRole=(x:any)=>['admin','teacher','student','parent'].includes(x);
const documentStore=()=>{if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error('Stockage Supabase non configuré');return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}}).storage.from(process.env.SUPABASE_STORAGE_BUCKET||'almassira-documents')};
const check=(u:any,roles:string[])=>!!u&&roles.includes(u.role);
const teacherOwns=(u:any,item:any)=>u.role==='admin'||(u.role==='teacher'&&item.created_by===u.id);
const allowedClass=(target:any,student:any)=>!target?.class_name||norm(target.class_name)===norm('Toutes les classes')||norm(target.class_name)===norm(student?.class_name);
const accessibleAssessment=async(u:any,id:string)=>{const assessment=(await read('assessments')).find(a=>a.id===id);return assessment&&teacherOwns(u,assessment)?assessment:null;};

async function serve(req:NextRequest,parts:string[],method:string){
 const [first,second,third]=parts;
 try{
 if(method==='GET'&&first==='health')return response({ok:true,storage:'supabase-postgresql',app:'AL MASSIRA'});
 if(method==='GET'&&first==='public'&&second==='assessments')return response((await read('assessments')).filter(x=>x.published).map(x=>({id:x.id,title:x.title||'Évaluation',description:x.description||'',class_name:x.class_name||'',kind:x.kind||'exam',questions:(x.questions||[]).map((q:any)=>({id:q.id,type:q.type,text:q.text,options:q.options||[],points:q.points||1}))})));
 if(method==='GET'&&first==='public'&&second==='courses')return response((await read('courses')).filter(x=>x.published).map(x=>Object.fromEntries(['id','title','description','class_name','content'].map(k=>[k,x[k]]))));
 if(method==='POST'&&first==='public'&&second==='submit'){
  const b=await req.json(), a=(await read('assessments')).find(x=>x.id===b.assessment_id&&x.published);
  if(!a)return error('Évaluation indisponible',404);
  const name=String(b.full_name||'').trim(),cls=String(b.class_name||'').trim(),number=String(b.student_number||'').trim();
  const student=(await read('students')).find(st=>norm(studentName(st))===norm(name)&&norm(st.class_name)===norm(cls)&&norm(st.student_number)===norm(number));
  if(!student?.student_code_hash||!await verify(String(b.student_code||''),student.student_code_hash))return error('Identité ou code élève incorrect',401);
  if(name.length<3||!cls||!number)return error('Identité incomplète',422);
  if(!allowedClass(a,student))return error('Cette évaluation est réservée à une autre classe');
  const subs=await read('submissions');if(subs.some(s=>s.assessment_id===a.id&&norm(s.class_name)===norm(cls)&&norm(s.student_number)===norm(number)))return error('Une copie existe déjà pour ce numéro et cette classe',409);
  let score=0,total=0,manual=false;const answers=b.answers||{};
  for(const q of a.questions||[]){const p=Math.max(0,Number(q.points)||0);total+=p;if(['mcq','truefalse','short'].includes(q.type)){if(String(answers[q.id]||'').trim()&&norm(answers[q.id])===norm(q.correct))score+=p;}else manual=true;}
  const submission=await insert('submissions',{student_id:student.id,assessment_id:a.id,assessment_title:a.title,full_name:name,class_name:cls,student_number:number,answers,score,total,needs_manual_grading:manual,submitted_at:new Date().toISOString()});return response({ok:true,id:submission.id,message:'Copie enregistrée'});
 }
 if(method==='POST'&&first==='parent'&&second==='access'){
  const b=await req.json();const st=(await read('students')).filter(x=>norm(studentName(x))===norm(b.full_name)&&norm(x.class_name)===norm(b.class_name)&&norm(x.student_number||x.number)===norm(b.student_number));
  if(st.length!==1||!st[0].parent_code_hash||!await verify(String(b.parent_code||''),st[0].parent_code_hash))return error('Informations ou code incorrects',401);
  const a=await read('assessments'),sub=await read('submissions');const results=sub.filter(x=>x.student_id===st[0].id||(norm(x.full_name)===norm(b.full_name)&&norm(x.class_name)===norm(b.class_name)&&norm(x.student_number)===norm(b.student_number))).map(x=>({id:x.id,assessment_title:x.assessment_title||a.find(z=>z.id===x.assessment_id)?.title||'Évaluation',kind:a.find(z=>z.id===x.assessment_id)?.kind||'exam',score:x.score,total:x.total,needs_manual_grading:x.needs_manual_grading,submitted_at:x.submitted_at})).sort((x,y)=>String(y.submitted_at).localeCompare(String(x.submitted_at)));
  return response({student:{full_name:studentName(st[0]),class_name:st[0].class_name,student_number:b.student_number},results});
 }
 const u=await authenticated(req);if(!u)return error('Connexion requise',401);
 if(method==='GET'&&first==='me')return response(safeUser(u));
 if(method==='POST'&&first==='password'){const b=await req.json();if(!await verify(b.current_password||'',u.password_hash))return error('Mot de passe incorrect');if(String(b.new_password||'').length<8)return error('Mot de passe trop court');await update('users',u.id,{password_hash:await hash(b.new_password)});return response({ok:true});}
 if(method==='POST'&&first==='students'&&third==='student-code'){
  if(!check(u,['admin']))return error('Accès réservé à l’administration',403);
  const b=await req.json();if(String(b.code||'').length<8)return error('Code élève : 8 caractères minimum',422);
  const st=await update('students',second,{student_code_hash:await hash(String(b.code))});return st?response({ok:true}):error('Élève introuvable',404);
 }
 if(method==='POST'&&first==='students'&&third==='parent-code'){
  if(!check(u,['admin']))return error('Accès interdit',403);const b=await req.json();if(String(b.code||'').length<8)return error('Code trop court');const s=await update('students',second,{parent_code_hash:await hash(b.code)});return s?response({ok:true}):error('Élève introuvable',404);
 }
 if(method==='POST'&&first==='upload'){
  if(!check(u,['admin','teacher']))return error('Accès interdit',403);
  const form=await req.formData(),file=form.get('file');if(!(file instanceof File))return error('Fichier requis');const ext=String(file.name.split('.').pop()||'').toLowerCase();if(!['pdf','ppt','pptx','png','jpg','jpeg','webp'].includes(ext))return error('Type de fichier refusé');if(file.size>15*1024*1024)return error('Fichier trop volumineux (15 Mo maximum)',413);
  const key=`${crypto.randomUUID()}.${ext}`,bytes=Buffer.from(await file.arrayBuffer());const {error:e}=await documentStore().upload(key,bytes,{contentType:file.type||'application/octet-stream',upsert:false});if(e)throw e;return response({url:'/uploads/'+key,filename:file.name});
 }
 if(method==='GET'&&first==='submissions'&&third==='pdf'){
  if(!check(u,['admin','teacher']))return error('Accès interdit',403);
  const sub=(await read('submissions')).find(x=>x.id===second);
  if(!sub)return error('Copie introuvable',404);
  const assessment=await accessibleAssessment(u,sub.assessment_id);if(!assessment)return error('Accès interdit',403);
  const puppeteer=await import('puppeteer');
  const escapeHtml=(v:any):string=>String(v??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as Record<string,string>)[c]);
  const display=(v:any):string=>v===null||v===undefined||v===''?'Non renseigné':Array.isArray(v)?v.map(display).join(' ; '):typeof v==='object'?JSON.stringify(v):String(v);
  const value=(v:any)=>escapeHtml(display(v));
  const dateLabel=(()=>{try{return new Intl.DateTimeFormat('fr-MA',{timeZone:'Africa/Casablanca',dateStyle:'long',timeStyle:'short'}).format(new Date(sub.submitted_at));}catch{return display(sub.submitted_at)}})();
  const questions=Array.isArray(assessment?.questions)?assessment.questions:[];
  const answers=sub.answers&&typeof sub.answers==='object'?sub.answers:{};
  const rows=questions.length?questions.map((q:any,i:number)=>
    '<section class="question"><div class="question-title"><span class="number">'+(i+1)+'</span><span class="bidi">'+value(q.text||'Question')+'</span></div><div class="answer-label">Réponse de l’élève</div><div class="answer bidi">'+value(answers[q.id]??'Aucune réponse')+'</div></section>'
  ).join(''):Object.entries(answers).map(([key,val],i)=>
    '<section class="question"><div class="question-title"><span class="number">'+(i+1)+'</span><span>'+value(key)+'</span></div><div class="answer-label">Réponse de l’élève</div><div class="answer bidi">'+value(val)+'</div></section>'
  ).join('');
  const fontPath=join(process.cwd(),'assets','NotoNaskhArabic-Regular.ttf');
  let fontCss='';
  try{const data=await readFile(fontPath);fontCss='@font-face{font-family:Naskh;src:url(data:font/ttf;base64,'+data.toString('base64')+') format("truetype");font-display:block;}';}
  catch{ /* Le navigateur utilise ses polices Unicode de secours. */ }
  const html='<!doctype html><html lang="fr"><head><meta charset="utf-8"><style>'+fontCss+
  '@page{size:A4;margin:16mm 15mm 17mm}*{box-sizing:border-box}body{font-family:Arial,Naskh,sans-serif;color:#172b3b;font-size:12px;line-height:1.65;margin:0}.header{border-bottom:3px solid #207d69;padding-bottom:16px;margin-bottom:20px}.kicker{letter-spacing:2px;color:#207d69;text-transform:uppercase;font-size:10px;font-weight:700}.title{font-size:26px;letter-spacing:-.5px;font-weight:800;line-height:1.25;margin:5px 0}.muted{color:#61717e}.meta{background:#f4f8f8;border:1px solid #e1ebeb;border-radius:10px;padding:14px 17px;display:grid;grid-template-columns:1fr 1fr;gap:9px 16px;margin:18px 0 22px}.label{color:#6e7e88;font-size:10px;text-transform:uppercase;letter-spacing:.5px}.data{font-size:13px;font-weight:650}.bidi{unicode-bidi:plaintext;white-space:pre-wrap;overflow-wrap:anywhere}.score{color:#166855;font-size:20px;font-weight:800}.section-title{font-size:16px;border-bottom:1px solid #d9e4e5;padding-bottom:8px;margin:18px 0 13px}.question{border:1px solid #e3e9ed;border-radius:9px;padding:13px 15px;margin:0 0 13px;break-inside:avoid-page}.question-title{display:flex;gap:10px;align-items:flex-start;font-size:13px;font-weight:700}.number{flex-shrink:0;background:#e0f1eb;color:#176d58;border-radius:6px;min-width:25px;text-align:center}.answer-label{color:#75838e;font-size:10px;margin:10px 0 2px}.answer{border-left:3px solid #a6c9bc;background:#f9fbfb;padding:8px 12px;border-radius:0 6px 6px 0;min-height:31px}.footer{margin-top:24px;border-top:1px solid #dae3e7;padding-top:8px;color:#7d8992;font-size:10px}.warning{color:#99641e;background:#fff6e4;padding:7px 11px;border-radius:6px;margin-bottom:15px}</style></head><body>'+
  '<header class="header"><div class="kicker">AL MASSIRA · DOCUMENT PÉDAGOGIQUE</div><div class="title">Copie d’évaluation</div><div class="muted bidi">'+value(sub.assessment_title||assessment?.title||'Évaluation')+'</div></header>'+
  '<div class="meta"><div><div class="label">Élève</div><div class="data bidi">'+value(sub.full_name||sub.student_id)+'</div></div><div><div class="label">Classe</div><div class="data bidi">'+value(sub.class_name)+'</div></div><div><div class="label">Numéro de classe</div><div class="data">'+value(sub.student_number)+'</div></div><div><div class="label">Date de soumission</div><div class="data">'+value(dateLabel)+'</div></div><div><div class="label">Note enregistrée</div><div class="score">'+value(sub.score??'—')+' / '+value(sub.total??'—')+'</div></div></div>'+
  (sub.needs_manual_grading?'<div class="warning">Correction manuelle requise</div>':'')+
  '<h2 class="section-title">Questions et réponses</h2>'+(rows||'<p>Aucune réponse enregistrée.</p>')+
  '<footer class="footer">Document généré depuis AL MASSIRA · Copie de l’élève</footer></body></html>';
  const browser=await puppeteer.launch({headless:true});
  try{
    const pdfPage=await browser.newPage();
    await pdfPage.setContent(html,{waitUntil:'load'});
    await pdfPage.evaluate(()=>document.fonts.ready);
    const bytes=await pdfPage.pdf({format:'A4',printBackground:true,preferCSSPageSize:true});
    return new NextResponse(Buffer.from(bytes),{status:200,headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="copie-al-massira.pdf"','Cache-Control':'private, no-store'}});
  }finally{await browser.close();}
 }
 if(method==='POST'&&first==='submit')return error('Utilisez le dépôt sécurisé avec code personnel élève',403);
 if(!collections.includes(first))return error('Page introuvable',404);
 if(method==='GET'&&!second){let rows=await read(first);
  if(first==='users'){if(!check(u,['admin']))return error('Accès interdit',403);return response(rows.map(safeUser));}
  if(['student','parent'].includes(u.role)){if(['students','reports'].includes(first))return error('Accès interdit',403);const sid=u.student_id||u.id,st=(await read('students')).find(x=>x.id===sid);
    if(['courses','assessments'].includes(first))rows=rows.filter(x=>x.published&&(!x.class_name||x.class_name==='Toutes les classes'||x.class_name===st?.class_name));if(first==='submissions')rows=rows.filter(x=>x.student_id===sid);
  }
  if(u.role==='teacher'){
    if(['courses','assessments'].includes(first))rows=rows.filter(x=>teacherOwns(u,x));
    if(first==='submissions'){
      const owned=(await read('assessments')).filter(x=>teacherOwns(u,x)).map(x=>x.id);
      rows=rows.filter(x=>owned.includes(x.assessment_id));
    }
    if(first==='reports')return error('Accès réservé à l’administration',403);
  }
  return response(first==='students'?rows.map(safeStudent):rows);
 }
 if(!check(u,['admin','teacher']))return error('Accès interdit',403);
 if(u.role==='teacher'&&!['courses','assessments'].includes(first))return error('Accès réservé à l’administration',403);
 if(first==='users'&&u.role!=='admin')return error('Accès interdit',403);
 if(first==='submissions')return error('Utiliser /api/submit',403);
 if(method==='POST'&&!second){const b=await req.json(),x={...(b.data||{})};delete x.id;delete x.password_hash;delete x.parent_code_hash;delete x.student_code_hash;delete x.created_by;
  if(first==='students'){x.student_number=String(x.student_number||'').trim();if(!x.student_number)return error('Numéro de classe obligatoire');if((await read('students')).some(y=>norm(y.class_name)===norm(x.class_name)&&norm(y.student_number)===norm(x.student_number)))return error('Numéro déjà utilisé dans cette classe',409);}
  if(first==='users'){if(String(x.password||'').length<8)return error('Mot de passe de 8 caractères minimum');if(!['admin','teacher'].includes(x.role))return error('Rôle invalide');x.identifier=String(x.identifier||'').trim().toLowerCase();if(!x.identifier)return error('Identifiant requis');if((await read('users')).some(y=>y.identifier===x.identifier&&y.role===x.role))return error('Compte déjà existant',409);x.password_hash=await hash(x.password);delete x.password;}
  const result=await insert(first,{...x,created_by:u.id,created_at:new Date().toISOString()});return response(first==='users'?safeUser(result):first==='students'?safeStudent(result):result);
 }
 if(method==='PUT'&&second){const old=(await read(first)).find(x=>x.id===second);if(!old)return error('Introuvable',404);if(!teacherOwns(u,old))return error('Accès interdit',403);const b=await req.json(),changes={...(b.data||{})};for(const k of ['id','password_hash','parent_code_hash','created_at','role','identifier','student_id','student_code_hash','created_by'])delete changes[k];
  if(first==='students'){const cls=changes.class_name??old.class_name,num=changes.student_number??old.student_number;if(!String(num||'').trim())return error('Numéro de classe obligatoire');if((await read('students')).some(x=>x.id!==old.id&&norm(x.class_name)===norm(cls)&&norm(x.student_number)===norm(num)))return error('Numéro déjà utilisé dans cette classe',409);}
  if(first==='users'&&changes.password){if(changes.password.length<8)return error('Mot de passe trop court');changes.password_hash=await hash(changes.password);delete changes.password;}
  const result=await update(first,second,changes);return response(first==='users'?safeUser(result):first==='students'?safeStudent(result):result);
 }
 if(method==='DELETE'&&second){const old=(await read(first)).find(x=>x.id===second);if(!old)return error('Introuvable',404);if(!teacherOwns(u,old))return error('Accès interdit',403);if(first==='users'&&u.id===second)return error('Impossible de supprimer votre compte');return await remove(first,second)?response({ok:true}):error('Introuvable',404);}
 return error('Route introuvable',404);
 }catch(e:any){console.error('API:',e);return error(process.env.NODE_ENV==='production'?'Erreur du serveur. Consultez les journaux Vercel.':String(e.message||e),500);}
}
export async function GET(req:NextRequest,context:{params:Promise<{path:string[]}>}){return serve(req,(await context.params).path,'GET');}
export async function POST(req:NextRequest,context:{params:Promise<{path:string[]}>}){return serve(req,(await context.params).path,'POST');}
export async function PUT(req:NextRequest,context:{params:Promise<{path:string[]}>}){return serve(req,(await context.params).path,'PUT');}
export async function DELETE(req:NextRequest,context:{params:Promise<{path:string[]}>}){return serve(req,(await context.params).path,'DELETE');}

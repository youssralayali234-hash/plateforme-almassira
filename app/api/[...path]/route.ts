
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
const normRole=(x:any)=>['admin','teacher','student','parent'].includes(x.role);
const documentStore=()=>{
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error('Stockage Supabase non configuré');
 return createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {auth:{persistSession:false}}
 ).storage.from(process.env.SUPABASE_STORAGE_BUCKET||'almassira-documents');
};
const check=(u:any,roles:string[])=>!!u&&roles.includes(u.role);
const teacherOwns=(u:any,item:any)=>u.role==='admin'||(u.role==='teacher'&&item.created_by===u.id);
const allowedClass=(target:any,student:any)=>!target?.class_name||norm(target.class_name)===norm('Toutes les classes')||norm(target.class_name)===norm(student?.class_name);
const accessibleAssessment=async(u:any,id:string)=>{
 const assessment=(await read('assessments')).find(a=>a.id===id);
 return assessment&&teacherOwns(u,assessment)?assessment:null;
};

async function serve(req:NextRequest,parts:string[],method:string){
 const [first,second,third]=parts;
 try{
 if(method==='GET'&&first==='health')
  return response({ok:true,storage:'supabase-postgresql',app:'AL MASSIRA'});

 if(method==='GET'&&first==='public'&&second==='assessments')
  return response((await read('assessments')).filter(x=>x.published).map(x=>({
   id:x.id,title:x.title||'Évaluation',description:x.description||'',
   
class_name:x.class_name||'',
kind:x.kind||'exam',
file_url:x.file_url||null,
image_urls:x.image_urls||[],

   questions:(x.questions||[]).map((q:any)=>({
    id:q.id,type:q.type,text:q.text,options:q.options||[],points:q.points||1
   }))
  })));

 if(method==='GET'&&first==='public'&&second==='courses')
  return response((await read('courses')).filter(x=>x.published).map(x=>
   Object.fromEntries(
['id','title','description','class_name','content','file_url','image_urls']
)
  ));

 if(method==='POST'&&first==='public'&&second==='submit'){
  const b=await req.json();
  const a=(await read('assessments')).find(x=>x.id===b.assessment_id&&x.published);
  if(!a)return error('Évaluation indisponible',404);

  const name=String(b.full_name||'').trim();
  const cls=String(b.class_name||'').trim();
  const number=String(b.student_number||'').trim();

  const student=(await read('students')).find(st=>
   norm(studentName(st))===norm(name)&&
   norm(st.class_name)===norm(cls)&&
   norm(st.student_number)===norm(number)
  );

  if(!student?.student_code_hash||
   !await verify(String(b.student_code||''),student.student_code_hash))
   return error('Identité ou code élève incorrect',401);

  if(name.length<3||!cls||!number)
   return error('Identité incomplète',422);

  if(!allowedClass(a,student))
   return error('Cette évaluation est réservée à une autre classe');

  const subs=await read('submissions');
  if(subs.some(s=>
   s.assessment_id===a.id&&
   norm(s.class_name)===norm(cls)&&
   norm(s.student_number)===norm(number)
  ))return error('Une copie existe déjà pour ce numéro et cette classe',409);

  let score=0,total=0,manual=false;
  const answers=b.answers||{};

  for(const q of a.questions||[]){
   const p=Math.max(0,Number(q.points)||0);
   total+=p;
   if(['mcq','truefalse','short'].includes(q.type)){
    if(String(answers[q.id]||'').trim()&&norm(answers[q.id])===norm(q.correct))
     score+=p;
   }else manual=true;
  }

  const submission=await insert('submissions',{
   student_id:student.id,
   assessment_id:a.id,
   assessment_title:a.title,
   full_name:name,
   class_name:cls,
   student_number:number,
   answers,score,total,
   needs_manual_grading:manual,
   submitted_at:new Date().toISOString()
  });

  return response({ok:true,id:submission.id,message:'Copie enregistrée'});
 }

 if(method==='POST'&&first==='parent'&&second==='access'){
  const b=await req.json();
  const st=(await read('students')).filter(x=>
   norm(studentName(x))===norm(b.full_name)&&
   norm(x.class_name)===norm(b.class_name)&&
   norm(x.student_number||x.number)===norm(b.student_number)
  );

  if(st.length!==1||!st[0].parent_code_hash||
   !await verify(String(b.parent_code||''),st[0].parent_code_hash))
   return error('Informations ou code incorrects',401);

  const a=await read('assessments');
  const sub=await read('submissions');

  const results=sub.filter(x=>
   x.student_id===st[0].id||
   (norm(x.full_name)===norm(b.full_name)&&
    norm(x.class_name)===norm(b.class_name)&&
    norm(x.student_number)===norm(b.student_number))
  ).map(x=>({
   id:x.id,
   assessment_title:x.assessment_title||a.find(z=>z.id===x.assessment_id)?.title||'Évaluation',
   kind:a.find(z=>z.id===x.assessment_id)?.kind||'exam',
   score:x.score,total:x.total,
   needs_manual_grading:x.needs_manual_grading,
   submitted_at:x.submitted_at
  })).sort((x,y)=>String(y.submitted_at).localeCompare(String(x.submitted_at)));

  return response({
   student:{
    full_name:studentName(st[0]),
    class_name:st[0].class_name,
    student_number:b.student_number
   },results
  });
 }

 const u=await authenticated(req);
 if(!u)return error('Connexion requise',401);

 if(method==='GET'&&first==='me')
  return response(safeUser(u));

 if(method==='POST'&&first==='password'){
  const b=await req.json();
  if(!await verify(b.current_password||'',u.password_hash))
   return error('Mot de passe incorrect');
  if(String(b.new_password||'').length<8)
   return error('Mot de passe trop court');

  await update('users',u.id,{
   password_hash:await hash(b.new_password)
  });
  return response({ok:true});
 }

 if(method==='POST'&&first==='students'&&third==='student-code'){
  if(!check(u,['admin']))
   return error('Accès réservé à l’administration',403);

  const b=await req.json();
  if(String(b.code||'').length<8)
   return error('Code élève : 8 caractères minimum',422);

  const st=await update('students',second,{
   student_code_hash:await hash(String(b.code))
  });
  return st?response({ok:true}):error('Élève introuvable',404);
 }

 if(method==='POST'&&first==='students'&&third==='parent-code'){
  if(!check(u,['admin']))return error('Accès interdit',403);
  const b=await req.json();
  if(String(b.code||'').length<8)return error('Code trop court');

  const s=await update('students',second,{
   parent_code_hash:await hash(b.code)
  });
  return s?response({ok:true}):error('Élève introuvable',404);
 }

 if(method==='POST'&&first==='upload'){
  if(!check(u,['admin','teacher']))
   return error('Accès interdit',403);

  const form=await req.formData();
  const file=form.get('file');

  if(!(file instanceof File))
   return error('Fichier requis');

  const ext=String(file.name.split('.').pop()||'').toLowerCase();

  if(!['pdf','ppt','pptx','png','jpg','jpeg','webp'].includes(ext))
   return error('Type de fichier refusé');

  if(file.size>15*1024*1024)
   return error('Fichier trop volumineux (15 Mo maximum)',413);

  const key=`${crypto.randomUUID()}.${ext}`;
  const bytes=Buffer.from(await file.arrayBuffer());

  const {error:e}=await documentStore().upload(key,bytes,{
   contentType:file.type||'application/octet-stream',
   upsert:false
  });

  if(e)throw e;

  return response({
   url:'/uploads/'+key,
   filename:file.name
  });
 }

 if(method==='GET'&&first==='submissions'&&third==='pdf'){
  if(!check(u,['admin','teacher']))
   return error('Accès interdit',403);

  const sub=(await read('submissions')).find(x=>x.id===second);
  if(!sub)return error('Copie introuvable',404);

  const assessment=await accessibleAssessment(u,sub.assessment_id);
  if(!assessment)return error('Accès interdit',403);

  const doc=await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const fontPath=join(process.cwd(),'assets','NotoNaskhArabic-Regular.ttf');
  let regular:any,bold:any;

  try{
   const fontBytes=await readFile(fontPath);
   regular=await doc.embedFont(fontBytes,{subset:true});
   bold=regular;
  }catch{
   return error('Police Unicode manquante : ajoutez une police Noto Naskh Arabic autorisée dans assets pour générer des PDF multilingues',503);
  }

  const pageSize:[number,number]=[595.28,841.89];
  let page=doc.addPage(pageSize),y=795;

  const clean=(v:any)=>String(v??'').replace(/[\r\n\t]+/g,' ');

  const write=(v:any,emphasis=false)=>{
   const font=emphasis?bold:regular;
   const text=clean(v);
   const max=87;
   const chunks=text.match(new RegExp('.{1,'+max+'}','g'))||[''];

   for(const chunk of chunks){
    if(y<65){
     page=doc.addPage(pageSize);
     y=795;
    }
    page.drawText(chunk,{
     x:47,y,
     size:emphasis?12:10,
     font,color:rgb(.12,.18,.25)
    });
    y-=emphasis?22:17;
   }
  };

  write('AL MASSIRA - COPIE D EVALUATION',true);
  y-=10;
  write('Evaluation : '+(sub.assessment_title||assessment?.title||'Evaluation'));
  write('Eleve : '+(sub.full_name||sub.student_id||'Non renseigne'));
  write('Classe : '+(sub.class_name||'Non renseignee'));
  write('Numero : '+(sub.student_number||'Non renseigne'));
  write('Soumis le : '+(sub.submitted_at||'Non renseigne'));
  write('Note : '+(sub.score??'--')+' / '+(sub.total??'--'));

  if(sub.needs_manual_grading)
   write('Correction manuelle requise');

  y-=12;
  write('REPONSES',true);

  const questions=Array.isArray(assessment?.questions)?assessment.questions:[];
  const answers=sub.answers&&typeof sub.answers==='object'?sub.answers:{};

  if(questions.length){
   for(let i=0;i<questions.length;i++){
    const q=questions[i];
    write((i+1)+'. '+(q.text||'Question'),true);
    write('Reponse : '+String(answers[q.id]??'Aucune reponse'));
    y-=8;
   }
  }else{
   for(const [key,value] of Object.entries(answers)){
    write('Question : '+key,true);
    write('Reponse : '+String(value));
   }
  }

  const bytes=await doc.save();

  return new NextResponse(Buffer.from(bytes),{
   status:200,
   headers:{
    'Content-Type':'application/pdf',
    'Content-Disposition':'attachment; filename="copie-al-massira.pdf"',
    'Cache-Control':'private, no-store'
   }
  });
 }

 if(method==='POST'&&first==='submit')
  return error('Utilisez le dépôt sécurisé avec code personnel élève',403);

 if(!collections.includes(first))
  return error('Page introuvable',404);

 if(method==='GET'&&!second){
  let rows=await read(first);

  if(first==='users'){
   if(!check(u,['admin']))return error('Accès interdit',403);
   return response(rows.map(safeUser));
  }

  if(['student','parent'].includes(u.role)){
   if(['students','reports'].includes(first))
    return error('Accès interdit',403);

   const sid=u.student_id||u.id;
   const st=(await read('students')).find(x=>x.id===sid);

   if(['courses','assessments'].includes(first))
    rows=rows.filter(x=>
     x.published&&
     (!x.class_name||
      x.class_name==='Toutes les classes'||
      x.class_name===st?.class_name)
    );

   if(first==='submissions')
    rows=rows.filter(x=>x.student_id===sid);
  }

  if(u.role==='teacher'){
   if(['courses','assessments'].includes(first))
    rows=rows.filter(x=>teacherOwns(u,x));

   if(first==='submissions'){
    const owned=(await read('assessments'))
     .filter(x=>teacherOwns(u,x))
     .map(x=>x.id);

    rows=rows.filter(x=>owned.includes(x.assessment_id));
   }

   if(first==='reports')
    return error('Accès réservé à l’administration',403);
  }

  return response(first==='students'?rows.map(safeStudent):rows);
 }

 if(!check(u,['admin','teacher']))
  return error('Accès interdit',403);

 if(u.role==='teacher'&&!['courses','assessments'].includes(first))
  return error('Accès réservé à l’administration',403);

 if(first==='users'&&u.role!=='admin')
  return error('Accès interdit',403);

 if(first==='submissions')
  return error('Utiliser /api/submit',403);

 if(method==='POST'&&!second){
  const b=await req.json();
  const x={...(b.data||{})};

  delete x.id;
  delete x.password_hash;
  delete x.parent_code_hash;
  delete x.student_code_hash;
  delete x.created_by;

  if(first==='students'){
   x.student_number=String(x.student_number||'').trim();
   if(!x.student_number)
    return error('Numéro de classe obligatoire');

   if((await read('students')).some(y=>
    norm(y.class_name)===norm(x.class_name)&&
    norm(y.student_number)===norm(x.student_number)
   ))return error('Numéro déjà utilisé dans cette classe',409);
  }

  if(first==='users'){
   if(String(x.password||'').length<8)
    return error('Mot de passe de 8 caractères minimum');

   if(!['admin','teacher'].includes(x.role))
    return error('Rôle invalide');

   x.identifier=String(x.identifier||'').trim().toLowerCase();

   if(!x.identifier)
    return error('Identifiant requis');

   if((await read('users')).some(y=>
    y.identifier===x.identifier&&y.role===x.role
   ))return error('Compte déjà existant',409);

   x.password_hash=await hash(x.password);
   delete x.password;
  }

  const result=await insert(first,{
   ...x,
   created_by:u.id,
   created_at:new Date().toISOString()
  });

  return response(
   first==='users'?safeUser(result):
   first==='students'?safeStudent(result):result
  );
 }

 if(method==='PUT'&&second){
  const old=(await read(first)).find(x=>x.id===second);

  if(!old)return error('Introuvable',404);
  if(!teacherOwns(u,old))return error('Accès interdit',403);

  const b=await req.json();
  const changes={...(b.data||{})};

  for(const k of [
   'id','password_hash','parent_code_hash',
   'created_at','role','identifier','student_id',
   'student_code_hash','created_by'
  ])delete changes[k];

  if(first==='students'){
   const cls=changes.class_name??old.class_name;
   const num=changes.student_number??old.student_number;

   if(!String(num||'').trim())
    return error('Numéro de classe obligatoire');

   if((await read('students')).some(x=>
    x.id!==old.id&&
    norm(x.class_name)===norm(cls)&&
    norm(x.student_number)===norm(num)
   ))return error('Numéro déjà utilisé dans cette classe',409);
  }

  if(first==='users'&&changes.password){
   if(changes.password.length<8)
    return error('Mot de passe trop court');

   changes.password_hash=await hash(changes.password);
   delete changes.password;
  }

  const result=await update(first,second,changes);

  return response(
   first==='users'?safeUser(result):
   first==='students'?safeStudent(result):result
  );
 }

 if(method==='DELETE'&&second){
  const old=(await read(first)).find(x=>x.id===second);

  if(!old)return error('Introuvable',404);
  if(!teacherOwns(u,old))return error('Accès interdit',403);

  if(first==='users'&&u.id===second)
   return error('Impossible de supprimer votre compte');

  return await remove(first,second)?
   response({ok:true}):error('Introuvable',404);
 }

 return error('Route introuvable',404);

 }catch(e:any){
  console.error('API:',e);
  return error(
   process.env.NODE_ENV==='production'?
   'Erreur du serveur. Consultez les journaux Vercel.':
   String(e.message||e),500
  );
 }
}

export async function GET(
 req:NextRequest,
 context:{params:Promise<{path:string[]}>}
){
 return serve(req,(await context.params).path,'GET');
}

export async function POST(
 req:NextRequest,
 context:{params:Promise<{path:string[]}>}
){
 return serve(req,(await context.params).path,'POST');
}

export async function PUT(
 req:NextRequest,
 context:{params:Promise<{path:string[]}>}
){
 return serve(req,(await context.params).path,'PUT');
}

export async function DELETE(
 req:NextRequest,
 context:{params:Promise<{path:string[]}>}
){
 return serve(req,(await context.params).path,'DELETE');
}

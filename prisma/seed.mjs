import {PrismaClient} from '@prisma/client';
import bcrypt from 'bcryptjs';
const db=new PrismaClient();
try{const existing=await db.record.findFirst({where:{collection:'users'}});if(existing){console.log('Comptes existants : aucun changement');process.exit(0)}
 const email=process.env.ADMIN_EMAIL,password=process.env.ADMIN_PASSWORD;
 if(!email||!password||password.length<12)throw Error('ADMIN_EMAIL et ADMIN_PASSWORD (12 caractères minimum) obligatoires');
 await db.record.create({data:{collection:'users',data:{name:'Administration',role:'admin',identifier:email.trim().toLowerCase(),password_hash:await bcrypt.hash(password,12)}}});console.log('Compte administrateur initialisé');
}finally{await db.$disconnect();}

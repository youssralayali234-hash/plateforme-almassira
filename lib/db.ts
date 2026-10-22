import {PrismaClient} from '@prisma/client';
const globalDb=globalThis as unknown as {prisma?:PrismaClient};
export const prisma=globalDb.prisma??new PrismaClient();
if(process.env.NODE_ENV!=='production')globalDb.prisma=prisma;
export const collections=['users','students','courses','assessments','submissions','reports'];
export async function read(collection:string):Promise<any[]>{
 if(!collections.includes(collection))throw new Error('Collection inconnue');
 const rows=await prisma.record.findMany({where:{collection},orderBy:{createdAt:'asc'}});
 return rows.map(r=>({...r.data as object,id:r.id}));
}
export async function insert(collection:string,data:any){const {id,...rest}=data;const row=await prisma.record.create({data:{collection,data:rest}});return {...rest,id:row.id};}
export async function update(collection:string,id:string,data:any){const row=await prisma.record.findFirst({where:{id,collection}});if(!row)return null;const payload={...(row.data as object),...data};await prisma.record.update({where:{id},data:{data:payload}});return {...payload,id};}
export async function remove(collection:string,id:string){const row=await prisma.record.findFirst({where:{id,collection}});if(!row)return false;await prisma.record.delete({where:{id}});return true;}

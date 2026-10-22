import { existsSync, readFileSync } from 'node:fs';
const required=['package.json','tsconfig.json','app/page.tsx','app/layout.tsx','app/globals.css','app/api/[...path]/route.ts','app/api/auth/[...nextauth]/route.ts','app/uploads/[filename]/route.ts','components/Portal.tsx','lib/db.ts','lib/security.ts','prisma/schema.prisma','prisma/seed.mjs','.env.example'];
let errors=0;
for (const file of required) if (!existsSync(file)) { console.error('MANQUANT:',file); errors++; }
const p=JSON.parse(readFileSync('package.json','utf8'));
for (const dependency of ['next','react','react-dom','next-auth','@prisma/client','@supabase/supabase-js','pdf-lib']) if (!p.dependencies[dependency]) { console.error('DEPENDANCE MANQUANTE:',dependency); errors++; }
for (const forbidden of ['app/legacy.js','backend/main.py','requirements.txt','vercel.json']) if (existsSync(forbidden)) { console.error('ANCIEN FICHIER:',forbidden); errors++; }
console.log(errors ? `${errors} probleme(s) detecte(s).` : 'Structure et dependances principales : OK (verification statique uniquement).');
process.exitCode=errors?1:0;

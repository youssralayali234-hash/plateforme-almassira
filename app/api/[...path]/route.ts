Skip to content
Deployments
BpRHS2ekY

Deployment
Logs
Resources
Source
Open Graph
Deployment Details
Build Failed
Command "npm run build" exited with 1
Created
github/youssralayali234-hash
youssralayali234-hash
4m ago
Status
Error
Latest
Duration
10s
4m ago
Environment
Production
Domains
plateforme-almassira-git-master-youssralayali234-7596s-projects.vercel.app
plateforme-almassira-8ttenicza-youssralayali234-7596s-projects.vercel.app
Source
master
5083009
Update route.ts

Deployment Settings
2 Recommendations
Build Logs
10s
13 error lines

3
/3

3
Find in logs
Ctrl
F
    :                                                                                                                                                                                                                       ^^^^^^^^^
 10 | function MediaAttachments({item}:{item:Item}){return <div className="space-y-4">{item.file_url&&<div className="space-y-2"><a className="inline-block text-blue-700 underline font-semibold" target="_blank" rel="noreferrer" href={item.file_url}>Ouvrir / télécharger le document PDF</a><iframe className="w-full h-[480px] border rounded-xl bg-white" title="Document PDF" src={item.file_url}/></div>}{(item.image_urls||[]).length>0&&<div className="grid sm:grid-cols-2 gap-3">{item.image_urls.map((url:string,i:number)=><a key={url+i} href={url} target="_blank" rel="noreferrer"><img loading="lazy" className="w-full max-h-[420px] object-contain bg-white rounded-xl border" src={url} alt={'Illustration '+(i+1)}/></a>)}</div>}</div>}
 11 | function App(){const {data:session,status}=useSession();const [space,setSpace]=useState('');const [pendingSpace,setPendingSpace]=useState('');const [tab,setTab]=useState('courses');const [items,setItems]=useState<Item[]>([]);const [edit,setEdit]=useState<Item|null>(null);const [loading,setLoading]=useState(false);const [notice,setNotice]=useState('');const [credentials,setCredentials]=useState({identifier:'',password:''});const [authRole,setAuthRole]=useState('teacher');const [selected,setSelected]=useState<Item|null>(null);const [courses,setCourses]=useState<Item[]>([]);const [assessments,setAssessments]=useState<Item[]>([]);const [answers,setAnswers]=useState<Record<string,string>>({});const [identity,setIdentity]=useState({full_name:'',class_name:'',student_number:'',student_code:''});const [parentCode,setParentCode]=useState('');const [parentResult,setParentResult]=useState<Item|null>(null);
 12 |  const load=useCallback(async()=>{if(!space||!['teacher','admin'].includes(space)||!session)return;setLoading(true);setNotice('');try{setItems(await api(tab))}catch(e:any){setNotice(e.message)}finally{setLoading(false)}},[space,tab,session]);useEffect(()=>{load()},[load]);
    `----
Caused by:
    Syntax Error
Import trace for requested module:
./app/api/[...path]/route.ts
> Build failed because of webpack errors
Error: [BUILD_UTILS_SPAWN_1] Command "npm run build" exited with 1
Deployment Summary
Deployment Checks
Assigning Custom Domains
Runtime Logs

View and debug runtime logs & errors

Observability

Monitor app health & performance

Speed Insights

Not Enabled
Performance metrics from real users

Web Analytics

Not Enabled
Analyze visitors & traffic in real-time

Vercel
23:59:40

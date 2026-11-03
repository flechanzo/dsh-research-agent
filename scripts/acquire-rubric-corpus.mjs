/** Real public acquisition only; produces no scientific score. Node 22.20+. */
import fs from 'node:fs'
import path from 'node:path'
import {createHash} from 'node:crypto'
import {sourceIdentity} from './build-provenance.mjs'
import {createRubricNetwork} from '../packages/research-agent/src/innovation/network.ts'
const out=path.resolve(process.argv[2]??'.acceptance/rubric-corpus-'+Date.now())
if(fs.existsSync(path.join(out,'result.json')))throw Error('Choose a new output directory; evidence is immutable per run')
fs.mkdirSync(path.join(out,'raw'),{recursive:true});fs.mkdirSync(path.join(out,'documents'),{recursive:true});fs.mkdirSync(path.join(out,'blind'),{recursive:true})
const hash=s=>createHash('sha256').update(s).digest('hex')
const identity=sourceIdentity(process.cwd())
const documentKey=d=>hash(JSON.stringify({originalUrl:d.provenance?.originalUrl??null,url:d.url??d.id,acquisitions:d.provenance?.acquisitions??d.acquisition??null,textSha256:d.provenance?.textSha256??hash(d.text??'')}))
const manifest=JSON.parse(fs.readFileSync('evaluation/rubric-1.7.0/cases.json','utf8'))
const cases=process.argv[3]?manifest.cases.filter(c=>process.argv[3].split(',').includes(c.id)):manifest.cases
const trace=x=>fs.appendFileSync(path.join(out,'network.jsonl'),JSON.stringify({at:new Date().toISOString(),...x})+'\n')
const allowed=new Set(['api.openalex.org','api.semanticscholar.org','export.arxiv.org','arxiv.org','openreview.net','aclanthology.org','doi.org'])
let operations=0
const beforeRequest=()=>{if(++operations>120)throw Error('Public corpus request budget exhausted')}
const web={async fetch(request,signal){
 let url=request.url
 for(let redirects=0;redirects<=3;redirects++){
  const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||!allowed.has(u.hostname))throw Error('Corpus HTML origin not permitted: '+u.origin)
  const response=await fetch(url,{signal,redirect:'manual',credentials:'omit',headers:{accept:'text/html,application/json,application/atom+xml','user-agent':'DSH-Research-Agent public evaluation corpus'}})
  if([301,302,303,307,308].includes(response.status)){const next=response.headers.get('location');await response.body?.cancel();if(!next)throw Error('Missing redirect');url=new URL(next,url).href;continue}
  const reader=response.body?.getReader();const chunks=[];let count=0;let truncated=false
  if(reader){try{for(;;){const r=await reader.read();if(r.done)break;count+=r.value.length;if(count>2500000){truncated=true;break}chunks.push(r.value)}}finally{await reader.cancel();reader.releaseLock()}}
  const content=new TextDecoder().decode(Buffer.concat(chunks));trace({transport:'public-web',url:request.url,finalUrl:url,status:response.status,sha256:hash(content),bytes:count,truncated})
  return {url,statusCode:response.status,truncated,body:{kind:response.headers.get('content-type')?.includes('html')?'html':'text',content}}
 }
 throw Error('Corpus redirect limit exceeded')
}}
const network=createRubricNetwork(web,{
 webTransport:'public-web',beforeRequest,timeoutMs:25000,maxCharacters:500000,paperOptions:{maxPdfPages:100},
 onText:async(content,a)=>{fs.writeFileSync(path.join(out,'raw',a.sha256+'.txt'),content)},
 onPdf:async(bytes,a)=>{fs.writeFileSync(path.join(out,'raw',a.sha256+'.pdf'),bytes);trace(a)},
 onDocument:async d=>{fs.writeFileSync(path.join(out,'documents',documentKey(d)+'.json'),JSON.stringify(d,null,2))}
})
const cache=new Map();const results=[]
for(const [index,c] of cases.entries()){
 const packet={id:c.id,targetTask:c.targetTask,candidate:c.candidate,scope:c.scope,scientificScore:null,reviewStatus:'unreviewed',documents:[],collectionRounds:[],errors:[]}
 for(const s of c.sources){
  try{
   const reused=cache.has(s.url)
   let d=cache.get(s.url)
   if(!d){d=await network.read(s,AbortSignal.timeout(60000));cache.set(s.url,d)}
   packet.documents.push({url:s.url,documentPath:'documents/'+documentKey(d)+'.json',coverage:d.provenance?.coverage,version:d.provenance?.version,reusedWithinRun:reused})
  }catch(e){packet.errors.push(String(e))}
 }
 let query=c.query
 for(const round of [1,2,3]){
  const startedAt=new Date().toISOString()
  try{
   const found=await network.search(query,AbortSignal.timeout(60000))
   packet.collectionRounds.push({round,query,startedAt,result:found,scientificallyReviewed:false})
   const title=found.sources[0]?.title
   query=round===1?(title??c.query).slice(0,170)+' earlier equivalent mechanism prior work':(found.sources.find(s=>s.title!==title)?.title??title??c.query).slice(0,170)+' definition assumptions counterexample'
  }catch(e){packet.collectionRounds.push({round,query,startedAt,error:String(e),scientificallyReviewed:false})}
 }
 fs.writeFileSync(path.join(out,c.id+'.json'),JSON.stringify(packet,null,2))
 const blindId='sample-'+String(index+1).padStart(2,'0')
 fs.writeFileSync(path.join(out,'blind',blindId+'.json'),JSON.stringify({blindId,targetTask:c.targetTask,candidate:c.candidate,scope:c.scope,documents:packet.documents,instructions:'Do not infer a gold category or score. Review originals, conduct actual iterative search at the comparison date, then submit attributable independent review. Existing scores and boundary focus are withheld.',review:null},null,2))
 results.push({id:c.id,documents:packet.documents,rounds:packet.collectionRounds.length,errors:packet.errors,scientificScore:null})
 console.log(JSON.stringify({id:c.id,documents:packet.documents.map(d=>d.coverage),rounds:packet.collectionRounds.length}))
}
fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({createdAt:new Date().toISOString(),mode:'real-public-acquisition-without-scientific-scoring',operations,sourceSha256:identity.sourceSha256,sourceCommit:identity.commit,runnerSha256:hash(fs.readFileSync('scripts/acquire-rubric-corpus.mjs')),manifestFileSha256:hash(fs.readFileSync('evaluation/rubric-1.7.0/cases.json')),manifestSha256:hash(JSON.stringify(manifest)),results,expertCalibration:false},null,2))

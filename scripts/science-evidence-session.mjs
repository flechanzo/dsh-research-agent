/** Public evidence notebook runner. It never infers scientific sufficiency or creates a score. */
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {rubricSourceText,createRubricNetwork} from '../packages/research-agent/src/innovation/network.ts';
const out=path.resolve(process.argv[2]);const plan=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
fs.mkdirSync(path.join(out,'raw'),{recursive:true});fs.mkdirSync(path.join(out,'documents'),{recursive:true});
const hash=value=>createHash('sha256').update(value).digest('hex');
const log=item=>fs.appendFileSync(path.join(out,'network.jsonl'),JSON.stringify({at:new Date().toISOString(),...item})+'\n');
const allowed=new Set(['api.openalex.org','api.semanticscholar.org','arxiv.org','export.arxiv.org','aclanthology.org','doi.org','openreview.net','proceedings.mlr.press']);
const web={async fetch(request,signal){
 let url=request.url;
 for(let i=0;i<4;i++){
  const u=new URL(url);if(u.protocol!=='https:'||!allowed.has(u.hostname))throw Error('Public source not allowed: '+u.origin);
  const r=await fetch(url,{signal,redirect:'manual',headers:{accept:'text/html,application/json,application/atom+xml','user-agent':'DSH Research evidence validation'}});
  if([301,302,303,307,308].includes(r.status)){await r.body?.cancel();url=new URL(r.headers.get('location'),url).href;continue}
  const reader=r.body?.getReader();let bytes=0;const chunks=[];let truncated=false;
  if(reader){try{for(;;){const p=await reader.read();if(p.done)break;bytes+=p.value.length;if(bytes>2500000){truncated=true;break}chunks.push(p.value)}}finally{await reader.cancel();reader.releaseLock()}}
  const content=Buffer.concat(chunks).toString('utf8'),sha256=hash(content);fs.writeFileSync(path.join(out,'raw',sha256+'.txt'),content);log({kind:'actual-https',url:request.url,finalUrl:url,status:r.status,sha256,bytes,truncated});
  return {url,statusCode:r.status,truncated,body:{kind:r.headers.get('content-type')?.includes('html')?'html':'text',content}};
 }throw Error('Redirect limit');
}};
const network=createRubricNetwork(web,{webTransport:'public-web',timeoutMs:25000,maxCharacters:500000,paperOptions:{maxPdfPages:100},onText:async(text,a)=>{fs.writeFileSync(path.join(out,'raw',a.sha256+'.txt'),text)},onPdf:async(bytes,a)=>{fs.writeFileSync(path.join(out,'raw',a.sha256+'.pdf'),bytes);log(a)},onDocument:async d=>{fs.writeFileSync(path.join(out,'documents',hash(d.url??d.id)+'.json'),JSON.stringify(d,null,2))}});
for(const work of plan){
 const file=path.join(out,work.caseId+'.json');const notebook=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{caseId:work.caseId,rounds:[],readings:[],scientificScore:null,status:'insufficient',expertCalibration:false};
 if(work.round>1&&!notebook.rounds.some(r=>r.round===work.round-1))throw Error('Missing previous actual round for '+work.caseId);
 if(work.round>1&&(!work.basis||!work.previousEvidence))throw Error('Adaptive rounds require rationale and previous evidence reference');
 const entry={...work,at:new Date().toISOString(),scientificSufficiency:false};
 try{if(work.action==='read'){entry.document=await network.read({url:work.url,title:work.title},AbortSignal.timeout(65000));notebook.readings.push(entry)}else{if(work.index==='arxiv'){
 const url='https://export.arxiv.org/api/query?search_query='+encodeURIComponent(work.query)+'&start=0&max_results=8&sortBy=relevance';
 const {respectSourceInterval}=await import('../packages/research-agent/src/innovation/public-pdf.ts');await respectSourceInterval(url,AbortSignal.timeout(15000));
 const response=await web.fetch({url},AbortSignal.timeout(30000));if(response.statusCode!==200)throw Error('arXiv search HTTP '+response.statusCode);
 entry.search={sources:[...response.body.content.matchAll(/<entry>([\s\S]*?)<\/entry>/gu)].map(m=>({url:m[1].match(/<id>([^<]+)<\/id>/u)?.[1]?.replace(/^http:/u,'https:'),title:rubricSourceText(m[1].match(/<title>([\s\S]*?)<\/title>/u)?.[1]??''),publicationDate:m[1].match(/<published>([^<]+)<\/published>/u)?.[1]?.slice(0,10)})),transport:'actual-arxiv-https',bodySha256:hash(response.body.content)};
 }else entry.search=await network.search(work.query,AbortSignal.timeout(50000));notebook.rounds.push(entry)}}catch(error){entry.error=String(error);(work.action==='read'?notebook.readings:notebook.rounds).push(entry)}
 fs.writeFileSync(file,JSON.stringify(notebook,null,2));console.log(JSON.stringify({caseId:work.caseId,round:work.round,action:work.action??'search',titles:entry.search?.sources.map(s=>({title:s.title,url:s.url,date:s.publicationDate})),coverage:entry.document?.provenance?.coverage,error:entry.error}));
}

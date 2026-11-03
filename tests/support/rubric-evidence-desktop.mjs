import {calculateRubricScore,RUBRIC_TABLE} from '../../packages/research-agent/lib/index.js';
/** Acceptance-only local inference + actual public HTTPS provider. Not shipped. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {LlmAdapter} from '@deepseek-ai/dsh-llm';
import {rubricFixture,taskFields} from './rubric-fixture.mjs';
export const inject=['llm','web','researchController'];
const hash=s=>createHash('sha256').update(s).digest('hex');
function texts(v){if(Array.isArray(v))return v.flatMap(texts);if(v&&typeof v==='object')return [...(v.type==='text'&&typeof v.text==='string'?[v.text]:[]),...Object.entries(v).filter(([k])=>k!=='text').flatMap(([,value])=>texts(value))];return []}
function trace(file,value){if(file)fs.appendFileSync(file,JSON.stringify({at:new Date().toISOString(),...value})+'\n')}
let activeMode='';let legacyCount=0;
const currentMode=()=>process.env.RESEARCH_CASE_SWITCH&&fs.existsSync(process.env.RESEARCH_CASE_SWITCH)?fs.readFileSync(process.env.RESEARCH_CASE_SWITCH,'utf8').trim():'default';
class LocalReasoning extends LlmAdapter {
 providerInfo(id){return {id,name:'本地 Rubric 验收 Mock'}}
 async listModels(provider){return [{provider,id:'research-fixture',name:'科研合成夹具 A'},{provider,id:'research-fixture-b',name:'科研合成夹具 B'}]}
 async resolveModel(provider,model){return {provider,id:model,name:model==='research-fixture'?'科研合成夹具 A':'科研合成夹具 B',inputModalities:model==='research-fixture'?['text','image']:['text'],defaultMaxTokens:model==='research-fixture'?768:2048,reasoning:{efforts:[{id:'fixture-low',name:'合成低'},{id:'fixture-high',name:'合成高'}],defaultEffort:model==='research-fixture'?'fixture-low':'fixture-high'}}}
 async *stream(options){
  options.signal?.throwIfAborted();
  const all=texts(options.messages??[]);
  const prompt=all.filter(t=>t.includes('[rubric-stage:')).at(-1)??all.join('\n');
  const mode=currentMode();if(mode!==activeMode){activeMode=mode;legacyCount=0}
  const stage=prompt.match(/\[rubric-stage:([^\]]+)\]/)?.[1];
  let text;
  const reviewer=all.join('\n').match(/以“([^”]+)”审查者身份评审下面/);
  if(reviewer){trace(process.env.RESEARCH_ACCEPTANCE_TRACE,{stage:'parallel-review',label:reviewer[1]});if(/novelty|创新/.test(reviewer[1])&&process.env.RESEARCH_REVIEW_FAULT_SWITCH&&fs.existsSync(process.env.RESEARCH_REVIEW_FAULT_SWITCH))throw Error('Synthetic single-reviewer failure for durable recovery acceptance');}
  if(stage==='target-task-extractor')text=JSON.stringify(taskFields);
  else if(stage){if(mode==='delay-shadow'&&stage==='contribution-extractor'){trace(process.env.RESEARCH_ACCEPTANCE_TRACE,{stage:'waiting-shadow-cancellation',phase:mode,signalPresent:!!options.signal});options.signal?.addEventListener('abort',()=>trace(process.env.RESEARCH_ACCEPTANCE_TRACE,{stage:'shadow-model-aborted',phase:mode}),{once:true});await new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('Acceptance fixture safety deadline')),45000);timer.unref();if(options.signal?.aborted)reject(options.signal.reason);else options.signal?.addEventListener('abort',()=>reject(options.signal.reason),{once:true})})}const marker=prompt.lastIndexOf('\n输入：');if(marker<0)throw Error('Rubric stage input missing');const payload=JSON.parse(prompt.slice(marker+4));text=JSON.stringify(rubricFixture(stage,payload,{live:true,duplicate:true}));}
  else if(all.join('\n').includes('完全独立的创新性专家')){const score=mode==='all-reject'?25:mode==='reject-then-pass'&&legacyCount++===0?35:88;text=JSON.stringify({score,overlap:false,rationale:'本地旧评分工程夹具，不作为科研判断。'});trace(process.env.RESEARCH_ACCEPTANCE_TRACE,{stage:'legacy-evaluation',phase:mode,score})}
  else text='# 合成科研输出\n\n创新点：复用公开DoRA论文的幅度/方向分解与低秩方向更新关系，作为重复负对照候选。\n\n公开来源：DoRA, arXiv:2402.09353。此为本地推理夹具，仅验证流程、证据和数值计算，不代表对DoRA整篇论文打分。';
  trace(process.env.RESEARCH_ACCEPTANCE_TRACE,{stage:stage??'legacy-or-chat',provider:options.provider,model:options.model,sessionId:options.sessionId,reasoningEffort:options.reasoningEffort??null,maxTokens:options.maxTokens??null,outputSha256:hash(text)});
  yield {type:'block-start',index:0,blockType:'text'};yield {type:'text-delta',index:0,text};yield {type:'block-end',index:0,block:{type:'text',text}};yield {type:'finish',reason:{kind:'stop'}};
 }
}
export function apply(ctx){
 ctx.effect(()=>{const controller=ctx.researchController;const original=controller.confirm;const wrapped=function(request,signal){trace(process.env.RESEARCH_ACCEPTANCE_TRACE,{stage:'host-confirm-signal',present:!!signal});signal?.addEventListener('abort',()=>trace(process.env.RESEARCH_ACCEPTANCE_TRACE,{stage:'host-confirm-aborted'}),{once:true});return original.call(this,request,signal)};controller.confirm=wrapped;return()=>{controller.confirm=original}});

 verifyBoundaryArithmetic();
 ctx.effect(()=>{const original=globalThis.fetch;const wrapped=async(input,init)=>{const url=new URL(input instanceof Request?input.url:String(input));const publicPaper=['arxiv.org','export.arxiv.org','openreview.net','aclanthology.org'].includes(url.hostname);if(publicPaper&&process.env.RESEARCH_OFFLINE_SWITCH&&fs.existsSync(process.env.RESEARCH_OFFLINE_SWITCH)){trace(process.env.RESEARCH_NETWORK_TRACE,{kind:'blocked-offline-pdf-or-html',url:url.href});throw Error('all public transports deliberately offline')}const response=await original(input,init);if(publicPaper&&(/\/pdf\//.test(url.pathname)||url.pathname==='/pdf'||url.pathname.endsWith('.pdf'))){const bytes=Buffer.from(await response.clone().arrayBuffer());const sha256=hash(bytes);trace(process.env.RESEARCH_NETWORK_TRACE,{kind:'actual-pdf-https',url:url.href,finalUrl:response.url,status:response.status,sha256,bytes:bytes.length});if(process.env.RESEARCH_NETWORK_BODIES){fs.mkdirSync(process.env.RESEARCH_NETWORK_BODIES,{recursive:true});fs.writeFileSync(path.join(process.env.RESEARCH_NETWORK_BODIES,sha256+'.pdf'),bytes)}}return response};globalThis.fetch=wrapped;return()=>{if(globalThis.fetch===wrapped)globalThis.fetch=original}});
 ctx.effect(()=>ctx.llm.registerAdapter(['research-mock'],new LocalReasoning()));
 ctx.effect(()=>ctx.web.registerFetchProvider({id:'research-rubric-public',available:()=>true,async fetch(request,signal){
  const requested=new URL(request.url);
  if(requested.hostname==='api.semanticscholar.org'&&!request.url.includes('openAccessPdf')){
   trace(process.env.RESEARCH_NETWORK_TRACE,{kind:'legacy-fixture',url:request.url});
   return {url:request.url,statusCode:200,truncated:false,body:{kind:'text',content:JSON.stringify({data:[{url:'https://example.test/legacy-baseline',title:'Legacy flow fixture',abstract:'Explicitly synthetic evidence for old 0-100 flow only'}]})}};
  }
  if(process.env.RESEARCH_OFFLINE_SWITCH&&fs.existsSync(process.env.RESEARCH_OFFLINE_SWITCH)){
   trace(process.env.RESEARCH_NETWORK_TRACE,{kind:'blocked-offline',url:request.url});throw Error('acceptance network deliberately disabled');
  }
  const allow=new Set(['api.openalex.org','api.semanticscholar.org','arxiv.org','export.arxiv.org','ar5iv.labs.arxiv.org','openreview.net','aclanthology.org','doi.org']);
  let url=request.url;
  for(let redirect=0;redirect<5;redirect++){
   const parsed=new URL(url);if(parsed.protocol!=='https:'||!allow.has(parsed.hostname))throw Error('Only public test-paper HTTPS origins allowed');
   const timeout=AbortSignal.timeout(30000);const combined=signal?AbortSignal.any([signal,timeout]):timeout;
   const response=await globalThis.fetch(url,{signal:combined,redirect:'manual',headers:{'User-Agent':'DSH-Rubric-Shadow-Acceptance/1.0 (public-paper-test)'}});
   if(response.status>=300&&response.status<400){const next=response.headers.get('location');if(!next)throw Error('redirect without location');url=new URL(next,url).href;continue}
   const content=await response.text();if(content.length>2_000_000)throw Error('public body exceeds acceptance limit');
   const sha256=hash(content);trace(process.env.RESEARCH_NETWORK_TRACE,{kind:'actual-https',url:request.url,finalUrl:response.url,status:response.status,bytes:Buffer.byteLength(content),sha256});
   if(process.env.RESEARCH_NETWORK_BODIES){fs.mkdirSync(process.env.RESEARCH_NETWORK_BODIES,{recursive:true});fs.writeFileSync(path.join(process.env.RESEARCH_NETWORK_BODIES,sha256+'.txt'),content)}
   return {url:response.url,statusCode:response.status,truncated:false,body:{kind:response.headers.get('content-type')?.includes('html')?'html':'text',content}};
  }
  throw Error('too many public redirects');
 }}));
}

function verifyBoundaryArithmetic(){
 if(!process.env.RESEARCH_BOUNDARY_TRACE)return;
 const fact=id=>({id,statement:id,evidence:[{sourceId:'synthetic-original',location:id,quote:'Synthetic independently specified structural fact '+id}]});
 const contribution=(id,category,S0=RUBRIC_TABLE[category][0])=>({id,claim:id,core:true,kind:'algorithm',evidence:fact(id).evidence,category,S0,R:0,R_included:0,eligibility:'verified',servesMainline:true,validityReview:'Synthetic engineering fact',validityFactIds:[id+'v'],categoryFactIds:[id+'c'],baseFactIds:[id+'b'],adaptationFactIds:[id+'r'],independenceFactIds:[id+'i'],sourceModuleAssessment:{origin:'synthetic',attribution:'synthetic',novelty:'synthetic',necessaryComplexity:'synthetic',role:'synthetic',factIds:[id+'s']},problemComparison:{oldProblem:'synthetic',newProblem:'synthetic',obstacle:'synthetic',mapping:'synthetic',effect:'synthetic',deduplication:'synthetic'},boundaryChecks:{lowerCategory:'synthetic',coreRelation:'synthetic',basicPrinciple:'synthetic',problemNonEquivalence:'synthetic',nonFragmentation:'synthetic',c8HighEnd:'synthetic independent high-end evidence',e9Conditions:'synthetic'}})
 const cases=[
  {name:'C8 high plus independent E1',cs:[contribution('m','C8',7),contribution('e','E1')],expected:8},
  {name:'P4 plus E1',cs:[contribution('p','P4'),contribution('e','E1')],expected:7.5},
  {name:'stronger secondary becomes main',cs:[contribution('b','B2'),contribution('c','C6')],expected:6},
  {name:'failed mainline M=4',cs:[contribution('c','C6')],mainline:'failed',expected:4},
  {name:'confirmed duplicate is zero',cs:[{...contribution('d','A2'),category:null,eligibility:'duplicate',S0:0}],expected:0}
 ];
 const results=cases.map(test=>{const facts=test.cs.flatMap(c=>['v','c','b','r','i','s'].map(s=>fact(c.id+s)));const result=calculateRubricScore(test.cs,facts,[],test.mainline??'established');if(result.S!==test.expected)throw Error('Boundary arithmetic mismatch: '+test.name);return {name:test.name,S:result.S,expected:test.expected,mainId:result.mainId,J:result.J,M:result.M}});
 fs.writeFileSync(process.env.RESEARCH_BOUNDARY_TRACE,JSON.stringify({mode:'synthetic-engineering-only',scientificEvaluation:false,at:new Date().toISOString(),runtimeNode:process.version,results},null,2));
}

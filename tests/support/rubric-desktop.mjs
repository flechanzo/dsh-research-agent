/** Acceptance-only local inference + actual public HTTPS provider. Not shipped. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {LlmAdapter} from '@deepseek-ai/dsh-llm';
import {rubricFixture,taskFields} from './rubric-fixture.mjs';
export const inject=['llm','web'];
const hash=s=>createHash('sha256').update(s).digest('hex');
function texts(v){if(Array.isArray(v))return v.flatMap(texts);if(v&&typeof v==='object')return [...(v.type==='text'&&typeof v.text==='string'?[v.text]:[]),...Object.entries(v).filter(([k])=>k!=='text').flatMap(([,value])=>texts(value))];return []}
function trace(file,value){if(file)fs.appendFileSync(file,JSON.stringify({at:new Date().toISOString(),...value})+'\n')}
class LocalReasoning extends LlmAdapter {
 providerInfo(id){return {id,name:'本地 Rubric 验收 Mock'}}
 async listModels(provider){return [{provider,id:'research-fixture',name:'科研合成夹具 A'},{provider,id:'research-fixture-b',name:'科研合成夹具 B'}]}
 async resolveModel(provider,model){return {provider,id:model,name:model==='research-fixture'?'科研合成夹具 A':'科研合成夹具 B',inputModalities:model==='research-fixture'?['text','image']:['text'],defaultMaxTokens:model==='research-fixture'?768:2048,reasoning:{efforts:[{id:'fixture-low',name:'合成低'},{id:'fixture-high',name:'合成高'}],defaultEffort:model==='research-fixture'?'fixture-low':'fixture-high'}}}
 async *stream(options){
  options.signal?.throwIfAborted();
  const all=texts(options.messages??[]);
  const prompt=all.filter(t=>t.includes('[rubric-stage:')).at(-1)??all.join('\n');
  const stage=prompt.match(/\[rubric-stage:([^\]]+)\]/)?.[1];
  let text;
  if(stage==='target-task-extractor')text=JSON.stringify(taskFields);
  else if(stage){const marker=prompt.lastIndexOf('\n输入：');if(marker<0)throw Error('Rubric stage input missing');const payload=JSON.parse(prompt.slice(marker+4));text=JSON.stringify(rubricFixture(stage,payload,{live:true,duplicate:true}));}
  else if(all.join('\n').includes('完全独立的创新性专家'))text=JSON.stringify({score:88,overlap:false,rationale:'本地旧评分夹具：固定88仅验证旧流程与shadow分歧，不作为科研判断。'});
  else text='# 合成科研输出\n\n创新点：复用公开DoRA论文的幅度/方向分解与低秩方向更新关系，作为重复负对照候选。\n\n公开来源：DoRA, arXiv:2402.09353。此为本地推理夹具，仅验证流程、证据和数值计算，不代表对DoRA整篇论文打分。';
  trace(process.env.RESEARCH_ACCEPTANCE_TRACE,{stage:stage??'legacy-or-chat',provider:options.provider,model:options.model,sessionId:options.sessionId,reasoningEffort:options.reasoningEffort??null,maxTokens:options.maxTokens??null,outputSha256:hash(text)});
  yield {type:'block-start',index:0,blockType:'text'};yield {type:'text-delta',index:0,text};yield {type:'block-end',index:0,block:{type:'text',text}};yield {type:'finish',reason:{kind:'stop'}};
 }
}
export function apply(ctx){
 ctx.effect(()=>ctx.llm.registerAdapter(['research-mock'],new LocalReasoning()));
 ctx.effect(()=>ctx.web.registerFetchProvider({id:'research-rubric-public',available:()=>true,async fetch(request,signal){
  const requested=new URL(request.url);
  if(requested.hostname==='api.semanticscholar.org'){
   trace(process.env.RESEARCH_NETWORK_TRACE,{kind:'legacy-fixture',url:request.url});
   return {url:request.url,statusCode:200,truncated:false,body:{kind:'text',content:JSON.stringify({data:[{url:'https://example.test/legacy-baseline',title:'Legacy flow fixture',abstract:'Explicitly synthetic evidence for old 0-100 flow only'}]})}};
  }
  if(process.env.RESEARCH_OFFLINE_SWITCH&&fs.existsSync(process.env.RESEARCH_OFFLINE_SWITCH)){
   trace(process.env.RESEARCH_NETWORK_TRACE,{kind:'blocked-offline',url:request.url});throw Error('acceptance network deliberately disabled');
  }
  const allow=new Set(['api.openalex.org','arxiv.org','export.arxiv.org','ar5iv.labs.arxiv.org']);
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

/** Manual-only metadata observer and fail-closed admission. No credentials or prompt bodies logged. */
import fs from 'node:fs';import path from 'node:path';import {randomUUID} from 'node:crypto';import yaml from 'js-yaml';
import {promptFacts,usageFacts,admissionProblem,redact,telemetryHtml} from '../../scripts/manual-test-utils.mjs';
import {verifyDesktopIsolation,assertTestWrite} from '../acceptance/desktop-isolation.mjs';
export const inject=['llm','web'];
export function apply(ctx){
 const c=verifyDesktopIsolation(JSON.parse(fs.readFileSync(process.env.DSH_TEST_ISOLATION_CONTEXT,'utf8')));
 const authFile=path.join(c.root,'authorization.json'),ledgerFile=path.join(c.root,'usage-ledger.json'),eventsFile=path.join(c.evidence,'model-metadata.jsonl');
 const json=(file,fallback)=>{try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch(error){if(error.code==='ENOENT')return fallback;throw error}};
 const secrets=()=>{try{return Object.values(yaml.load(fs.readFileSync(path.join(c.home,'.credentials.yaml'),'utf8'))?.refs??{}).filter(v=>typeof v==='string')}catch{return []}};
 const log=event=>fs.appendFileSync(assertTestWrite(c,eventsFile),JSON.stringify(redact({at:new Date().toISOString(),...event},secrets(),[c.root]))+'\n');
 let ledger=json(ledgerFile,{epoch:null,calls:0,promptCharacters:0,startedAt:0}),active=0;
 const save=()=>fs.writeFileSync(assertTestWrite(c,ledgerFile),JSON.stringify(ledger,null,2));
 // The official pre-dispatch hook records the capped controls in the native request header.
 const prepare=ctx.llm.prepareCall;
 ctx.llm.prepareCall=function(config,signal,configure){return prepare.call(this,config,signal,(controls,model)=>{const proposed=configure?configure(controls,model):controls;const auth=json(authFile,null);const cap=auth?.confirmed?auth.budget.maxOutputTokens:4096;return {...proposed,maxTokens:Math.min(proposed.maxTokens??model.defaultMaxTokens??cap,cap)}})};
 ctx.effect(()=>()=>{ctx.llm.prepareCall=prepare});
 ctx.on('llm/stream',async function*(options,next){
  const facts=promptFacts(options),mock=c.manualMode==='mock'&&options.provider==='research-mock';
  const auth=json(authFile,null);
  if(!mock){
   if(auth?.epoch!==ledger.epoch){if(active)throw Error('不能在模型运行中更新预算。');ledger={epoch:auth?.epoch??null,calls:0,promptCharacters:0,startedAt:0};}
   const problem=admissionProblem(auth,ledger,options,facts);
   if(problem){log({event:'blocked',provider:options.provider,model:options.model,...facts,reason:problem});throw Error(problem)}
  }
  const id=randomUUID(),start=Date.now();
  if(!mock){ledger.calls++;ledger.promptCharacters+=facts.promptCharacters;ledger.startedAt||=start;save()}
  active++;log({event:'request',id,scope:mock?'mock':'manual-real',provider:options.provider,model:options.model,maxTokens:options.maxTokens,...facts});
  let usage=null,finish=null,error=null;
  try{for await(const chunk of next()){if(chunk.type==='usage')usage=chunk.usage;if(chunk.type==='finish'){finish=chunk.reason.kind;if(chunk.reason.failure)error={code:chunk.reason.failure.code,status:chunk.reason.failure.status??null,message:chunk.reason.failure.message??null}}yield chunk}}
  catch(e){error={name:e.name,message:String(e.message??e)};throw e}
  finally{active--;log({event:'response',id,scope:mock?'mock':'manual-real',provider:options.provider,model:options.model,stage:facts.stage,milliseconds:Date.now()-start,finish,error,...usageFacts(usage),estimatedCost:null,costStatus:'unknown'})}
 });
 const snapshot=()=>{
  try{
   const events=fs.existsSync(eventsFile)?fs.readFileSync(eventsFile,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
   const rows=json(path.join(c.researchData,'rubric_execution.json'),{tables:{assessments:{}}}).tables?.assessments??{};
   const auth=json(authFile,{confirmed:false}),requests=events.filter(e=>e.event==='request'),responses=events.filter(e=>e.event==='response');
   const known=key=>responses.reduce((n,e)=>n+(e[key]??0),0);
   const data=redact({updatedAt:new Date().toISOString(),mode:c.manualMode,userConfirmation:auth,ledger,activeCalls:active,requests:requests.length,reportedInputTokens:responses.every(e=>e.inputTokens!==null)&&responses.length===requests.length?known('inputTokens'):null,reportedOutputTokens:responses.every(e=>e.outputTokens!==null)&&responses.length===requests.length?known('outputTokens'):null,knownReportedInputTokens:known('inputTokens'),knownReportedOutputTokens:known('outputTokens'),requestsWithoutTokenReport:responses.filter(e=>e.inputTokens===null||e.outputTokens===null).length,estimatedCost:null,costStatus:'未知',budgetScope:'手动累计闸门覆盖所有原生模型 dispatch；字符按完整序列化请求输入保守计数，Rubric 自身预算另记。总时间闸门限制后续准入；正在执行请求的取消由原生停止按钮及 Rubric 阶段超时处理。',assessments:Object.values(rows).map(r=>({id:r.id,status:r.status,currentStage:r.currentStage,nextResume:r.nextResume,resumeCount:r.resumeCount,usage:r.usage,budgetRuns:r.budgetRuns,steps:Object.values(r.steps).map(s=>({key:s.key,status:s.status,milliseconds:s.milliseconds??null,inputTokens:s.inputTokens,outputTokens:s.outputTokens,attempts:s.attempts,reuses:s.reuses,error:s.error??null}))})),events:events.slice(-80)},secrets(),[c.root]);
   fs.writeFileSync(assertTestWrite(c,path.join(c.evidence,'telemetry.json')),JSON.stringify(data,null,2));fs.writeFileSync(assertTestWrite(c,path.join(c.evidence,'统计.html')),telemetryHtml(data));
  }catch(error){ctx.logger.warn('Manual telemetry snapshot failed: %s',String(error.message??error))}
 };
 const timer=setInterval(snapshot,2000);timer.unref();snapshot();ctx.effect(()=>()=>{clearInterval(timer);snapshot()});
 log({event:'observer-ready',mode:c.manualMode,realCallsRequireUserConfirmation:true});
}

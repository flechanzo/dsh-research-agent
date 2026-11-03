/** Authorized local account-pool pilot; actual DSH LLM and public paper transports. */
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {runRubricAssessment} from '../../packages/research-agent/src/innovation/pipeline.ts';
import {createRubricNetwork} from '../../packages/research-agent/src/innovation/network.ts';
import {ShadowBudget} from '../../packages/research-agent/src/innovation/shadow.ts';
export const inject=['llm','web'];
const hash=value=>createHash('sha256').update(value).digest('hex');
export function apply(ctx){
 const out=process.env.RESEARCH_REAL_OUTPUT,trigger=process.env.RESEARCH_REAL_TRIGGER;if(!out||!trigger)throw Error('Missing isolated real pilot paths');fs.mkdirSync(out,{recursive:true});
 const log=x=>fs.appendFileSync(path.join(out,'events.jsonl'),JSON.stringify({at:new Date().toISOString(),...x})+'\n');
 let busy=false;const lifetime=new AbortController();
 ctx.effect(()=>{const timer=setInterval(()=>{if(busy||!fs.existsSync(trigger))return;busy=true;const work=JSON.parse(fs.readFileSync(trigger,'utf8'));fs.renameSync(trigger,trigger+'.consumed');
 void (async()=>{const results=[];for(const item of work.cases){
 const budget=new ShadowBudget({maxMilliseconds:90000,maxModelCalls:60,maxNetworkOperations:30,maxPromptCharacters:2000000,maxOcrPages:0});const signal=budget.begin(lifetime.signal);const folder=path.join(out,item.id);fs.mkdirSync(folder,{recursive:true});let usage=[];let assessment;
 const network=createRubricNetwork(ctx.web,{beforeRequest:()=>budget.network(),maxCharacters:500000,paperOptions:{maxPdfPages:100},onDocument:async d=>fs.writeFileSync(path.join(folder,hash(d.url??d.id)+'.json'),JSON.stringify(d,null,2)),onPdf:async(bytes,a)=>fs.writeFileSync(path.join(folder,a.sha256+'.pdf'),bytes),onText:async(text,a)=>fs.writeFileSync(path.join(folder,a.sha256+'.txt'),text)});
 try{assessment=await runRubricAssessment({targetTask:item.targetTask,candidate:item.candidate,papers:item.papers,network,signal,model:async(stage,prompt,callSignal)=>{
 signal.throwIfAborted();budget.model(prompt);const n=budget.usage.modelCalls;fs.writeFileSync(path.join(folder,String(n).padStart(2,'0')+'-'+stage+'-prompt.txt'),prompt);log({caseId:item.id,stage,event:'request',provider:'a',model:'gpt-6-sol',call:n,promptSha256:hash(prompt),promptCharacters:prompt.length,maxTokens:4096});
 let text='',finish;for await(const chunk of ctx.llm.stream({provider:'a',model:'gpt-6-sol',maxTokens:4096,messages:[{role:'user',content:[{type:'text',text:prompt}]}],signal:callSignal??signal})){
 if(chunk.type==='text-delta')text+=chunk.text;if(chunk.type==='usage'){usage.push(chunk.usage);log({caseId:item.id,stage,event:'usage',usage:chunk.usage})}if(chunk.type==='finish')finish=chunk.reason;
 }
 fs.writeFileSync(path.join(folder,String(n).padStart(2,'0')+'-'+stage+'-response.txt'),text);log({caseId:item.id,stage,event:'response',finish,outputSha256:hash(text)});if(finish?.kind!=='stop')throw Error('Real provider did not complete: '+JSON.stringify(finish));return text;
 }});}catch(error){log({caseId:item.id,event:'failure',error:String(error)})}finally{budget.end()}
 const result={caseId:item.id,provider:'a',displayName:'实验室',model:'gpt-6-sol',realModel:true,expertCalibration:false,softwareAssessmentCompleted:assessment?.assessmentStatus==='complete',scientificValidationPassed:false,policy:budget.policy,usage:budget.usage,tokenUsage:usage,exhausted:budget.exhausted??null,assessment:assessment??null};fs.writeFileSync(path.join(folder,'result.json'),JSON.stringify(result,null,2));results.push(result);log({caseId:item.id,event:'finished',status:assessment?.assessmentStatus??'error',S:assessment?.score.S??null});
 }fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({realOfficialHost:true,realModel:true,fullResearchFlow:false,expertCalibration:false,results},null,2));})().catch(error=>{log({event:'fatal',error:String(error)});fs.writeFileSync(path.join(out,'fatal.json'),JSON.stringify({error:String(error)}))});
 },200);return()=>{clearInterval(timer);lifetime.abort(new Error('Pilot disposed'))}});
}

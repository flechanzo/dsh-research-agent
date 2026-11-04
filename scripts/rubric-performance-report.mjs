/** Rebuild historical diagnostics from recorded events; never runs a model or fetches a paper. */
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
const root=process.cwd(),out=path.resolve(process.argv[2]??'.acceptance/rubric-efficiency-20261103/performance');
fs.mkdirSync(out,{recursive:true});
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/u,''));
const jsonl=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[];
const digest=s=>createHash('sha256').update(s).digest('hex');
const runs=[];
for(const name of ['real-model-pilot','real-model-pilot-release']){
 const folder=path.join(root,'.acceptance/rubric-science-20261103/desktop-isolated',name),result=read(path.join(folder,'result.json'));
 const events=jsonl(path.join(folder,'events.jsonl')),network=jsonl(path.join(folder,'network.jsonl'));
 const cases=[];
 for(const item of result.results){
  const own=events.filter(e=>e.caseId===item.caseId),stages=[],requests=own.filter(e=>e.event==='request');
  for(const [i,e] of requests.entries()){
   const end=own.find(x=>x.event==='response'&&x.stage===e.stage&&Date.parse(x.at)>=Date.parse(e.at)&&(!requests[i+1]||Date.parse(x.at)<Date.parse(requests[i+1].at)));
   const usage=own.find(x=>x.event==='usage'&&x.stage===e.stage&&Date.parse(x.at)>=Date.parse(e.at)&&(!requests[i+1]||Date.parse(x.at)<Date.parse(requests[i+1].at)))?.usage??null;
   const promptPath=path.join(folder,item.caseId,String(e.call).padStart(2,'0')+'-'+e.stage+'-prompt.txt');
   const prompt=fs.existsSync(promptPath)?fs.readFileSync(promptPath,'utf8'):null;
   let repeatedDocuments=[];
   if(prompt){try{const data=JSON.parse(prompt.slice(prompt.lastIndexOf('\n输入：')+4));const texts=[];function walk(v){if(!v||typeof v!=='object')return;if(typeof v.text==='string'&&v.text.length>300)texts.push({sha256:digest(v.text),characters:v.text.length});for(const child of Object.values(v))if(typeof child==='object')walk(child)}walk(data);repeatedDocuments=texts}catch{}}
   stages.push({stage:e.stage,request:e.call,promptCharacters:e.promptCharacters,promptSha256:e.promptSha256,
    milliseconds:end?Date.parse(end.at)-Date.parse(e.at):null,finish:end?.finish??null,reportedUsage:usage,documents:repeatedDocuments});
  }
  const modelWall=stages.reduce((sum,s)=>sum+(s.milliseconds??0),0);
  cases.push({caseId:item.caseId,totalMilliseconds:item.usage.milliseconds,modelRequestResponseMilliseconds:modelWall,
   nonModelUnattributedMilliseconds:Math.max(0,item.usage.milliseconds-modelWall),
   networkOperationBudgetCount:item.usage.networkOperations,modelRequests:item.usage.modelCalls,promptCharacters:item.usage.promptCharacters,
   reportedTokens:item.tokenUsage.reduce((sum,u)=>sum+(u.totalTokens??0),0),
   stoppedAt:stages.at(-1)?.stage??'unknown',assessment:item.assessment?.assessmentStatus??null,S:item.assessment?.score.S??null,
   stages,scope:'Historical records, not this turn execution. Missing/cancelled usage is not zero billed usage.'});
 }
 const status={},origins={},duplicates={};for(const e of network){if(e.status!==undefined)status[e.status]=(status[e.status]??0)+1;if(e.url){const host=new URL(e.url).hostname;origins[host]??={responses:0,rateLimited:0,failed:0};origins[host].responses++;if(e.status===429)origins[host].rateLimited++;if(e.status>=400)origins[host].failed++;if(e.sha256){const k=e.finalUrl??e.url;duplicates[k]??={responses:0,hashes:[]};duplicates[k].responses++;if(!duplicates[k].hashes.includes(e.sha256))duplicates[k].hashes.push(e.sha256)}}}
 runs.push({name,cases,network:{recordedEvents:network.length,status,origins,duplicateUrls:Object.entries(duplicates).filter(([,v])=>v.responses>1)},
  unavailableMeasurements:['No per-fetch start time; network delay cannot be inferred from response timestamps alone','No historic file I/O timing','No historic local CPU timing','Aborted model billing/token usage may be incomplete']});
}
const report={at:new Date().toISOString(),runs,interpretation:{
 model:'Request-to-response wall time includes provider generation, provider queueing, transport and stream handling; historic logs cannot separate those parts.',
 residual:'Non-model residual contains source waits/fetches and uninstrumented I/O/local work. It must not be called measured network latency.',
 completedStageReuse:'Historic completed JSON and original bytes could support an explicitly validated migration, but this implementation does not silently import them as current checkpoints.',
 minimumCalls:'One contribution requires 17 model stages: extractor + 3*(planner,independent plan review,selector,original reviewer) + validity,classifier,overlap,synthesis. No required stage is removed.',
 budget:'The 90-second interruption is primarily model wait in the two release pilots; increasing total time alone does not address rate limits or lost completed work.'}};
fs.writeFileSync(path.join(out,'historical.json'),JSON.stringify(report,null,2));
const rows=runs.flatMap(r=>r.cases.map(c=>`| ${r.name} / ${c.caseId} | ${(c.totalMilliseconds/1000).toFixed(3)} | ${(c.modelRequestResponseMilliseconds/1000).toFixed(3)} | ${(c.nonModelUnattributedMilliseconds/1000).toFixed(3)} | ${c.modelRequests} | ${c.reportedTokens} | ${c.stoppedAt} |`));
let md='上轮真实模型原始日志重分析；下列数值不是本轮真实模型执行。\n\n| 记录/候选 | 总秒数 | 模型请求至响应秒数 | 未归因剩余秒数 | 请求数 | 已报告 Token | 停止位置 |\n| --- | ---: | ---: | ---: | ---: | ---: | --- |\n'+rows.join('\n')+'\n\n';
for(const run of runs){md+=`记录 ${run.name}：HTTP 状态分布 ${JSON.stringify(run.network.status)}。\n\n`;for(const c of run.cases){md+=`${c.caseId} 逐阶段：\n\n| 阶段 | 秒 | 提示字符 | 已报告输入/输出 Token | 结束原因 |\n| --- | ---: | ---: | --- | --- |\n`;for(const s of c.stages)md+=`| ${s.stage} | ${s.milliseconds===null?'未知':(s.milliseconds/1000).toFixed(3)} | ${s.promptCharacters} | ${s.reportedUsage?.inputTokens??'未知'}/${s.reportedUsage?.outputTokens??'未知'} | ${s.finish?.kind??'未知'} |\n`;md+='\n';}}
md+='模型列含 provider 排队、生成和模型传输。历史网络日志只有响应时间，不能测得单次网络延迟；文件读取和本地计算缺独立计时，均记未知，未用剩余时间冒充。取消请求的零 Token 事件不能当作零计费。完整逐阶段数据、重复 URL 与正文哈希见 historical.json。\n';
fs.writeFileSync(path.join(out,'historical.md'),md);console.log(JSON.stringify(runs.map(r=>({name:r.name,cases:r.cases.map(c=>({id:c.caseId,modelMs:c.modelRequestResponseMilliseconds,totalMs:c.totalMilliseconds})),status:r.network.status}))));

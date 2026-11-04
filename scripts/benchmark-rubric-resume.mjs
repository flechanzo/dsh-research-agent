/** Controlled before/after prompt comparison on identical archived public text and explicit Mock decisions. */
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import {build} from 'esbuild';
import {rubricFixture,taskFields} from '../tests/support/rubric-fixture.mjs';
const out=path.resolve('.acceptance/rubric-efficiency-20261103/performance');fs.mkdirSync(out,{recursive:true});
const source=JSON.parse(fs.readFileSync('.acceptance/rubric-science-20261103/science/modern-dora-reproduction.json','utf8'));
const publicDocs=source.readings.slice(0,2).map((r,i)=>({...r.document,publicationDate:i===0?'2024-02-14':'2016-02-25'}));
const sources=publicDocs.map(d=>({url:d.url,title:d.title,publicationDate:d.publicationDate}));
const targetTask={...taskFields,contextDigest:'a'.repeat(64),confirmedAt:1};
const results=[];
for(const label of ['baseline','current']){
 const entry=label==='baseline'?'.acceptance/rubric-efficiency-20261103/checkpoint/source/packages/research-agent/src/innovation/pipeline.ts':'packages/research-agent/src/innovation/pipeline.ts';
 const dest=path.join(out,'bench-'+label+'.mjs');
 await build({stdin:{contents:`export * from ${JSON.stringify(path.resolve(entry).replaceAll('\\','/'))};${label==='current'?`export {MemoryRubricCheckpointStore} from ${JSON.stringify(path.resolve('packages/research-agent/src/innovation/checkpoints.ts').replaceAll('\\','/'))};`:''}`,resolveDir:process.cwd(),loader:'ts'},outfile:dest,bundle:true,platform:'node',format:'esm',packages:'external',define:{'import.meta.url':JSON.stringify(pathToFileURL(path.resolve('packages/research-agent/src/innovation/resource.ts')).href)}});
 const module=await import(pathToFileURL(dest).href),events=[];let searches=0,reads=0,modelCalls=0;
 const network={search:async()=>{searches++;return {sources,acquisitions:[{...publicDocs[0].acquisition,transport:'dsh-web'}],errors:[]}},read:async s=>{reads++;return publicDocs.find(d=>d.url===s.url)}};
 const input={targetTask,candidate:'创新点：复用已公开的 DoRA 幅度/方向分解与低秩方向更新关系。仅为 Mock 工程性能夹具。',papers:[{...publicDocs[0],id:'paper:controlled-upload',url:undefined}],network,
  model:async(stage,prompt)=>{modelCalls++;const start=performance.now();const parsed=JSON.parse(prompt.slice(prompt.lastIndexOf('\n输入：')+4));const result=JSON.stringify(rubricFixture(stage,parsed,{live:true,duplicate:true}));events.push({stage,promptCharacters:prompt.length,outputCharacters:result.length,milliseconds:performance.now()-start});return result}};
 if(label==='current')input.execution={store:new module.MemoryRubricCheckpointStore(),modelIdentity:'controlled-mock:v1',sourceRevision:'benchmark-current'};
 const start=performance.now(),assessment=await module.runRubricAssessment(input);
 const row={label,wallMilliseconds:performance.now()-start,modelCalls,searches,reads,promptCharacters:events.reduce((s,e)=>s+e.promptCharacters,0),S:assessment.score.S,status:assessment.assessmentStatus,uncertainties:assessment.uncertainties,events};
 results.push(row);
 if(label==='current'){
  const before={modelCalls,searches,reads},again=performance.now();const resumed=await module.runRubricAssessment(input);
  results.push({label:'current-identical-resume',wallMilliseconds:performance.now()-again,modelCalls:modelCalls-before.modelCalls,searches:searches-before.searches,reads:reads-before.reads,promptCharacters:0,S:resumed.score.S,status:resumed.assessmentStatus,events:[]});
 }
}
const report={at:new Date().toISOString(),scope:'Mock inference; archived public DoRA/WN full text; no model tokens or live network requests. Source acquisition dates/bodies remain archived; comparison metadata is a deterministic fixture, not a historical scientific score.',
 baselineSource:JSON.parse(fs.readFileSync('.acceptance/rubric-efficiency-20261103/checkpoint/source-index.json','utf8')).sourceSha256,
 promptReductionCharacters:results[0].promptCharacters-results[1].promptCharacters,
 promptReductionPercent:100*(results[0].promptCharacters-results[1].promptCharacters)/results[0].promptCharacters,
 note:'Timing is local Mock/JSON/checkpoint overhead. It does not measure real model speedup. Complete source body, core formulas, proofs and independent reviews are retained.',results};
fs.writeFileSync(path.join(out,'controlled-comparison.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,results:results.map(({events,...r})=>r)}));

import {it,expect,vi} from 'vitest'
import {ResearchCoordinator,createResearchState,appendResearchOutput,confirmResearchNode} from '../packages/research-agent/src/workflows/index.ts'
import type {ResearchCoordinatorAdapters} from '../packages/research-agent/src/workflows/research-coordinator.ts'
import type {ShadowAudit} from '../packages/research-agent/src/innovation/shadow.ts'
import {taskFields,syntheticText,rubricFixture} from './support/rubric-fixture.mjs'
import type { ReviewCheckpoint } from '../packages/research-agent/src/workflows/review-checkpoints.ts'
import { shadowPolicySchema } from '../packages/research-agent/src/innovation/shadow.ts'
function fixture(scores=[20,88],policy:ResearchCoordinatorAdapters['shadow']={}){
 const audits:ShadowAudit[]=[];let oldCalls=0;let rubricCalls=0
 const acquisition={url:'https://example.test/original',at:'2026-11-02',status:200,sha256:'a'.repeat(64),transport:'dsh-web' as const,truncated:false}
 const adapter:ResearchCoordinatorAdapters={
  shadow:policy,onShadowAudit:async a=>{const copy=structuredClone(a);const i=audits.findIndex(x=>x.id===a.id);if(i<0)audits.push(copy);else audits[i]=copy},
  papers:{read:async p=>({fileName:p.name,text:syntheticText,byteLength:100,extractionMethod:'plain-text'})},
  literature:{search:async()=>[{url:'https://example.test/legacy'}]},
  rubricNetwork:{search:async()=>({sources:[{url:acquisition.url,title:'Synthetic original',publicationDate:'2024-01-01'},{url:'https://example.test/alternative',title:'Synthetic alternative',publicationDate:'2023-01-01'}],acquisitions:[acquisition],errors:[]}),read:async s=>({id:s.url,title:s.title,text:syntheticText,primary:true,publicationDate:s.publicationDate,url:s.url,acquisition:{...acquisition,url:s.url}})},
  agents:{run:async(role,prompt)=>{
   if(role==='idea-generator')return '创新点：工程合成局部规则候选'
   if(role==='innovation-reviewer')return JSON.stringify({score:scores[Math.min(oldCalls++,scores.length-1)],overlap:false,rationale:'旧流程夹具'})
   rubricCalls++
   return JSON.stringify(rubricFixture(role.slice(7),JSON.parse(prompt.slice(prompt.lastIndexOf('\n输入：')+4))))
  }}
 }
 let state=appendResearchOutput(createResearchState(),{stage:'paper-read',kind:'summary',title:'原文',content:'Synthetic',paperRefs:[{attachmentId:'sha256:synthetic' as never,name:'synthetic.txt',bytes:100}]})
 state=confirmResearchNode(state);state=appendResearchOutput(state,{stage:'problem-summary',kind:'problem',title:'问题',content:'合成任务'});state=confirmResearchNode(state)
 state=appendResearchOutput(state,{stage:'literature-search',kind:'literature',title:'证据',content:'已取得的合成来源'});state=confirmResearchNode(state)
 const node=state.nodes[state.selectedNodeId]!
 state={...state,nodes:{...state.nodes,[node.nodeId]:{...node,memorySnapshot:{...node.memorySnapshot,targetTask:{...taskFields,contextDigest:'a'.repeat(64),confirmedAt:1}}}}}
 return {adapter,audits,state,run:(signal?:AbortSignal)=>new ResearchCoordinator(adapter).advance({state,parent:{} as never,...(signal?{signal}:{})}),calls:()=>({oldCalls,rubricCalls})}
}
it('audits rejected and accepted candidates independently while preserving attempts and old result',async()=>{
 const f=fixture();const r=await f.run();expect(f.calls().oldCalls).toBe(2);expect(f.audits.map(a=>a.legacy.status)).toEqual(['reject','pass']);expect(f.audits.map(a=>a.lifecycle)).toEqual(['complete','complete']);expect(r.artifact?.evaluation?.score).toBe(88);expect(f.audits[0]?.assessment?.legacyComparison?.pass).toBe(false)
})
it('preserves all three rejected attempts after legacy failure and leaves DAG unchanged',async()=>{
 const f=fixture([20]);const before=JSON.stringify(f.state);await expect(f.run()).rejects.toThrow('INNOVATION_SCORE_BELOW_THRESHOLD');expect(f.calls().oldCalls).toBe(3);expect(f.audits).toHaveLength(3);expect(f.audits.every(a=>a.legacy.status==='reject')).toBe(true);expect(JSON.stringify(f.state)).toBe(before)
})
it.each([{maxModelCalls:0},{maxNetworkOperations:0},{maxPromptCharacters:1},{maxCandidates:0}])('budget %j never changes old pass or produces unsupported score',async policy=>{
 const f=fixture([88],policy);const r=await f.run();expect(r.artifact?.evaluation?.score).toBe(88);expect(f.audits[0]?.lifecycle).toBe('budget-exhausted');expect(f.audits[0]?.assessment?.score.S??null).toBeNull()
})
it('keeps Rubric opt-in while always running the legacy originality evaluation',async()=>{
 const f=fixture([88],{enabled:false});const result=await f.run()
 expect(f.calls().rubricCalls).toBe(0)
 expect(f.calls().oldCalls).toBe(1)
 expect(result.artifact?.evaluation?.score).toBe(88)
 expect(f.audits[0]?.lifecycle).toBe('disabled')
 expect(f.audits[0]?.assessment).toBeUndefined()
})

it('defaults the optional Rubric metric to disabled and allows explicit opt-in',()=>{
 expect(shadowPolicySchema.parse({}).enabled).toBe(false)
 expect(shadowPolicySchema.parse({enabled:true}).enabled).toBe(true)
})
it('aggregate candidate cap preserves three legacy retries',async()=>{const f=fixture([20],{maxCandidates:1});await expect(f.run()).rejects.toThrow();expect(f.calls().oldCalls).toBe(3);expect(f.audits.map(a=>a.lifecycle)).toEqual(['complete','budget-exhausted','budget-exhausted'])})
it('deadline aborts isolated work and allows old pass to finish',async()=>{
 const f=fixture([88],{maxMilliseconds:20});const original=f.adapter.agents.run
 f.adapter.agents.run=async(role,prompt,parent,signal)=>{if(role.startsWith('rubric-'))return new Promise((_resolve,reject)=>{signal?.addEventListener('abort',()=>reject(signal.reason),{once:true})});return original(role,prompt,parent,signal)}
 const r=await f.run();expect(r.artifact?.evaluation?.score).toBe(88);expect(f.audits[0]?.lifecycle).toBe('budget-exhausted');expect(f.audits[0]?.assessment?.score.S).toBeNull()
})
it('user cancellation preserves true old reject and unfinished Shadow status',async()=>{
 const f=fixture([20]);const abort=new AbortController();const original=f.adapter.agents.run
 f.adapter.agents.run=async(role,prompt,parent,signal)=>{if(role.startsWith('rubric-')){abort.abort(new Error('cancelled by user'));signal?.throwIfAborted()}return original(role,prompt,parent,signal)}
 await expect(f.run(abort.signal)).rejects.toThrow('cancelled by user');expect(f.audits[0]?.legacy.status).toBe('reject');expect(f.audits[0]?.lifecycle).toBe('cancelled');expect(f.audits[0]?.assessment?.score.S).toBeNull();expect(f.calls().oldCalls).toBe(1)
})
it('records pre-evaluation legacy failure without fabricating Rubric completion',async()=>{
 const f=fixture();f.adapter.literature.search=async()=>{throw Error('legacy search failed')}
 await expect(f.run()).rejects.toThrow('legacy search failed');expect(f.audits[0]?.lifecycle).toBe('legacy-error');expect(f.audits[0]?.legacy.status).toBe('error');expect(f.audits[0]?.assessment).toBeUndefined();expect(f.calls().rubricCalls).toBe(0)
})
it('audit storage failure is visible but never rejects an old pass',async()=>{
 const f=fixture([88]);f.adapter.onShadowAudit=async()=>{throw Error('audit disk unavailable')};const warn=vi.spyOn(console,'warn').mockImplementation(()=>{})
 try{expect((await f.run()).artifact?.evaluation?.score).toBe(88);expect(warn).toHaveBeenCalledWith('SHADOW_AUDIT_PERSIST_FAILED',expect.any(String),expect.any(Error))}finally{warn.mockRestore()}
})

it('resumes an interrupted third candidate without regenerating or rescoring the completed attempts', async () => {
 const f=fixture([20,20,88],{enabled:false}), rows=new Map<string,ReviewCheckpoint>()
 Object.assign(f.adapter,{reviewScope:'same-session',reviewCheckpoints:{get:async(id:string)=>rows.get(id),put:async(row:ReviewCheckpoint)=>{rows.set(row.id,structuredClone(row))}}})
 const original=f.adapter.agents.run;let generations=0,interrupted=false
 f.adapter.agents.run=async(role,prompt,parent,signal)=>{
  if(role==='idea-generator')generations++
  if(role==='innovation-reviewer'&&generations===3&&!interrupted){interrupted=true;throw Error('stage timeout')}
  return original(role,prompt,parent,signal)
 }
 await expect(f.run()).rejects.toThrow('stage timeout')
 expect(generations).toBe(3);expect(f.calls().oldCalls).toBe(2)
 const result=await f.run()
 expect(result.artifact?.evaluation?.score).toBe(88)
 expect(generations).toBe(3);expect(f.calls().oldCalls).toBe(3)
})

it('uses the independent rubric PDF page budget when rereading uploaded papers', async () => {
 const f=fixture([88],{maxPdfPages:30}),read=vi.spyOn(f.adapter.papers,'read')
 await f.run()
 expect(read.mock.calls[0]?.[2]?.maxPdfPages).toBe(30)
})

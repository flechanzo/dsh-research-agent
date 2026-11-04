import {afterEach,describe,expect,it,vi} from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {runRubricAssessment,type RubricDocument,type RubricNetwork} from '../packages/research-agent/src/innovation/pipeline.ts'
import {MemoryRubricCheckpointStore} from '../packages/research-agent/src/innovation/checkpoints.ts'
import {FileRubricCheckpointStore} from '../packages/research-agent/src/innovation/file-checkpoints.ts'
import {ShadowBudget} from '../packages/research-agent/src/innovation/shadow.ts'
import {textDigest} from '../packages/research-agent/src/innovation/documents.ts'
import {rubricFixture,syntheticText,taskFields} from './support/rubric-fixture.mjs'
const roots:string[]=[]
afterEach(()=>{for(const r of roots.splice(0))fs.rmSync(r,{recursive:true,force:true})})
function fixture(){
 const task={...taskFields,confirmedAt:1,contextDigest:'a'.repeat(64)}
 const source=(alternative=false)=>({url:'https://example.test/'+(alternative?'alternative':'original'),title:alternative?'Synthetic alternative':'Synthetic original',publicationDate:'2024-01-01'})
 const doc=(s:ReturnType<typeof source>):RubricDocument=>({id:s.url.endsWith('alternative')?'alternative':'remote',...s,text:syntheticText,primary:true,
   acquisition:{url:s.url,at:'2026-11-03T00:00:00Z',status:200,sha256:'a'.repeat(64),transport:'dsh-web',truncated:false},
   provenance:{originalUrl:s.url,version:'v1',versionDate:'2024-01-01',textSha256:textDigest(syntheticText),coverage:'core-complete',extraction:'html',truncated:false,locations:[{label:'method',start:0,end:syntheticText.length}],links:[]}})
 const search=vi.fn(async()=>({sources:[source(),source(true)],acquisitions:[doc(source()).acquisition!],errors:[]}))
 const read=vi.fn(async(s:ReturnType<typeof source>)=>doc(s))
 const network:RubricNetwork={search,read}
 const model=vi.fn(async(stage:string,prompt:string)=>JSON.stringify(rubricFixture(stage,JSON.parse(prompt.slice(prompt.lastIndexOf('\n输入：')+4)))))
 const store=new MemoryRubricCheckpointStore()
 const execution={store,assessmentId:'resume-case',modelIdentity:'fixture-route:model:v1',sourceRevision:'source-v1',maxStageMilliseconds:1000}
 return {input:{targetTask:task,candidate:'创新点：受控测试',papers:[{id:'paper:synthetic',title:'Synthetic primary',text:syntheticText,primary:true,publicationDate:null}],model,network,execution},store,search,read,model}
}
describe('Rubric durable stages (mock inference and transport)',()=>{
 it('retains changed transport diagnostics in the audit without invalidating identical scientific model inputs',async()=>{
  const f=fixture(),search=f.input.network.search;let resumed=false
  f.input.network.search=async(query,signal)=>({...await search(query,signal),errors:[resumed?'Index cooling down':'Index HTTP 429']})
  expect((await runRubricAssessment(f.input)).assessmentStatus).toBe('complete');resumed=true;f.model.mockClear()
  const a=await runRubricAssessment(f.input)
  expect(a.assessmentStatus).toBe('complete');expect(a.searchAudit[0]?.errors).toContain('Index cooling down');expect(f.model).not.toHaveBeenCalled()
 })
 it('preserves the previous successful model when the next stage preflight exhausts its budget',async()=>{
  const f=fixture();let stages=0
  const interrupted=await runRubricAssessment({...f.input,onStage:async()=>{if(++stages===7)throw Error('Shadow model-call budget exhausted')}})
  expect(interrupted.score.S).toBeNull();expect(f.model).toHaveBeenCalledTimes(6)
  expect(Object.values((await f.store.get('resume-case'))!.steps).filter(s=>s.kind==='model'&&s.status==='succeeded')).toHaveLength(6)
  f.model.mockClear();expect((await runRubricAssessment(f.input)).assessmentStatus).toBe('complete');expect(f.model).toHaveBeenCalledTimes(11)
 })
 it('reuses a successful format repair and subsequent steps at the same cursor without model calls',async()=>{
  const f=fixture();let first=true
  const model=vi.fn(async(stage:string,prompt:string)=>{const output=JSON.parse(await f.model(stage,prompt));if(stage==='source-verifier'&&first){first=false;output.readings[0].quote='A fabricated quotation absent from acquired evidence.'}return JSON.stringify(output)})
  expect((await runRubricAssessment({...f.input,model})).assessmentStatus).toBe('complete')
  model.mockClear();f.search.mockClear();f.read.mockClear()
  expect((await runRubricAssessment({...f.input,model})).assessmentStatus).toBe('complete')
  expect(model).not.toHaveBeenCalled();expect(f.search).not.toHaveBeenCalled();expect(f.read).not.toHaveBeenCalled()
  expect((await f.store.get('resume-case'))?.usage.replayedValidationFailures).toBe(1)
 })
 it('retries a transient Windows rename only when saving, preserving the successful search without rebilling',async()=>{
  const f=fixture(),put=f.store.put.bind(f.store);let failed=0
  f.store.put=async row=>{const step=row.steps[row.currentStage];if(step?.kind==='search'&&step.status==='succeeded'&&failed<2){failed++;throw Error('EPERM: operation not permitted, rename temp -> rubric_execution.json')}await put(row)}
  const result=await runRubricAssessment(f.input)
  expect(result.assessmentStatus).toBe('complete');expect(failed).toBe(2);expect(f.search).toHaveBeenCalledTimes(3);expect(f.model).toHaveBeenCalledTimes(17)
 })
 it.each(['EPERM: operation not permitted, rename temp -> rubric_execution.json','disk unavailable'])('does not make external calls if initial persistence still fails: %s',async(message)=>{
  const f=fixture();const put=vi.fn(async()=>{throw Error(message)});f.store.put=put
  const result=await runRubricAssessment(f.input)
  expect(result.score.S).toBeNull();expect(result.uncertainties.join()).toContain('检查点保存失败')
  expect(put).toHaveBeenCalledTimes(message.startsWith('EPERM')?4:1);expect(f.model).not.toHaveBeenCalled();expect(f.search).not.toHaveBeenCalled()
 })
 it('does not turn a search checkpoint persistence failure into an empty search and continue',async()=>{
  const f=fixture(),put=f.store.put.bind(f.store)
  f.store.put=async row=>{const step=row.steps[row.currentStage];if(step?.kind==='search'&&step.status==='succeeded')throw Error('disk unavailable');await put(row)}
  const result=await runRubricAssessment(f.input)
  expect(result.score.S).toBeNull();expect(result.uncertainties.join()).toContain('检查点保存失败');expect(f.search).toHaveBeenCalledTimes(1);expect(f.read).not.toHaveBeenCalled()
 })
 it('reuses every completed identical stage and retains three distinct rounds',async()=>{const f=fixture();const first=await runRubricAssessment(f.input);expect(first.uncertainties).toEqual([]);expect(first.assessmentStatus).toBe('complete');const n=f.model.mock.calls.length;expect(n).toBe(17);f.model.mockClear();f.search.mockClear();f.read.mockClear();const second=await runRubricAssessment(f.input);expect(second.assessmentStatus).toBe('complete');expect(second.searchAudit).toHaveLength(3);expect(f.model).not.toHaveBeenCalled();expect(f.search).not.toHaveBeenCalled();expect(f.read).not.toHaveBeenCalled();expect((await f.store.get('resume-case'))?.resumeCount).toBe(1)})
 it('saves a timeout and resumes after a new file repository is opened',async()=>{const f=fixture();const root=fs.mkdtempSync(path.join(os.tmpdir(),'rubric-resume-'));roots.push(root);const store=new FileRubricCheckpointStore(root);const model=async(stage:string,prompt:string)=>stage==='search-planner'?await new Promise<string>(()=>{}):f.input.model(stage,prompt);const input={...f.input,model,execution:{...f.input.execution,store,maxStageMilliseconds:20}};const a=await runRubricAssessment(input);expect(a.score.S).toBeNull();const row=await store.get('resume-case');expect(row?.status).toBe('interrupted');expect(Object.values(row!.steps).filter(s=>s.status==='succeeded')).toHaveLength(1);f.model.mockClear();const b=await runRubricAssessment({...f.input,execution:{...f.input.execution,store:new FileRubricCheckpointStore(root)}});expect(b.assessmentStatus).toBe('complete');expect(f.model.mock.calls.filter(([s])=>s==='contribution-extractor')).toHaveLength(0);expect(fs.existsSync(path.join(root,'resume-case.lock'))).toBe(false)})
 it.each(['target','rubric','model','source','candidate'])('rejects incompatible explicit resume: %s',async change=>{const f=fixture();await runRubricAssessment(f.input);f.model.mockClear();const input={...f.input,execution:{...f.input.execution}};if(change==='target')input.targetTask={...input.targetTask,problem:'改变后的目标任务'};if(change==='rubric')Object.assign(input.execution,{rubricSha256:'b'.repeat(64),rubricVersion:'1.8.0'});if(change==='model')input.execution.modelIdentity='fixture-route:model:v2';if(change==='source')input.execution.sourceRevision='source-v2';if(change==='candidate')input.candidate+=' changed';const a=await runRubricAssessment(input);expect(a.score.S).toBeNull();expect(a.uncertainties.join()).toMatch(/identity mismatch/);expect(f.model).not.toHaveBeenCalled()})
 it('creates a separate assessment for a changed target without an explicit ID',async()=>{const f=fixture();const execution={...f.input.execution,assessmentId:undefined};await runRubricAssessment({...f.input,execution});await runRubricAssessment({...f.input,targetTask:{...f.input.targetTask,problem:'另一个任务'},execution});expect(f.store.rows.size).toBe(2);expect(f.model.mock.calls.filter(([s])=>s==='contribution-extractor')).toHaveLength(2)})
 it('does not commit late model output after cancellation',async()=>{const f=fixture();const abort=new AbortController();let late:(s:string)=>void=()=>{};const work=runRubricAssessment({...f.input,signal:abort.signal,model:async()=>new Promise(resolve=>{late=resolve})});await vi.waitFor(async()=>expect((await f.store.get('resume-case'))?.currentStage).toMatch(/extractor/));abort.abort(new Error('user cancelled'));expect((await work).score.S).toBeNull();late('{}');await new Promise(resolve=>setTimeout(resolve,5));expect((await f.store.get('resume-case'))?.steps['0:contribution-extractor']?.status).toBe('cancelled');expect((await f.store.get('resume-case'))?.steps['0:contribution-extractor']?.output).toBeUndefined()})
 it('refuses two concurrent resumes of the same assessment',async()=>{const f=fixture();const abort=new AbortController();const first=runRubricAssessment({...f.input,signal:abort.signal,model:async()=>new Promise(()=>{})});await vi.waitFor(()=>expect(f.store.rows.size).toBe(1));const second=await runRubricAssessment(f.input);expect(second.score.S).toBeNull();expect(second.uncertainties.join()).toMatch(/already running/);expect(f.model).not.toHaveBeenCalled();abort.abort();await first})
 it('keeps completed evidence and S=null on model-call budget exhaustion',async()=>{const f=fixture();const budget=new ShadowBudget({maxModelCalls:6});const signal=budget.begin();const a=await runRubricAssessment({...f.input,signal,model:async(stage,prompt)=>{budget.model(prompt);return f.model(stage,prompt)}});budget.end();expect(a.score.S).toBeNull();expect(a.searchAudit[0]?.completed).toBe(true);expect((await f.store.get('resume-case'))?.status).toBe('budget-exhausted');expect(Object.values((await f.store.get('resume-case'))!.steps).some(s=>s.kind==='read'&&s.status==='succeeded')).toBe(true)})
 it('does not persist a running model call if durable storage is unavailable',async()=>{const f=fixture();f.store.put=async()=>{throw Error('disk unavailable')};expect((await runRubricAssessment(f.input)).score.S).toBeNull();expect(f.model).not.toHaveBeenCalled()})
 it('never interprets failed/rate-limited search as a duplicate score',async()=>{const f=fixture();f.input.network.search=async()=>({sources:[],acquisitions:[{url:'https://example.test/search',at:new Date().toISOString(),status:429,sha256:'x',transport:'dsh-web',truncated:false}],errors:['429 temporary rate limit'],status:'rate-limited'});const a=await runRubricAssessment(f.input);expect(a.score.S).toBeNull();expect(a.assessmentStatus).toBe('insufficient');expect(a.searchAudit[0]?.completed).toBe(false)})
 it('records reported tokens without estimating unavailable usage',async()=>{const f=fixture();const model=async(stage:string,prompt:string)=>({text:await f.model(stage,prompt),finish:'completed' as const,inputTokens:100,outputTokens:20});expect((await runRubricAssessment({...f.input,model})).assessmentStatus).toBe('complete');const row=await f.store.get('resume-case');expect(row?.usage.reportedInputTokens).toBe(1700);expect(row?.usage.reportedOutputTokens).toBe(340);expect(Object.values(row!.steps).filter(s=>s.kind==='search').every(s=>s.inputTokens===null)).toBe(true)})
 it('preserves all core text and proofs when identical bodies share a prompt',async()=>{const f=fixture();await runRubricAssessment(f.input);const request=f.model.mock.calls.find(([stage])=>stage==='rubric-classifier')![1];const payload=JSON.parse(request.slice(request.lastIndexOf('\n输入：')+4));expect(payload.documents[0].text).toBe(syntheticText);expect(payload.documents[0].aliases.some((a:{id:string})=>a.id==='paper:synthetic')).toBe(true);expect((await f.store.get('resume-case'))?.materials).toContain(syntheticText)})
 it('does not count different HTML/PDF titles of one work as cross-verification',async()=>{const f=fixture();const read=f.input.network.read;f.input.network.read=async(source,signal)=>({...await read(source,signal),workId:'arxiv:one-work'});const a=await runRubricAssessment(f.input);expect(a.score.S).toBeNull();expect(a.uncertainties.join()).toMatch(/同一工作/)})
 it('does not reuse aborted structured model outputs as success',async()=>{const f=fixture();const a=await runRubricAssessment({...f.input,model:async(stage,prompt)=>({text:await f.model(stage,prompt),finish:'aborted',inputTokens:100,outputTokens:5})});expect(a.score.S).toBeNull();expect((await f.store.get('resume-case'))?.steps['0:contribution-extractor']?.status).toBe('failed')})
 it('invalidates schema-valid output that fails original-text semantic verification',async()=>{const f=fixture();const model=async(stage:string,prompt:string)=>{const output=JSON.parse(await f.model(stage,prompt));if(stage==='contribution-extractor')output.contributions[0].evidence[0].quote='This quotation is entirely invented and does not occur in the original.';return JSON.stringify(output)};expect((await runRubricAssessment({...f.input,model})).score.S).toBeNull();expect((await f.store.get('resume-case'))?.steps['0:contribution-extractor']?.status).toBe('failed');f.model.mockClear();expect((await runRubricAssessment(f.input)).assessmentStatus).toBe('complete');expect(f.model.mock.calls.filter(([name])=>name==='contribution-extractor')).toHaveLength(1)})
 it('retains separate budget runs and clears sparse statistics when resuming',async()=>{const f=fixture();await runRubricAssessment({...f.input,execution:{...f.input.execution,usage:()=>({network429:2})}});await runRubricAssessment({...f.input,execution:{...f.input.execution,usage:()=>({})}});const row=await f.store.get('resume-case');expect(row?.budgetRuns).toHaveLength(2);expect(row?.budgetRuns[0]?.usage.network429).toBe(2);expect(row?.budgetRuns[1]?.usage.network429).toBeUndefined();expect(row?.usage.currentBudget_network429).toBeUndefined()})
})

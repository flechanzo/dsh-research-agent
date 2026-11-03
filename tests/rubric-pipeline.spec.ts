import { describe, expect, it, vi } from 'vitest'
import { runRubricAssessment, type RubricNetwork, type RubricModel } from '../packages/research-agent/src/innovation/pipeline.ts'
import { taskFields, syntheticText, rubricFixture } from './support/rubric-fixture.mjs'
const task={...taskFields,contextDigest:'a'.repeat(64),confirmedAt:1}
function fixture(options:{duplicate?:boolean;provisional?:boolean;offline?:boolean;rounds?:number;coreMissing?:boolean;criticalMissing?:boolean;transport?:'fixture'|'dsh-web'}={}){
 let searches=0
 const acquisition={url:'https://example.test/original',at:'2026-11-02T00:00:00Z',status:200,sha256:'a'.repeat(64),transport:options.transport??'dsh-web' as const,truncated:false}
 const network:RubricNetwork={search:async()=>{searches++;if(options.offline||searches>(options.rounds??3))throw Error('network unavailable');return {sources:[{url:acquisition.url,title:'Synthetic original',publicationDate:'2024-01-01'},{url:'https://example.test/alternative',title:'Synthetic alternative',publicationDate:'2023-01-01'}],acquisitions:[acquisition],errors:[]}},read:async(source)=>({id:source.url.endsWith('alternative')?'alternative':'remote',title:source.title,text:syntheticText,url:source.url,primary:true,publicationDate:source.publicationDate,acquisition:{...acquisition,url:source.url}})}
 const model:RubricModel=async(stage,prompt)=>{
  const p=JSON.parse(prompt.slice(prompt.lastIndexOf('\n输入：')+4))
  const value=rubricFixture(stage,p,options)
  if(options.criticalMissing&&(stage==='source-verifier'||stage==='adversarial-reviewer'))value.criticalMissingSources=['不可获取且可能改变定类的原文']
  return JSON.stringify(value)
 }
 const input={targetTask:task,candidate:'创新点：独立局部规则',papers:options.coreMissing?[]:[{id:'paper:synthetic',title:'Synthetic primary',text:syntheticText,primary:true,publicationDate:null}],model,network}
 return {input,searches:()=>searches}
}
describe('Rubric evidence gates (all network I/O here is explicitly mocked)',()=>{
 it.each([{offline:true},{rounds:1},{rounds:2},{coreMissing:true},{criticalMissing:true},{transport:'fixture' as const}])('fails closed %j',async(options)=>{
  const {input}=fixture(options);const a=await runRubricAssessment(input);expect(a.assessmentStatus).toBe('insufficient');expect(a.score.S).toBeNull();expect(a.uncertainties.length).toBeGreaterThan(0)
 })
 it('retains the exact confirmed target and each distinct round',async()=>{
  const f=fixture();const a=await runRubricAssessment(f.input)
  expect(a.uncertainties).toEqual([]);expect(a.assessmentStatus).toBe('complete');expect(a.score.S).toBe(1)
  expect(a.targetTask).toEqual(task);expect(a.searchAudit.map(r=>r.round)).toEqual([1,2,3]);expect(f.searches()).toBe(3)
 })
 it('permits provisional score for non-decisive disputes',async()=>{
  const {input}=fixture({provisional:true});const a=await runRubricAssessment(input)
  expect(a.assessmentStatus).toBe('provisional');expect(a.score.S).toBe(1)
 })
 it('separates complete duplicate S=0 from unavailable S=null',async()=>{
  const a=await runRubricAssessment(fixture({duplicate:true}).input)
  expect(a.uncertainties).toEqual([]);expect(a.assessmentStatus).toBe('complete');expect(a.score.S).toBe(0)
  expect((await runRubricAssessment(fixture({offline:true}).input)).score.S).toBeNull()
 })
 it('does not accept invented original quotes',async()=>{
  const f=fixture();const original=f.input.model
  f.input.model=async(stage,prompt,signal)=>{const value=JSON.parse(await original(stage,prompt,signal));if(stage==='source-verifier')value.readings[0].quote='fabricated words absent from the acquired original';return JSON.stringify(value)}
  const a=await runRubricAssessment(f.input);expect(a.score.S).toBeNull();expect(a.uncertainties.join()).toMatch(/原文/)
 })
 it('does not accept the same query as three rounds',async()=>{
  const f=fixture();const original=f.input.model
  f.input.model=async(stage,prompt,signal)=>{const value=JSON.parse(await original(stage,prompt,signal));if(stage==='search-planner')value.queries=['identical query across all three rounds'];return JSON.stringify(value)}
  const a=await runRubricAssessment(f.input);expect(a.score.S).toBeNull();expect(a.uncertainties.join()).toMatch(/重复查询/)
 })
 it('requires a confirmed target before model or network work',async()=>{
  const f=fixture();const a=await runRubricAssessment({...f.input,targetTask:null})
  expect(a.score.S).toBeNull();expect(f.searches()).toBe(0)
 })
})

it('rejects unresolved alternatives even after real-shaped round acquisition',async()=>{
 const f=fixture();const original=f.input.model
 f.input.model=async(stage,prompt,signal)=>{const value=JSON.parse(await original(stage,prompt,signal));if(stage==='adversarial-reviewer')value.sufficiency.unresolvedAlternatives=['关键异名先例尚未排除'];return JSON.stringify(value)}
 const a=await runRubricAssessment(f.input);expect(a.score.S).toBeNull();expect(a.uncertainties.join()).toMatch(/替代解释/)
})
it('repeatedly reading one work cannot pass substantive sufficiency',async()=>{
 const f=fixture();const original=f.input.model
 f.input.model=async(stage,prompt,signal)=>{const value=JSON.parse(await original(stage,prompt,signal));if(stage==='source-selector')value.urls=[value.urls[0]];return JSON.stringify(value)}
 const a=await runRubricAssessment(f.input);expect(a.score.S).toBeNull();expect(a.searchAudit[0]?.completed).toBe(true);expect(a.uncertainties.join()).toMatch(/同一工作/)
})
it('does not accept a quote with an invented page location',async()=>{
 const f=fixture();const original=f.input.network.read
 f.input.network.read=async(source,signal)=>{const d=await original(source,signal);return {...d,provenance:{originalUrl:source.url,version:'v1',versionDate:'2024-01-01',textSha256:'a'.repeat(64),coverage:'core-complete',extraction:'embedded-text',truncated:false,locations:[{label:'page:1',start:0,end:d.text.length}],links:[]}}}
 const model=f.input.model;f.input.model=async(stage,prompt,signal)=>{const value=JSON.parse(await model(stage,prompt,signal));if(stage==='source-verifier')value.readings[0].location='page:999';return JSON.stringify(value)}
 const a=await runRubricAssessment(f.input);expect(a.score.S).toBeNull();expect(a.uncertainties.join()).toMatch(/页码/)
})
it('keeps partial target paper unscored before model work',async()=>{
 const f=fixture();f.input.papers[0]={...f.input.papers[0]!,provenance:{originalUrl:'https://example.test/paper',version:'v1',versionDate:null,textSha256:'a'.repeat(64),coverage:'partial',extraction:'embedded-text',truncated:true,locations:[],links:[]}} as never
 const model=vi.fn(f.input.model);const a=await runRubricAssessment({...f.input,model});expect(a.score.S).toBeNull();expect(model).not.toHaveBeenCalled()
})

it('accepts a genuinely acquired PDF URL resolved from a discovered landing page',async()=>{
 const f=fixture();const read=f.input.network.read
 f.input.network.read=async(source,signal)=>{const d=await read(source,signal);return {...d,url:source.url+'/resolved.pdf'}}
 const a=await runRubricAssessment(f.input);expect(a.uncertainties).toEqual([]);expect(a.assessmentStatus).toBe('complete')
})
it('cross-verifies two distinct closest works even when both are nearest precedents',async()=>{
 const f=fixture();const model=f.input.model
 f.input.model=async(stage,prompt,signal)=>{const value=JSON.parse(await model(stage,prompt,signal));if(stage==='source-verifier'||stage==='adversarial-reviewer'){const payload=JSON.parse(prompt.slice(prompt.lastIndexOf('\n输入：')+4));value.nearestPrecedents=payload.documents.map((d:{id:string})=>d.id)}return JSON.stringify(value)}
 const a=await runRubricAssessment(f.input);expect(a.uncertainties).toEqual([]);expect(a.assessmentStatus).toBe('complete')
})

it('retains alternative-work readings and discovery in subsequent rounds',async()=>{
 const f=fixture();const a=await runRubricAssessment(f.input);expect(a.assessmentStatus).toBe('complete');expect(a.searchAudit[1]?.sources.map(s=>s.sourceId).sort()).toEqual(['alternative','remote']);expect(a.searchAudit[2]?.discoveredSources?.some(s=>s.url.endsWith('alternative'))).toBe(true)
})

it('gives the search planner original source identities and index-specific keyword guidance', async()=>{
 const f=fixture();const original=f.input.model;const prompts:string[]=[];
 f.input.model=async(stage,prompt,signal)=>{if(stage==='search-planner')prompts.push(prompt);return original(stage,prompt,signal)};
 const result=await runRubricAssessment(f.input);expect(result.assessmentStatus).toBe('complete');
 expect(prompts).toHaveLength(3);expect(prompts[0]).toContain('通常2–6个词');
 const payload=JSON.parse(prompts[0]!.slice(prompts[0]!.lastIndexOf('\n输入：')+4));expect(payload.paperSources[0].id).toBe('paper:synthetic');expect(payload.paperSources[0].title).toBe('Synthetic primary');
})

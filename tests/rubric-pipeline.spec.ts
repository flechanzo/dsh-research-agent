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
 it.each([false,true])('fixes a wrong round strategy only through the bounded schema repair: persistent=%s',async(persistent)=>{
  const f=fixture(),model=f.input.model;let thirdCalls=0
  f.input.model=async(stage,prompt,signal)=>{const value=JSON.parse(await model(stage,prompt,signal)),p=JSON.parse(prompt.slice(prompt.lastIndexOf('\n输入：')+4));if(stage==='search-planner'&&p.round===3){expect(p.strategy).toBe('cross-verification');thirdCalls++;if(persistent||thirdCalls===1)value.strategy='adversarial'}return JSON.stringify(value)}
  const a=await runRubricAssessment(f.input)
  expect(a.score.S).toBe(persistent?null:1);expect(thirdCalls).toBe(2);expect(f.searches()).toBe(persistent?2:3)
 })
 it.each(['mixed','candidate-only','unread-background'] as const)('requires prior acquired primary evidence while allowing candidate retrieval leads: %s',async(mode)=>{
  const f=fixture(),model=f.input.model
  f.input.model=async(stage,prompt,signal)=>{
   const value=JSON.parse(await model(stage,prompt,signal)),p=JSON.parse(prompt.slice(prompt.lastIndexOf('\n输入：')+4))
   if(stage==='search-planner'){
    expect(p.candidate.text).toBe(f.input.candidate)
    if(p.round>1){
     const candidate={sourceId:'candidate',location:'proposal',quote:f.input.candidate}
     if(mode==='mixed')value.previousReadings.push(candidate)
     if(mode==='candidate-only')value.previousReadings=[candidate]
     if(mode==='unread-background')value.previousReadings.push({sourceId:'paper:synthetic',location:'method',quote:syntheticText.slice(0,100)})
    }
   }
   return JSON.stringify(value)
  }
  const a=await runRubricAssessment(f.input)
  expect(a.score.S).toBe(mode==='mixed'?1:null)
  if(mode==='mixed'){expect(a.searchAudit).toHaveLength(3);expect(a.searchAudit.every(r=>r.completed)).toBe(true)}
  else {expect(f.searches()).toBe(1);expect(a.uncertainties.join()).toContain(mode==='candidate-only'?'候选自述不能替代先例原文':'迭代依据不是前轮取得的原文')}
 })
 it('normalizes PDF line-break hyphenation without changing evidence words or the original stored quote',async()=>{
  const f=fixture(),model=f.input.model
  f.input.model=async(stage,prompt,signal)=>{const value=JSON.parse(await model(stage,prompt,signal));if(stage==='source-verifier')value.readings[0].quote=value.readings[0].quote.replace('synthetic','syn- thetic');return JSON.stringify(value)}
  const a=await runRubricAssessment(f.input);expect(a.uncertainties).toEqual([]);expect(a.score.S).toBe(1)
  expect(a.searchAudit[0]?.review.readings[0]?.quote).toContain('syn- thetic');expect(a.stages.some(s=>s.outcome.includes('"pdfHyphenation":true'))).toBe(true)
 })
 it('repairs a citation output once within the same stage and still validates the replacement against acquired text',async()=>{
  const f=fixture(),model=f.input.model;let calls=0
  f.input.model=async(stage,prompt,signal)=>{const value=JSON.parse(await model(stage,prompt,signal));if(stage==='source-verifier'&&calls++===0)value.readings[0].quote='Words not present in the original document.';return JSON.stringify(value)}
  const a=await runRubricAssessment(f.input);expect(a.uncertainties).toEqual([]);expect(a.score.S).toBe(1);expect(calls).toBe(3)
 })
 it.each([false,true])('corrects a real quote only when it uniquely belongs to another recorded page, preserving the reported location: ambiguous=%s',async(ambiguous)=>{
  const f=fixture(),read=f.input.network.read
  f.input.network.read=async(source,signal)=>{
   const d=await read(source,signal),prefix='A different first page without the quoted method.',text=prefix+d.text+(ambiguous?d.text:'')
   return {...d,text,provenance:{originalUrl:source.url,version:'v1',versionDate:'2024-01-01',textSha256:'a'.repeat(64),coverage:'core-complete',extraction:'embedded-text',truncated:false,locations:[{label:'page:1',start:0,end:prefix.length},{label:'page:2',start:prefix.length,end:prefix.length+d.text.length},...(ambiguous?[{label:'page:3',start:prefix.length+d.text.length,end:text.length}]:[])],links:[]}}
  }
  const model=f.input.model
  f.input.model=async(stage,prompt,signal)=>{const value=JSON.parse(await model(stage,prompt,signal));if(stage==='source-verifier')value.readings[0].location='page:1';return JSON.stringify(value)}
  const a=await runRubricAssessment(f.input)
  expect(a.score.S).toBe(ambiguous?null:1)
  if(ambiguous)expect(a.uncertainties.join()).toContain('不能唯一定位')
  else {expect(a.searchAudit[0]?.review.readings[0]?.location).toBe('page:2');expect(a.stages.some(s=>s.stage==='citation-location-resolver'&&s.outcome.includes('"reported":"page:1"')&&s.outcome.includes('"resolved":"page:2"'))).toBe(true)}
 })
 it.each([true,false])('uses actual same-day public acquisition only for a current provisional assessment, never a historical date: %s',async(current)=>{
  const f=fixture(),read=f.input.network.read
  if(current)f.input.targetTask={...task,comparisonPoint:new Date().toLocaleDateString('en-CA')}
  f.input.network.read=async(source,signal)=>{const d=await read(source,signal);return {...d,publicationDate:null,acquisition:{...d.acquisition!,at:new Date().toISOString()}}}
  const a=await runRubricAssessment(f.input)
  expect(a.score.S).toBe(current?1:null);expect(a.assessmentStatus).toBe(current?'provisional':'insufficient')
  expect(a.uncertainties.join()).toContain(current?'原始发表日期未确认':'无法支持回溯原创性')
 })
 it('carries an unresolved recorded alternate URL across rounds and clears it only after the same source is checked',async()=>{
  const f=fixture(),model=f.input.model,search=f.input.network.search
  const alternate='https://publisher.test/alternative.pdf'
  f.input.network.search=async(query,signal)=>{const value=await search(query,signal);return {...value,sources:value.sources.map(s=>s.url.endsWith('alternative')?{...s,alternateUrls:[alternate]}:s)}}
  f.input.model=async(stage,prompt,signal)=>{
   const value=JSON.parse(await model(stage,prompt,signal))
   if(stage==='source-verifier'||stage==='adversarial-reviewer'){
    const p=JSON.parse(prompt.slice(prompt.lastIndexOf('\n输入：')+4))
    if(p.round===1){value.sufficiency.alternativeDecisions[0].url=alternate;value.sufficiency.alternativeDecisions[0].disposition='unresolved'}
    if(p.round===2)expect(p.pendingConcerns).toContain('https://example.test/alternative')
    if(p.round===3)expect(p.pendingConcerns).toEqual([])
   }
   return JSON.stringify(value)
  }
  const a=await runRubricAssessment(f.input);expect(a.uncertainties).toEqual([]);expect(a.score.S).toBe(1)
 })
 it('uses candidate citations as retrieval leads and requires independently acquired primary text',async()=>{
  const f=fixture(),model=f.input.model,read=f.input.network.read
  const citation='https://example.test/cited-paper'
  f.input.candidate+='；参考 ['+citation+']('+citation+')'
  f.input.network.read=async(source,signal)=>{const d=await read(source,signal);return source.url===citation?{...d,id:'cited',publicationDate:'2023-01-01'}:d}
  f.input.model=async(stage,prompt,signal)=>{
   const value=JSON.parse(await model(stage,prompt,signal)),p=JSON.parse(prompt.slice(prompt.lastIndexOf('\n输入：')+4))
   if(stage==='search-planner'){expect(p.candidateReferences).toEqual([expect.objectContaining({url:citation,publicationDate:null})]);value.sourceUrls=[citation]}
   if(stage==='source-selector')value.urls.push(citation)
   return JSON.stringify(value)
  }
  const a=await runRubricAssessment(f.input);expect(a.uncertainties).toEqual([]);expect(a.score.S).toBe(1)
  expect(a.searchAudit.every(r=>r.sources.some(s=>s.sourceId==='cited'&&s.primary))).toBe(true)
 })
 it('still rejects an invented alternative URL absent from source records and candidate citations',async()=>{
  const f=fixture(),model=f.input.model
  f.input.model=async(stage,prompt,signal)=>{const value=JSON.parse(await model(stage,prompt,signal));if(stage==='source-verifier')value.sufficiency.alternativeDecisions[0].url='https://invented.test/unseen';return JSON.stringify(value)}
  const a=await runRubricAssessment(f.input);expect(a.score.S).toBeNull();expect(a.uncertainties.join()).toContain('替代先例不是实际发现的来源')
 })
 it('supplies the complete candidate and allows its comparison quotes alongside actual primary evidence',async()=>{
  const f=fixture(), model=f.input.model
  f.input.model=async(stage,prompt,signal)=>{
   const value=JSON.parse(await model(stage,prompt,signal))
   if(stage==='source-verifier'||stage==='adversarial-reviewer'){
    const payload=JSON.parse(prompt.slice(prompt.lastIndexOf('\n输入：')+4))
    expect(payload.candidate.text).toBe(f.input.candidate)
    const quote={sourceId:'candidate',location:'proposal',quote:f.input.candidate}
    value.readings.unshift(quote);value.sufficiency.methodReadings.unshift(quote)
   }
   return JSON.stringify(value)
  }
  expect((await runRubricAssessment(f.input)).score.S).toBe(1)
 })
 it.each([false,true])('allows later rounds to resolve an initial gap only with an explicit original-evidence record: %s',async(resolve)=>{
  const f=fixture(),model=f.input.model,concern='Earlier mechanism requires a second-round source check'
  f.input.model=async(stage,prompt,signal)=>{
   const value=JSON.parse(await model(stage,prompt,signal))
   if(stage==='source-verifier'||stage==='adversarial-reviewer'){
    const payload=JSON.parse(prompt.slice(prompt.lastIndexOf('\n输入：')+4))
    if(payload.round===1){value.sufficiency.coreVerified=false;value.sufficiency.unresolvedAlternatives=[concern]}
    if(payload.round===3&&resolve){expect(payload.pendingConcerns).toContain(concern);value.resolvedPriorConcerns=[{concern,resolution:'The acquired original provides the missing relation.',evidence:value.readings}]}
   }
   return JSON.stringify(value)
  }
  const a=await runRubricAssessment(f.input)
  expect(f.searches()).toBe(3);expect(a.score.S).toBe(resolve?1:null)
 })
 it('repairs an annotated source ID once against the exact acquired-ID schema',async()=>{
  const f=fixture(),model=f.input.model;let calls=0
  f.input.model=async(stage,prompt,signal)=>{
   const value=JSON.parse(await model(stage,prompt,signal))
   if(stage==='source-verifier'&&calls++===0)value.nearestPrecedents=['remote: explanation is not part of the identifier']
   return JSON.stringify(value)
  }
  const a=await runRubricAssessment(f.input);expect(a.score.S).toBe(1);expect(calls).toBe(3)
 })
 it.each([false,true])('requires original evidence to exclude an unavailable noncritical selected source: %s',async(exclude)=>{
  const f=fixture();const model=f.input.model,search=f.input.network.search,read=f.input.network.read
  const missing='https://example.test/unavailable'
  f.input.network.search=async(query,signal)=>{const r=await search(query,signal);return {...r,sources:[...r.sources,{url:missing,title:'Possibly related source',publicationDate:'2024-01-01'}]}}
  f.input.network.read=async(source,signal)=>{if(source.url===missing)throw Error('HTTP 403');return read(source,signal)}
  f.input.model=async(stage,prompt,signal)=>{
   const value=JSON.parse(await model(stage,prompt,signal))
   if(stage==='source-selector')value.urls.push(missing)
   if(stage==='source-verifier'||stage==='adversarial-reviewer'){
    const payload=JSON.parse(prompt.slice(prompt.lastIndexOf('\n输入：')+4))
    expect(payload.unavailableSources[0].source.url).toBe(missing)
    if(exclude)value.sufficiency.alternativeDecisions.push({url:missing,disposition:'excluded',reason:'Synthetic original explicitly supplies a scope distinction, for this engineering fixture only.',evidence:value.readings})
   }
   return JSON.stringify(value)
  }
  const a=await runRubricAssessment(f.input)
  expect(a.assessmentStatus).toBe(exclude?'complete':'insufficient')
  expect(a.score.S).toBe(exclude?1:null)
  expect(a.searchAudit[0]?.errors.join()).toContain('HTTP 403')
 })
 it('reviews only candidate originality and never schedules data/experiment validation',async()=>{
  const f=fixture();const model=vi.fn(f.input.model)
  const a=await runRubricAssessment({...f.input,model})
  expect(a.assessmentStatus).toBe('complete');expect(a.reviewScope).toBe('originality-only')
  expect(model.mock.calls.some(([name])=>name==='originality-reviewer')).toBe(true)
  expect(model.mock.calls.some(([name])=>name==='validity-reviewer')).toBe(false)
  for(const [,prompt] of model.mock.calls) expect(prompt).toContain('不审查数据质量')
  const review=model.mock.calls.find(([name])=>name==='originality-reviewer')![1]
  expect(review).not.toContain('### 2.5 有效性核验最低标准')
 })
 it('rejects scoring the uploaded paper instead of the candidate',async()=>{
  const f=fixture();const original=f.input.model
  f.input.model=async(stage,prompt,signal)=>{const value=JSON.parse(await original(stage,prompt,signal));if(stage==='contribution-extractor')value.contributions[0].evidence=value.contributions[0].evidence.filter((e:{sourceId:string})=>e.sourceId!=='candidate');return JSON.stringify(value)}
  const a=await runRubricAssessment(f.input)
  expect(a.score.S).toBeNull();expect(a.uncertainties.join()).toContain('不能用上传论文的贡献替代候选新增');expect(f.searches()).toBe(0)
 })
 it('accepts a single fenced JSON response without weakening the evidence checks',async()=>{
  const f=fixture(),original=f.input.model
  f.input.model=async(stage,prompt,signal)=>'```json\n'+await original(stage,prompt,signal)+'\n```'
  const a=await runRubricAssessment(f.input)
  expect(a.assessmentStatus).toBe('complete');expect(a.score.S).toBe(1)
 })
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

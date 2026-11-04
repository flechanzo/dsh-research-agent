import { Context } from '@deepseek-ai/cordis'
import { SessionId } from '@deepseek-ai/dsh-session'
import { expect, it, vi } from 'vitest'
import ResearchController from '../packages/research-agent/lib/index.js'
import { createResearchState } from '../packages/research-agent/src/workflows/index.ts'
import { MemoryRubricCheckpointStore } from '../packages/research-agent/src/innovation/checkpoints.ts'
import { runRubricAssessment } from '../packages/research-agent/src/innovation/pipeline.ts'
import { shadowAuditSchema } from '../packages/research-agent/src/innovation/shadow.ts'
import { syntheticText, taskFields } from './support/rubric-fixture.mjs'

it('restarts incompatible audits without trusting a model alias, then resumes only the same Host and route', async () => {
  const sessionId=SessionId('resume-originality'), target={...taskFields,contextDigest:'a'.repeat(64),confirmedAt:1}
  const store=new MemoryRubricCheckpointStore(), candidate='候选：通过一个明确的局部规则改变计算关系'
  const assessment=await runRubricAssessment({targetTask:target,candidate,
    papers:[{id:'paper:test',title:'Synthetic reference',text:syntheticText,primary:true,publicationDate:null}],
    model:async()=>{throw Error('old interrupted model')},network:{search:vi.fn(),read:vi.fn()},
    execution:{store,assessmentId:'old',modelIdentity:'unverified-host:old',sourceRevision:'old-source'}})
  const audit=shadowAuditSchema.parse({id:'audit-old',assessmentId:'old',hostRunId:'old',sessionId,sourceRevision:1,
    nodeId:'node-1',branchId:'branch-1',attempt:1,candidate,candidateSha256:null,startedAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
    legacy:{status:'pass',reason:'prior accepted candidate'},lifecycle:'insufficient',assessment,policy:{},
    usage:{modelCalls:0,networkOperations:0,promptCharacters:0,ocrPages:0,milliseconds:0},disagreements:[],reason:'old run'})
  const original=structuredClone(audit), state=createResearchState()
  state.nodes[state.selectedNodeId]!.memorySnapshot.targetTask=target
  const tables=new Map<string,Map<string,unknown>>([
    ['sessions',new Map([[sessionId,{revision:1,state,updatedAt:1}]])],['audits',new Map([[audit.id,audit]])],
    ['assessments',new Map(store.rows)],['originals',new Map()],
  ])
  const ctx=new Context(), stream=vi.fn()
  const agent={options:{provider:'selected',model:'current'},session:{header:{},requestHeader:()=>undefined},ctx:{get:()=>undefined}}
  ctx.provide('storageDomain',{open:async()=>({table:(name:string)=>({
    get:(id:string)=>tables.get(name)!.get(id),put:async(id:string,value:unknown)=>{tables.get(name)!.set(id,value)},entries:()=>tables.get(name)!.entries(),
  }),close:async()=>{}})} as never)
  ctx.provide('sessionController',{resolveAgent:async()=>({agent})} as never)
  ctx.provide('llm',{stream} as never);ctx.provide('web',{fetch:vi.fn()} as never)
  ctx.provide('attachments',{} as never);ctx.provide('subagents',{} as never)
  const controller=new ResearchController(ctx)
  const budget={maxModelCalls:0,maxMilliseconds:1000,maxStageMilliseconds:1000,maxNetworkOperations:0,maxPromptCharacters:100000,maxPdfPages:30,maxOcrPages:0}
  try {
    const fresh=await controller.resumeRubric({sessionId,expectedRevision:1,auditId:audit.id,assessmentId:'old',budget},new AbortController().signal)
    expect(fresh.id).not.toBe(audit.id);expect(fresh.assessmentId).not.toBe('old')
    expect(tables.get('audits')!.get(audit.id)).toEqual(original);expect(tables.get('audits')!.size).toBe(2)
    const resumed=await controller.resumeRubric({sessionId,expectedRevision:1,auditId:fresh.id,assessmentId:fresh.assessmentId!,budget},new AbortController().signal)
    expect(resumed.id).toBe(fresh.id);expect(tables.get('audits')!.size).toBe(2)
    agent.options.model='changed'
    const rerouted=await controller.resumeRubric({sessionId,expectedRevision:1,auditId:fresh.id,assessmentId:fresh.assessmentId!,budget},new AbortController().signal)
    expect(rerouted.id).not.toBe(fresh.id);expect(tables.get('audits')!.size).toBe(3)
    expect(stream).not.toHaveBeenCalled()
  } finally { await ctx.fiber.dispose() }
})

import { Context } from '@deepseek-ai/cordis'
import { FsError } from '@deepseek-ai/dsh-fs'
import { SessionId } from '@deepseek-ai/dsh-session'
import { appendResearchOutput, createResearchState } from '../packages/research-agent/src/workflows/index.ts'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ResearchController, { type ResearchRecord } from '../packages/research-agent/lib/index.js'

const contexts: Context[] = []
afterEach(async () => { await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose())) })

function fixture() {
  const sessionId = SessionId('research-controller-branch')
  let state = appendResearchOutput(createResearchState(), {
    stage: 'problem-summary', kind: 'problem', title: '问题', content: '问题内容',
  })
  state = appendResearchOutput(state, {
    stage: 'idea-generation', kind: 'idea', title: '方案', content: '创新点：方案',
  })
  state = { ...state, selectedNodeId: 'node-2' }
  const row: ResearchRecord = { revision: 4, state, updatedAt: 1 }
  const records = new Map([[sessionId, row]])
  const table = {
    get: (key: SessionId) => records.get(key),
    put: vi.fn(async (key: SessionId, value: ResearchRecord) => { records.set(key, value) }),
  }
  const domain = { table: () => table, close: vi.fn(async () => undefined) }
  const ctx = new Context()
  contexts.push(ctx)
  ctx.provide('storageDomain', { open: vi.fn(async () => domain) } as never)
  ctx.provide('sessionController', {
    resolveAgent: vi.fn(async () => ({ agent: { session: { header: {} } } })),
  } as never)
  return { controller: new ResearchController(ctx), records, table, sessionId, state }
}

describe('ResearchController continueFromNode', () => {
  it('advertises the fixed numerical simulation adapter', async () => {
    const { controller, sessionId } = fixture()

    const snapshot = await controller.read({ sessionId })

    expect(snapshot.simulationAvailable).toBe(true)
  })

  it('creates a same-Session branch, commits a revision, and reloads it', async () => {
    const { controller, records, table, sessionId, state } = fixture()
    const result = await controller.continueFromNode({
      sessionId, expectedRevision: 4, nodeId: 'node-2',
    })

    expect(result.snapshot.revision).toBe(5)
    expect(result.snapshot.sessionId).toBe(sessionId)
    expect(result.snapshot.state.selectedNodeId).not.toBe('node-2')
    expect(result.snapshot.state.activeBranchId).toBe('branch-2')
    expect(result.snapshot.state.nodes['node-2']).toEqual(state.nodes['node-2'])
    expect(result.snapshot.state.branches['branch-1']?.nodeIds).toEqual(state.branches['branch-1']?.nodeIds)
    const persisted = records.get(sessionId)
    if (persisted === undefined) throw new Error('continued research record was not persisted')
    expect(persisted.revision).toBe(result.snapshot.revision)
    expect(persisted.state).toEqual(result.snapshot.state)
    expect(typeof persisted.updatedAt).toBe('number')
    expect(table.put).toHaveBeenCalledOnce()

    const reloaded = await controller.read({ sessionId })
    expect(reloaded).toEqual(result.snapshot)
  })

  it('rejects stale continuation without changing the durable row', async () => {
    const { controller, records, sessionId } = fixture()
    const before = records.get(sessionId)
    await expect(controller.continueFromNode({
      sessionId, expectedRevision: 3, nodeId: 'node-2',
    })).rejects.toMatchObject({ code: 'research/stale' })
    expect(records.get(sessionId)).toBe(before)
  })

  it('rejects a repeated continuation with the old revision', async () => {
    const { controller, records, table, sessionId } = fixture()
    const first = await controller.continueFromNode({
      sessionId, expectedRevision: 4, nodeId: 'node-2',
    })

    await expect(controller.continueFromNode({
      sessionId, expectedRevision: 4, nodeId: 'node-2',
    })).rejects.toMatchObject({ code: 'research/stale' })
    expect(records.get(sessionId)?.revision).toBe(first.snapshot.revision)
    expect(table.put).toHaveBeenCalledOnce()
  })

  it('keeps history mutation errors separate from continuation', async () => {
    const { controller, records, sessionId } = fixture()
    const before = records.get(sessionId)
    await expect(controller.feedback({
      sessionId, expectedRevision: 4, feedback: '补充实验',
    })).rejects.toMatchObject({ code: 'research/history' })
    expect(records.get(sessionId)).toBe(before)

    const continued = await controller.continueFromNode({
      sessionId, expectedRevision: 4, nodeId: 'node-2',
    })
    expect(continued.snapshot.state.activeBranchId).toBe('branch-2')
  })

  it('commits the durable state before a project projection failure', async () => {
    const sessionId = SessionId('research-controller-projection-failure')
    let state = appendResearchOutput(createResearchState(), {
      stage: 'problem-summary', kind: 'problem', title: '问题', content: '问题内容',
    })
    state = appendResearchOutput(state, {
      stage: 'idea-generation', kind: 'idea', title: '方案', content: '创新点：方案',
    })
    const records = new Map<SessionId, ResearchRecord>([[sessionId, { revision: 4, state, updatedAt: 1 }]])
    const events: string[] = []
    const table = {
      get: (key: SessionId) => records.get(key),
      put: vi.fn(async (key: SessionId, value: ResearchRecord) => {
        events.push('domain.put')
        records.set(key, value)
      }),
    }
    const fs = {
      resolve: vi.fn(async (path: string) => ({ targetKey: path, displayPath: path })),
      readText: vi.fn(async () => { throw new FsError('missing', 'FS_NOT_FOUND') }),
      writeText: vi.fn(async () => {
        events.push('project.write')
        throw new FsError('disk full', 'FS_IO_ERROR')
      }),
    }
    const domain = { table: () => table, close: vi.fn(async () => undefined) }
    const ctx = new Context()
    contexts.push(ctx)
    ctx.provide('storageDomain', { open: vi.fn(async () => domain) } as never)
    ctx.provide('fs', fs as never)
    ctx.provide('sessionController', {
      resolveAgent: vi.fn(async () => ({
        agent: { session: { header: { cwd: 'C:/research' } }, ctx: { get: () => undefined } },
      })),
    } as never)
    const controller = new ResearchController(ctx)

    await expect(controller.continueFromNode({
      sessionId, expectedRevision: 4, nodeId: 'node-2',
    })).rejects.toMatchObject({ code: 'FS_IO_ERROR' })
    expect(events).toEqual(['domain.put', 'project.write'])
    expect(records.get(sessionId)?.revision).toBe(5)
    expect(records.get(sessionId)?.state.activeBranchId).toBe('branch-2')
  })
})

it('F06 exports a shared artifact once and F12 preserves plans from two branches',async()=>{
 const sessionId=SessionId('F06-F12');let state=appendResearchOutput(createResearchState(),{stage:'final-plan',kind:'plan',title:'Plan',content:'# UNIQUE_PLAN',status:'awaiting-confirmation'})
 const records=new Map<SessionId,ResearchRecord>([[sessionId,{revision:1,state,updatedAt:0}]])
 const files=new Map<string,string>();const fs={resolve:async(path:string)=>({targetKey:path,displayPath:path}),readText:async(target:{displayPath:string})=>{const v=files.get(target.displayPath);if(v===undefined)throw new FsError('missing','FS_NOT_FOUND');return v},writeText:async(target:{displayPath:string},content:string)=>{files.set(target.displayPath,content)}}
 const ctx=new Context();contexts.push(ctx)
 ctx.provide('storageDomain',{open:async()=>({table:()=>({get:(id:SessionId)=>records.get(id),put:async(id:SessionId,row:ResearchRecord)=>{records.set(id,row)}}),close:async()=>{}})} as never)
 ctx.provide('fs',fs as never);ctx.provide('attachments',{} as never);ctx.provide('web',{} as never);ctx.provide('subagents',{} as never)
 ctx.provide('sessionController',{resolveAgent:async()=>({agent:{session:{header:{cwd:'C:/isolated-F12'},seq:0},ctx:{get:()=>undefined}}})} as never)
 const controller=new ResearchController(ctx)
 const first=await controller.confirm({sessionId,expectedRevision:1},new AbortController().signal)
 const firstPath=[...files.keys()].find(x=>x.endsWith('research-plan.md'))!;expect(files.get(firstPath)).toBe('# UNIQUE_PLAN')
 const fork=await controller.continueFromNode({sessionId,expectedRevision:first.snapshot.revision,nodeId:state.selectedNodeId})
 const manifest=[...files.entries()].find(([key])=>key.endsWith('research-conversation.md'))![1]
 expect.soft(manifest.match(/UNIQUE_PLAN/g)).toHaveLength(1)
 const current=records.get(sessionId)!;const selected=current.state.nodes[current.state.selectedNodeId]!
 records.set(sessionId,{...current,state:{...current.state,nodes:{...current.state.nodes,[selected.nodeId]:{...selected,status:'awaiting-confirmation'}}}})
 await controller.confirm({sessionId,expectedRevision:fork.snapshot.revision},new AbortController().signal)
 const plans=[...files.keys()].filter(x=>x.endsWith('research-plan.md'))
 expect(plans).toHaveLength(2)
 expect(plans[0]).not.toBe(plans[1]);expect(files.get(firstPath)).toBe('# UNIQUE_PLAN')
})

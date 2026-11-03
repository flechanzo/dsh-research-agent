import { Context } from '@deepseek-ai/cordis'
import { FsError } from '@deepseek-ai/dsh-fs'
import { SessionId } from '@deepseek-ai/dsh-session'
import { afterEach, expect, it, vi } from 'vitest'
import ResearchController, { type ResearchRecord } from '../packages/research-agent/lib/index.js'
import { createResearchState } from '../packages/research-agent/src/workflows/research.ts'
const contexts: Context[] = []
afterEach(async () => { await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose())) })
function fixture() {
  const sessionId = SessionId('isolated-projection-resync')
  const row: ResearchRecord = { revision: 7, state: createResearchState(), updatedAt: 42 }
  const put = vi.fn()
  let fail = true
  const files = new Map<string, string>()
  const writes = vi.fn(async (target: { displayPath: string }, content: string) => {
    if (fail) throw new FsError('ReplaceFileW EIO (Win32 1175)', 'FS_IO_ERROR')
    files.set(target.displayPath, content)
  })
  const ctx = new Context(); contexts.push(ctx)
  ctx.provide('storageDomain', { open: async () => ({ table: () => ({ get: () => row, put }), close: async () => {} }) } as never)
  ctx.provide('sessionController', { resolveAgent: async () => ({ agent: { session: { header: { cwd: 'C:/synthetic-resync' } }, ctx: { get: () => undefined } } }) } as never)
  ctx.provide('fs', { resolve: async (displayPath: string) => ({ targetKey: displayPath, displayPath }), readText: async (t: { displayPath: string }) => {
    const text = files.get(t.displayPath); if (text === undefined) throw new FsError('absent', 'FS_NOT_FOUND'); return text
  }, writeText: writes } as never)
  return { controller: new ResearchController(ctx), sessionId, row, put, files, writes, recover: () => { fail = false } }
}
it('surfaces a resync error and safely repairs the same durable revision without model work', async () => {
  const f = fixture()
  await expect(f.controller.resyncProject({ sessionId: f.sessionId, expectedRevision: 7 })).rejects.toMatchObject({ code: 'FS_IO_ERROR' })
  expect(f.put).not.toHaveBeenCalled()
  f.recover()
  const a = await f.controller.resyncProject({ sessionId: f.sessionId, expectedRevision: 7 })
  const before = [...f.files]
  const b = await f.controller.resyncProject({ sessionId: f.sessionId, expectedRevision: 7 })
  expect(a.snapshot.revision).toBe(7); expect(b).toEqual(a); expect([...f.files]).toEqual(before)
  expect(f.put).not.toHaveBeenCalled(); expect(f.row.updatedAt).toBe(42)
})
it('rejects a stale resync before touching files', async () => {
  const f = fixture()
  await expect(f.controller.resyncProject({ sessionId: f.sessionId, expectedRevision: 6 })).rejects.toMatchObject({ code: 'research/stale' })
  expect(f.writes).not.toHaveBeenCalled(); expect(f.put).not.toHaveBeenCalled()
})

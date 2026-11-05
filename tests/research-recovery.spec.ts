import { afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runCheckpointedReviews, abortable, type ReviewCheckpoint } from '../packages/research-agent/src/workflows/review-checkpoints.ts'
import { acquireDataWriter } from '../packages/research-agent/src/workflows/data-writer.ts'
const directories: string[] = []
afterEach(() => { for (const d of directories.splice(0)) rmSync(d, { recursive: true, force: true }) })
const works = ['method', 'novelty', 'reproducibility'].map(label => ({ label, prompt: label + ' exact evidence' }))
function storage() {
  const rows = new Map<string, ReviewCheckpoint>()
  return { rows, store: { get: async (id: string) => rows.get(id), put: async (row: ReviewCheckpoint) => { rows.set(row.id, structuredClone(row)) } } }
}
it('saves successful parallel reviews and retries only failed roles after coordinator reconstruction', async () => {
  const { rows, store } = storage()
  const run = vi.fn(async (work: typeof works[number]) => { if (work.label === 'novelty') throw Error('single reviewer unavailable'); return work.label + ' result' })
  await expect(runCheckpointedReviews('session/node', works, run, store)).rejects.toThrow('成功项已保存')
  expect([...rows.values()].filter(r => r.status === 'succeeded')).toHaveLength(2)
  const retry = vi.fn(async () => 'recovered novelty')
  const result = await runCheckpointedReviews('session/node', works, retry, store)
  expect(retry).toHaveBeenCalledTimes(1); expect(result).toHaveLength(3)
  expect(result[0]).toContain('method result'); expect(result[1]).toContain('recovered novelty')
})
it('different evidence, node or session cannot reuse a previous success', async () => {
  const { store } = storage(), run = vi.fn(async () => 'review')
  await runCheckpointedReviews('s1/n1', works.slice(0, 1), run, store)
  await runCheckpointedReviews('s1/n2', works.slice(0, 1), run, store)
  await runCheckpointedReviews('s2/n1', works.slice(0, 1), run, store)
  await runCheckpointedReviews('s1/n1', [{ label: 'method', prompt: 'changed evidence' }], run, store)
  expect(run).toHaveBeenCalledTimes(4)
})
it('cancelled adapters that ignore abort never publish a late successful checkpoint', async () => {
  const { rows, store } = storage(), controller = new AbortController()
  let finish: (text: string) => void = () => undefined
  const pending = runCheckpointedReviews('s/n', works.slice(0, 1), () => new Promise<string>(resolve => { finish = resolve }), store, controller.signal)
  const rejection = expect(pending).rejects.toThrow('cancel stage')
  await vi.waitFor(() => expect([...rows.values()][0]?.status).toBe('running'))
  controller.abort(new Error('cancel stage')); await rejection
  finish('late response'); await Promise.resolve()
  expect([...rows.values()][0]?.status).toBe('cancelled')
  expect([...rows.values()][0]?.result).toBeUndefined()
})
it('does not advance when checkpoint persistence fails', async () => {
  const run = vi.fn(async () => 'success')
  await expect(runCheckpointedReviews('s/n', works, run, { get: async () => undefined, put: async () => { throw Error('disk unavailable') } })).rejects.toThrow('disk unavailable')
  expect(run).not.toHaveBeenCalled()
})
it('waits for remaining reviews after one role fails rather than abandoning their results', async () => {
  const { rows, store } = storage()
  await expect(runCheckpointedReviews('s/n', works, async work => {
    if (work.label === 'novelty') throw Error('failure')
    await new Promise(resolve => setTimeout(resolve, 5)); return 'saved result'
  }, store)).rejects.toThrow()
  expect([...rows.values()].filter(r => r.status === 'succeeded')).toHaveLength(2)
})
it('rejects empty and corrupted successful reviews', async () => {
  const { rows, store } = storage()
  await expect(runCheckpointedReviews('s/n', works.slice(0, 1), async () => ' ', store)).rejects.toThrow('empty')
  const first = [...rows.values()][0]!
  rows.set(first.id, { ...first, status: 'succeeded', result: ' ' })
  await expect(runCheckpointedReviews('s/n', works.slice(0, 1), async () => 'result', store)).rejects.toThrow('content')
})
it('stage deadline bounds an unresponsive adapter and preserves abort reason', async () => {
  await expect(abortable(new Promise<string>(() => undefined), AbortSignal.timeout(10))).rejects.toThrow(/timeout|aborted/i)
})
it('pre-cancelled work never starts a reviewer', async () => {
  const controller = new AbortController(); controller.abort(new Error('already cancelled'))
  const run = vi.fn(async () => 'result')
  await expect(runCheckpointedReviews('s/n', works, run, undefined, controller.signal)).rejects.toThrow('already cancelled')
  expect(run).not.toHaveBeenCalled()
})
it('rejects a second Host writer and permits an orderly true restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'dsh-writer-test-')); directories.push(directory)
  const release = acquireDataWriter(directory)
  expect(() => acquireDataWriter(directory)).toThrow('already has a writer lease')
  release(); release(); expect(existsSync(join(directory, '.research-writer.lock'))).toBe(false)
  acquireDataWriter(directory)()
})

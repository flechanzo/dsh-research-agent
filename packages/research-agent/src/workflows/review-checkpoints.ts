import { createHash } from 'node:crypto'
import { z } from 'zod'

export const reviewCheckpointSchema = z.object({
  id: z.string(), version: z.literal(1), label: z.string(), promptSha256: z.string(),
  status: z.enum(['running', 'succeeded', 'failed', 'cancelled']),
  result: z.string().optional(), error: z.string().optional(), updatedAt: z.number(),
}).superRefine((row, ctx) => {
  if (row.status === 'succeeded' && !row.result?.trim()) ctx.addIssue({ code: 'custom', message: 'Successful review requires content' })
})
export type ReviewCheckpoint = z.infer<typeof reviewCheckpointSchema>
export interface ReviewCheckpointStore {
  get(id: string): Promise<ReviewCheckpoint | undefined>
  put(row: ReviewCheckpoint): Promise<void>
}
export interface ReviewWork { readonly label: string; readonly prompt: string }
export interface ReviewCheckpointOptions { readonly persistInFlight?: boolean }
const hash = (text: string): string => createHash('sha256').update(text).digest('hex')

/** Reuse only successful output for the same scope, role and complete input. */
export async function runCheckpointedWork(
  scope: string, work: ReviewWork, run: () => Promise<string>,
  store?: ReviewCheckpointStore, signal?: AbortSignal, options: ReviewCheckpointOptions = {},
): Promise<string> {
  signal?.throwIfAborted()
  const promptSha256 = hash(work.prompt)
  const id = hash(JSON.stringify([scope, work.label, promptSha256]))
  const saved = await store?.get(id)
  if (saved) {
    const row = reviewCheckpointSchema.parse(saved)
    if (row.id !== id || row.promptSha256 !== promptSha256 || row.label !== work.label)
      throw new Error('Review checkpoint identity mismatch')
    if (row.status === 'succeeded') return row.result ?? ''
  }
  const base = { id, version: 1 as const, label: work.label, promptSha256 }
  signal?.throwIfAborted()
  if (options.persistInFlight !== false)
    await store?.put({ ...base, status: 'running', updatedAt: Date.now() })
  try {
    signal?.throwIfAborted()
    const result = await abortable(run(), signal)
    signal?.throwIfAborted()
    if (!result.trim()) throw new Error('Model returned empty content')
    await store?.put({ ...base, status: 'succeeded', result, updatedAt: Date.now() })
    return result
  } catch (error) {
    if (options.persistInFlight !== false || !signal?.aborted)
      await store?.put({ ...base, status: signal?.aborted ? 'cancelled' : 'failed', error: String(error), updatedAt: Date.now() })
    throw error
  }
}

/** Bound the caller even if an adapter fails to acknowledge cancellation; no late result is committed. */
export function abortable<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work
  return new Promise<T>((resolve, reject) => {
    const abort = (): void => { signal.removeEventListener('abort', abort); reject(signal.reason instanceof Error ? signal.reason : new Error(String(signal.reason ?? 'Research cancelled'))) }
    if (signal.aborted) { void work.catch(() => undefined); abort(); return }
    signal.addEventListener('abort', abort, { once: true })
    void work.then((value) => { signal.removeEventListener('abort', abort); resolve(value) }, (error: unknown) => { signal.removeEventListener('abort', abort); reject(error instanceof Error ? error : new Error(String(error))) })
  })
}

/** Each successful role is durably saved before this stage may advance. Retrying reuses exact inputs. */
export async function runCheckpointedReviews(
  scope: string,
  works: readonly ReviewWork[],
  run: (work: ReviewWork) => Promise<string>,
  store?: ReviewCheckpointStore,
  signal?: AbortSignal,
): Promise<string[]> {
  signal?.throwIfAborted()
  const results = await Promise.allSettled(works.map(async (work) => {
    const promptSha256 = hash(work.prompt)
    const id = hash(JSON.stringify([scope, work.label, promptSha256]))
    const saved = await store?.get(id)
    if (saved) {
      const row = reviewCheckpointSchema.parse(saved)
      if (row.id !== id || row.promptSha256 !== promptSha256 || row.label !== work.label) throw new Error('Review checkpoint identity mismatch')
      if (row.status === 'succeeded') return '### ' + work.label + '\n' + (row.result ?? '')
    }
    signal?.throwIfAborted()
    const base = { id, version: 1 as const, label: work.label, promptSha256 }
    await store?.put({ ...base, status: 'running', updatedAt: Date.now() })
    try {
      signal?.throwIfAborted()
      const result = await abortable(run(work), signal)
      signal?.throwIfAborted()
      if (!result.trim()) throw new Error('Review returned empty content')
      await store?.put({ ...base, status: 'succeeded', result, updatedAt: Date.now() })
      return '### ' + work.label + '\n' + result
    } catch (error) {
      await store?.put({ ...base, status: signal?.aborted ? 'cancelled' : 'failed', error: String(error), updatedAt: Date.now() })
      throw error
    }
  }))
  signal?.throwIfAborted()
  const failures = results.flatMap((r, i) => r.status === 'rejected' ? [(works[i]?.label ?? 'unknown') + ': ' + String(r.reason)] : [])
  if (failures.length) throw new Error('多角色评审未完成；成功项已保存，明确重试本阶段时仅重新调用未成功项。' + failures.join('; '))
  return results.flatMap(r => r.status === 'fulfilled' ? [r.value] : [])
}

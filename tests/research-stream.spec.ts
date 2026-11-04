import { afterEach, expect, it, vi } from 'vitest'
import { streamResearchWork } from '../packages/research-agent/src/workflows/research-stream.ts'
import { consumeResearchStream } from '../packages/research-agent/src/client/research-stream.ts'

afterEach(() => vi.useRealTimers())

it('keeps a six-minute operation active with progress and returns its result exactly once', async () => {
  vi.useFakeTimers()
  let finish: (value: number) => void = () => {}
  const work = vi.fn(() => new Promise<number>(resolve => { finish = resolve }))
  const stream = streamResearchWork(new AbortController().signal, work)
  expect((await stream.next()).value).toEqual({ type: 'progress' })
  for (let i = 0; i < 36; i++) {
    const next = stream.next()
    await vi.advanceTimersByTimeAsync(10000)
    expect((await next).value).toEqual({ type: 'progress' })
  }
  finish(72)
  expect((await stream.next()).value).toEqual({ type: 'result', value: 72 })
  expect((await stream.next()).done).toBe(true)
  expect(work).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0)
})

it('propagates explicit cancellation and never emits a late result', async () => {
  vi.useFakeTimers()
  const abort = new AbortController()
  let finish: (value: number) => void = () => {}, operationSignal: AbortSignal | undefined
  const stream = streamResearchWork(abort.signal, signal => {
    operationSignal = signal
    return new Promise<number>(resolve => { finish = resolve })
  })
  await stream.next()
  const pending = stream.next(), rejected = expect(pending).rejects.toThrow('user cancelled')
  abort.abort(new Error('user cancelled'))
  await rejected; expect(operationSignal?.aborted).toBe(true)
  finish(99); expect((await stream.next()).done).toBe(true); expect(vi.getTimerCount()).toBe(0)
})

it('cancels unfinished work when the caller closes the stream', async () => {
  let operationSignal: AbortSignal | undefined
  const stream = streamResearchWork(new AbortController().signal, signal => {
    operationSignal = signal; return new Promise<number>(() => {})
  })
  await stream.next(); await stream.return(undefined)
  expect(operationSignal?.aborted).toBe(true)
})

it('client treats only the final stream item as success and rejects incomplete transport', async () => {
  const complete = async function* () { yield { type: 'progress' as const }; yield { type: 'result' as const, value: 72 } }
  const interrupted = async function* () { yield { type: 'progress' as const } }
  expect(await consumeResearchStream(complete())).toEqual({ ok: true, value: 72 })
  await expect(consumeResearchStream(interrupted())).rejects.toThrow('连接已中断')
  await expect(consumeResearchStream(streamResearchWork(new AbortController().signal, async () => { throw new Error('model failed') }))).rejects.toThrow('model failed')
})

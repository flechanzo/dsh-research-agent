import { abortable } from './review-checkpoints.ts'

export type ResearchStreamEvent<T> = { readonly type: 'progress' } | { readonly type: 'result'; readonly value: T }

/** Keep long research work on the official stream carrier, with cooperative cancellation. */
export async function* streamResearchWork<T>(
  parent: AbortSignal, run: (signal: AbortSignal) => Promise<T>, interval = 10000,
): AsyncGenerator<ResearchStreamEvent<T>> {
  const controller = new AbortController()
  const signal = AbortSignal.any([parent, controller.signal])
  signal.throwIfAborted()
  const work = abortable(Promise.resolve().then(() => run(signal)), signal)
    .then(value => ({ type: 'result' as const, value }), (error: unknown) => ({ type: 'error' as const, error }))
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    yield { type: 'progress' }
    while (true) {
      const next = await Promise.race([work, new Promise<{ type: 'progress' }>((resolve) => {
        timer = setTimeout(() => { resolve({ type: 'progress' }) }, interval)
      })])
      clearTimeout(timer)
      if (next.type === 'error') throw next.error
      signal.throwIfAborted()
      yield next
      if (next.type === 'result') return
    }
  } finally {
    clearTimeout(timer)
    controller.abort(new Error('Research stream closed'))
  }
}

/** Host-wide admission and bounded recovery, shared by index, HTML and PDF requests. */
import { abortable } from '../workflows/review-checkpoints.ts'
export interface SourceEvent {
  source: string
  url: string
  kind: 'request' | 'wait' | 'response' | 'failure' | 'circuit-open' | 'cooldown'
  at: number
  milliseconds?: number
  status?: number
  attempt?: number
  reason?: string
}
export interface SourcePolicy {
  intervalMs: number
  maxConcurrency: number
  maxRetries: number
  cooldownMs: number
  maxBackoffMs: number
  failureThreshold: number
  circuitMs: number
}
interface Gate {
  active: number
  next: number
  until: number
  failures: number
  circuitUntil: number
}
export class SourceUnavailableError extends Error {
  constructor(readonly source: string, readonly retryAt: number, reason: string) { super(reason) }
}
export function academicSource(url: string): string {
  const host = new URL(url).hostname.toLowerCase()
  if (host === 'arxiv.org' || host.endsWith('.arxiv.org'))
    return 'arxiv'
  if (host === 'semanticscholar.org' || host.endsWith('.semanticscholar.org'))
    return 'semantic-scholar'
  if (host === 'openalex.org' || host.endsWith('.openalex.org'))
    return 'openalex'
  return host
}
export function retryAfterMilliseconds(value: string | null | undefined, now = Date.now()): number | undefined {
  if (!value?.trim())
    return undefined
  if (/^\d+(?:\.\d+)?$/u.test(value.trim()))
    return Math.ceil(Number(value) * 1000)
  const date = Date.parse(value)
  return Number.isFinite(date) ? Math.max(0, date - now) : undefined
}
const sleep = async (ms: number, signal?: AbortSignal): Promise<void> => {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await abortable(new Promise<void>((resolve) => { timer = setTimeout(resolve, ms) }), signal)
  }
  finally {
    if (timer)
      clearTimeout(timer)
  }
}
export class SourceCoordinator {
  private readonly gates = new Map<string, Gate>()
  constructor(private readonly defaults: Partial<SourcePolicy> = {}, private readonly random = Math.random) { }
  async request<T>(url: string, signal: AbortSignal | undefined, action: () => Promise<{
    value: T
    status: number
    retryAfter?: string | null
  }>, options: {
    intervalMs?: number
    maxRetries?: number
    waitForCooldown?: boolean
    onEvent?: (event: SourceEvent) => void
  } = {}): Promise<T> {
    const source = academicSource(url)
    const policy: SourcePolicy = { intervalMs: source === 'arxiv' ? 3100 : 1000, maxConcurrency: 1,
      maxRetries: 0, cooldownMs: 30000, maxBackoffMs: 60000, failureThreshold: 3, circuitMs: 60000,
      ...this.defaults, ...(options.intervalMs === undefined ? {} : { intervalMs: options.intervalMs }),
      ...(options.maxRetries === undefined ? {} : { maxRetries: options.maxRetries }) }
    const gate = this.gates.get(source) ?? { active: 0, next: 0, until: 0, failures: 0, circuitUntil: 0 }
    this.gates.set(source, gate)
    const emit = (event: Omit<SourceEvent, 'source' | 'url' | 'at'>): void => options.onEvent?.({ source, url, at: Date.now(), ...event })
    for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
      const queuedAt = Date.now()
      for (;;) {
        signal?.throwIfAborted()
        const now = Date.now()
        if (options.waitForCooldown === false && gate.until > now) {
          emit({ kind: 'cooldown', milliseconds: gate.until - now, reason: 'Source not called while cooling down' })
          throw new SourceUnavailableError(source, gate.until, 'Source cooling down: ' + source)
        }
        if (gate.circuitUntil > now) {
          emit({ kind: 'circuit-open', reason: 'Temporary source circuit; not an empty result' })
          throw new SourceUnavailableError(source, gate.circuitUntil, 'Temporary source circuit open: ' + source)
        }
        const wait = Math.max(gate.next, gate.until) - now
        if (gate.active < policy.maxConcurrency && wait <= 0) {
          gate.active++
          gate.next = now + policy.intervalMs
          break
        }
        await sleep(Math.min(1000, Math.max(1, gate.active >= policy.maxConcurrency ? 25 : wait)), signal)
      }
      emit({ kind: 'wait', milliseconds: Date.now() - queuedAt, attempt })
      const start = Date.now()
      emit({ kind: 'request', attempt })
      try {
        // The slot remains held until a non-cooperative adapter actually settles.
        const work = Promise.resolve().then(action).finally(() => { gate.active-- })
        const result = await abortable(work, signal)
        signal?.throwIfAborted()
        emit({ kind: 'response', status: result.status, milliseconds: Date.now() - start, attempt })
        if (result.status === 429 || result.status === 503) {
          gate.failures++
          const backoff = Math.min(policy.maxBackoffMs, policy.cooldownMs * 2 ** attempt) * (1 + this.random() * 0.2)
          gate.until = Math.max(gate.until, Date.now() + Math.max(backoff, retryAfterMilliseconds(result.retryAfter) ?? 0))
          if (gate.failures >= policy.failureThreshold)
            gate.circuitUntil = Math.max(gate.until, Date.now() + policy.circuitMs)
          if (attempt === policy.maxRetries)
            throw new SourceUnavailableError(source, gate.until, 'Source rate limited: ' + source + ' HTTP ' + String(result.status))
        }
        else {
          if (result.status >= 500) {
            gate.failures++
            if (gate.failures >= policy.failureThreshold)
              gate.circuitUntil = Date.now() + policy.circuitMs
          }
          else {
            gate.failures = 0
            gate.circuitUntil = 0
          }
          return result.value
        }
      }
      catch (error) {
        if (!(error instanceof SourceUnavailableError) && !signal?.aborted &&
          (error instanceof TypeError || /TimeoutError|network|fetch failed|ECONN|socket/iu.test(String(error)))) {
          gate.failures++
          if (gate.failures >= policy.failureThreshold)
            gate.circuitUntil = Date.now() + policy.circuitMs
        }
        emit({ kind: 'failure', milliseconds: Date.now() - start, reason: String(error), attempt })
        throw error
      }
    }
    throw new Error('Source retry limit reached')
  }
}
export const sharedSourceCoordinator = new SourceCoordinator()

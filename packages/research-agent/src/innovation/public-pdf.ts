/** Bounded public binary transport, using the same host-wide gates as scholarly indexes. */
import { createHash } from 'node:crypto'
import { sharedSourceCoordinator, type SourceCoordinator, type SourceEvent } from './source-coordinator.ts'
import type { Acquisition } from './schema.ts'
export const DEFAULT_PDF_ORIGINS = ['https://arxiv.org', 'https://export.arxiv.org', 'https://openreview.net', 'https://aclanthology.org', 'https://proceedings.mlr.press', 'https://raw.githubusercontent.com', 'https://scholarworks.sjsu.edu', 'https://www.mdpi.com']
export interface PublicPdfOptions {
  beforeRequest?: () => void
  enabled?: boolean
  origins?: readonly string[]
  maxBytes?: number
  timeoutMs?: number
  fetch?: typeof globalThis.fetch
  minIntervalMs?: number
  coordinator?: SourceCoordinator
  onSourceEvent?: (event: SourceEvent) => void
  onAcquisition?: (acquisition: Acquisition) => void
}
export interface PublicPdfResult {
  bytes: Uint8Array
  acquisition: Acquisition
}
export class AcquisitionFetchError extends Error {
  constructor(message: string, readonly acquisition: Acquisition) { super(message) }
}
/** Compatibility helper for standalone acquisition scripts. Runtime transports use request() instead. */
export async function respectSourceInterval(url: string, signal: AbortSignal, configuredInterval?: number): Promise<void> {
  await sharedSourceCoordinator.request(url, signal, () => Promise.resolve({ value: undefined, status: 200 }),
    { intervalMs: configuredInterval })
}
function admitted(url: string, origins: ReadonlySet<string>): URL {
  const u = new URL(url)
  if (u.protocol !== 'https:' || u.username || u.password || !origins.has(u.origin) || u.hash)
    throw new Error('PDF origin/credentials not permitted: ' + u.origin)
  return u
}
export function createPublicPdfTransport(options: PublicPdfOptions = {}) {
  const origins = new Set(options.origins ?? DEFAULT_PDF_ORIGINS)
  for (const origin of origins)
    if (admitted(origin, origins).origin !== origin)
      throw new Error('PDF origins must be exact HTTPS origins')
  const maxBytes = options.maxBytes ?? 20 * 1024 * 1024
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 5)
    throw new Error('Invalid PDF byte limit')
  const coordinator = options.coordinator ?? sharedSourceCoordinator
  return async function read(url: string, parentSignal?: AbortSignal): Promise<PublicPdfResult> {
    if (options.enabled === false)
      throw new Error('Public PDF transport disabled')
    const deadline = AbortSignal.timeout(options.timeoutMs ?? 20000)
    const signal = parentSignal ? AbortSignal.any([parentSignal, deadline]) : deadline
    let current = admitted(url, origins)
    type Outcome = {
      redirect: string
    } | {
      paper: PublicPdfResult
    } | {
      failure: Acquisition
    }
    for (let redirect = 0; redirect <= 3; redirect++) {
      signal.throwIfAborted()
      const outcome = await coordinator.request<Outcome>(current.href, signal, async () => {
        options.beforeRequest?.()
        const response = await (options.fetch ?? globalThis.fetch)(current, { redirect: 'manual', credentials: 'omit', signal,
          headers: { accept: 'application/pdf', 'user-agent': 'DSH-Research-Agent/0.1 public-paper-validation' } })
        const acquisition: Acquisition = { url: current.href, at: new Date().toISOString(), status: response.status,
          sha256: '', transport: 'public-pdf', truncated: false, bodyAvailable: false, bytes: 0 }
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location')
          await response.body?.cancel()
          options.onAcquisition?.(acquisition)
          if (!location)
            throw new Error('PDF redirect has no location')
          return { value: { redirect: admitted(new URL(location, current).href, origins).href }, status: response.status }
        }
        if (!response.ok) {
          await response.body?.cancel()
          options.onAcquisition?.(acquisition)
          return { value: { failure: acquisition }, status: response.status, retryAfter: response.headers.get('retry-after') }
        }
        if (Number(response.headers.get('content-length') ?? 0) > maxBytes) {
          await response.body?.cancel()
          throw new Error('PDF exceeds byte limit')
        }
        const reader = response.body?.getReader()
        if (!reader)
          throw new Error('PDF response has no body')
        const chunks: Uint8Array[] = []
        let total = 0
        try {
          for (;;) {
            signal.throwIfAborted()
            const item = await reader.read()
            if (item.done)
              break
            total += item.value.length
            if (total > maxBytes)
              throw new Error('PDF exceeds byte limit')
            chunks.push(item.value)
          }
        }
        finally {
          await reader.cancel()
          reader.releaseLock()
        }
        const bytes = new Uint8Array(total)
        let offset = 0
        for (const chunk of chunks) {
          bytes.set(chunk, offset)
          offset += chunk.length
        }
        if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-')
          throw new Error('Public endpoint did not return a PDF (login/paywall/HTML)')
        Object.assign(acquisition, { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: total, bodyAvailable: true })
        options.onAcquisition?.(acquisition)
        return { value: { paper: { bytes, acquisition } }, status: response.status }
      }, { intervalMs: options.minIntervalMs, onEvent: options.onSourceEvent })
      if ('paper' in outcome)
        return outcome.paper
      if ('failure' in outcome)
        throw new AcquisitionFetchError('PDF HTTP ' + String(outcome.failure.status), outcome.failure)
      current = admitted(outcome.redirect, origins)
    }
    throw new Error('PDF redirect limit exceeded')
  }
}

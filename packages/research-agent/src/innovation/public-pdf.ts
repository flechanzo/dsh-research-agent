/** Explicit binary transport: official DSH Web currently exposes HTML/text only. */
import { createHash } from 'node:crypto'
import type { Acquisition } from './schema.ts'
export const DEFAULT_PDF_ORIGINS = [
  'https://arxiv.org',
  'https://export.arxiv.org',
  'https://openreview.net',
  'https://aclanthology.org',
  'https://proceedings.mlr.press',
]
export interface PublicPdfOptions {
  beforeRequest?: () => void
  enabled?: boolean
  origins?: readonly string[]
  maxBytes?: number
  timeoutMs?: number
  fetch?: typeof globalThis.fetch
  minIntervalMs?: number
}
export interface PublicPdfResult {
  bytes: Uint8Array
  acquisition: Acquisition
}
export class AcquisitionFetchError extends Error {
  readonly acquisition: Acquisition
  constructor(message: string, acquisition: Acquisition) {
    super(message)
    this.acquisition = acquisition
  }
}
const gates = new Map<string, Promise<void>>()
const lastRequest = new Map<string, number>()
async function pause(ms: number, signal: AbortSignal): Promise<void> {
  signal.throwIfAborted()
  await new Promise<void>((resolve, reject) => {
    const finish = (): void => {
      signal.removeEventListener('abort', abort)
      resolve()
    }
    const timer = setTimeout(finish, ms)
    const abort = (): void => {
      clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      reject(signal.reason instanceof Error ? signal.reason : new Error('Paper request aborted'))
    }
    signal.addEventListener('abort', abort, { once: true })
  })
}
export async function respectSourceInterval(
  url: string,
  signal: AbortSignal,
  configuredInterval?: number,
): Promise<void> {
  const u = new URL(url)
  const interval = configuredInterval ?? (u.hostname.endsWith('arxiv.org') ? 3100 : 1000)
  const now = Date.now()
  const scheduled = Math.max(now, (lastRequest.get(u.origin) ?? 0) + interval)
  lastRequest.set(u.origin, scheduled)
  await pause(scheduled - now, signal)
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
    if (admitted(origin, origins).origin !== origin) throw new Error('PDF origins must be exact HTTPS origins')
  const maxBytes = options.maxBytes ?? 20 * 1024 * 1024
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 5) throw new Error('Invalid PDF byte limit')
  return async function read(url: string, parentSignal?: AbortSignal): Promise<PublicPdfResult> {
    if (options.enabled === false) throw new Error('Public PDF transport disabled')
    const deadline = AbortSignal.timeout(options.timeoutMs ?? 20000)
    const signal = parentSignal === undefined ? deadline : AbortSignal.any([parentSignal, deadline])
    let current = admitted(url, origins)
    for (let redirect = 0; redirect <= 3; redirect++) {
      signal.throwIfAborted()
      const origin = current.origin
      const prior = gates.get(origin) ?? Promise.resolve()
      let release: () => void = () => {}
      const own = new Promise<void>((resolve) => {
        release = resolve
      })
      const queued = prior.then(() => own)
      gates.set(origin, queued)
      let response: Response
      try {
        await prior
        signal.throwIfAborted()
        await respectSourceInterval(current.href, signal, options.minIntervalMs)
        options.beforeRequest?.()
        response = await (options.fetch ?? globalThis.fetch)(current, {
          redirect: 'manual',
          credentials: 'omit',
          signal,
          headers: { accept: 'application/pdf', 'user-agent': 'DSH-Research-Agent/0.1 public-paper-validation' },
        })
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location')
          await response.body?.cancel()
          if (!location) throw new Error('PDF redirect has no location')
          current = admitted(new URL(location, current).href, origins)
          continue
        }
        if (!response.ok) {
          await response.body?.cancel()
          throw new AcquisitionFetchError('PDF HTTP ' + String(response.status), {
            url: current.href,
            at: new Date().toISOString(),
            status: response.status,
            sha256: '',
            transport: 'public-pdf',
            truncated: false,
            bodyAvailable: false,
            bytes: 0,
          })
        }
        const length = Number(response.headers.get('content-length') ?? 0)
        if (length > maxBytes) {
          await response.body?.cancel()
          throw new Error('PDF exceeds byte limit')
        }
        const reader = response.body?.getReader()
        if (!reader) throw new Error('PDF response has no body')
        const chunks: Uint8Array[] = []
        let total = 0
        try {
          for (;;) {
            signal.throwIfAborted()
            const item = await reader.read()
            if (item.done) break
            total += item.value.length
            if (total > maxBytes) throw new Error('PDF exceeds byte limit')
            chunks.push(item.value)
          }
        } finally {
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
        return {
          bytes,
          acquisition: {
            url: current.href,
            at: new Date().toISOString(),
            status: response.status,
            sha256: createHash('sha256').update(bytes).digest('hex'),
            transport: 'public-pdf',
            truncated: false,
            bytes: total,
          },
        }
      } finally {
        release()
        if (gates.get(origin) === queued) gates.delete(origin)
      }
    }
    throw new Error('PDF redirect limit exceeded')
  }
}

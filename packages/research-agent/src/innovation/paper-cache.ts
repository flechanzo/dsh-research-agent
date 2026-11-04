import { z } from 'zod'
import { createHash } from 'node:crypto'
import { abortable } from '../workflows/review-checkpoints.ts'
import { textDigest, workIdentity } from './documents.ts'
import type { RubricDocument, RubricSource } from './pipeline.ts'
export const publicPaperCacheSchema = z.object({
  id: z.string(), workId: z.string(), version: z.string(), sourceUrl: z.string(), actualUrl: z.string(),
  textSha256: z.string(), bodySha256: z.string(), fetchedAt: z.string(), verifiedAt: z.string(),
  comparisonDate: z.string(), extractionIdentity: z.string(), document: z.string(),
  original: z.string(), encoding: z.enum(['utf8', 'base64']),
  identity: z.object({ sourceBinding: z.boolean(), titleInBody: z.boolean(), status: z.enum(['verified', 'unverified']) }),
})
export type PublicPaperCacheEntry = z.infer<typeof publicPaperCacheSchema>
export interface PublicPaperCacheStore {
  entries(workId: string): Promise<readonly PublicPaperCacheEntry[]>
  put(entry: PublicPaperCacheEntry): Promise<void>
}
export class MemoryPublicPaperCache implements PublicPaperCacheStore {
  private readonly rows = new Map<string, PublicPaperCacheEntry>()
  entries(workId: string): Promise<readonly PublicPaperCacheEntry[]> {
    return Promise.resolve([...this.rows.values()].filter(r => r.workId === workId).map(r => structuredClone(r)))
  }
  put(entry: PublicPaperCacheEntry): Promise<void> {
    this.rows.set(entry.id, structuredClone(entry))
    if (this.rows.size > 256) this.rows.delete(this.rows.keys().next().value ?? '')
    return Promise.resolve()
  }
}
export const sharedPublicPaperCache = new MemoryPublicPaperCache()
const cacheGates = new WeakMap<PublicPaperCacheStore, Map<string, Promise<void>>>()
export async function withPaperCacheLock<T>(store: PublicPaperCacheStore, url: string,
  signal: AbortSignal | undefined, work: () => Promise<T>): Promise<T> {
  let gates = cacheGates.get(store)
  if (!gates) {
    gates = new Map()
    cacheGates.set(store, gates)
  }
  const prior = gates.get(url) ?? Promise.resolve()
  let release: () => void = () => { }
  const own = new Promise<void>((resolve) => { release = resolve })
  const queued = prior.then(() => own)
  gates.set(url, queued)
  try {
    await abortable(prior, signal)
    signal?.throwIfAborted()
    return await work()
  }
  finally {
    release()
    void queued.then(() => {
      if (gates.get(url) === queued)
        gates.delete(url)
    })
  }
}
export function paperRequestVersion(url: string): string | undefined {
  return new URL(url).pathname.match(/(?:\d{4}\.\d{4,5}|[a-z-]+\/\d{7})(v\d+)(?:\.pdf)?$/iu)?.[1]
}
export function cacheDocumentValid(doc: RubricDocument, comparisonDate: string): boolean {
  const p = doc.provenance
  if (!p || !doc.primary || p.coverage !== 'core-complete' || p.truncated || p.textSha256 !== textDigest(doc.text) || !doc.acquisition || doc.acquisition.status !== 200)
    return false
  if (p.versionDate && p.versionDate.slice(0, 10) > comparisonDate)
    return false
  // Historical assessments never borrow an unversioned current body.
  const today = new Date().toISOString().slice(0, 10)
  return comparisonDate >= today || (!!p.versionDate && p.versionDate.slice(0, 10) <= comparisonDate)
}
export async function findCachedPaper(store: PublicPaperCacheStore, source: RubricSource, comparisonDate: string,
  extractionIdentity: string, maxAgeMs: number): Promise<RubricDocument | undefined> {
  const entries = await store.entries(workIdentity(source.url))
  const requestedVersion = paperRequestVersion(source.url)
  for (const row of [...entries].sort((a, b) => b.fetchedAt.localeCompare(a.fetchedAt))) {
    if (row.identity.status !== 'verified' || row.extractionIdentity !== extractionIdentity || Date.now() - Date.parse(row.verifiedAt) >= maxAgeMs)
      continue
    // Explicit HTML and PDF requests retain their own bodies; abs/landing requests can reuse resolved originals.
    if (source.url !== row.sourceUrl && source.url !== row.actualUrl)
      continue
    if (requestedVersion && !row.version.endsWith(requestedVersion))
      continue
    const bytes = row.encoding === 'base64' ? Buffer.from(row.original, 'base64') : Buffer.from(row.original)
    if (createHash('sha256').update(bytes).digest('hex') !== row.bodySha256)
      continue
    let doc: RubricDocument
    try { doc = JSON.parse(row.document) as RubricDocument }
    catch { continue }
    if (cacheDocumentValid(doc, comparisonDate) && doc.provenance?.textSha256 === row.textSha256 && workIdentity(source.url) === row.workId)
      return doc
  }
  return undefined
}
export function makePaperCacheEntry(source: RubricSource, doc: RubricDocument, original: string | Uint8Array,
  comparisonDate: string, extractionIdentity: string): PublicPaperCacheEntry | undefined {
  if (!doc.provenance || !doc.acquisition || !doc.url || !/^https:/u.test(doc.url))
    return undefined
  const bytes = typeof original === 'string' ? new TextEncoder().encode(original) : original
  const sourceBinding = workIdentity(source.url) === workIdentity(doc.url) || doc.provenance.originalUrl === source.url
  const words = source.title.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []
  const start = doc.text.slice(0, 8000).normalize('NFKC').toLowerCase()
  const titleInBody = words.length >= 2 && words.filter(w => start.includes(w)).length / words.length >= 0.7
  const bodySha256 = createHash('sha256').update(bytes).digest('hex')
  const verified = sourceBinding && titleInBody && bodySha256 === doc.acquisition.sha256 && cacheDocumentValid(doc, comparisonDate)
  return { id: textDigest(JSON.stringify([workIdentity(source.url), doc.provenance.version, doc.url,
    doc.provenance.textSha256, bodySha256, extractionIdentity])),
  workId: workIdentity(source.url), version: doc.provenance.version, sourceUrl: source.url, actualUrl: doc.url,
  textSha256: doc.provenance.textSha256, bodySha256, fetchedAt: doc.acquisition.at,
  verifiedAt: new Date().toISOString(), comparisonDate, extractionIdentity, document: JSON.stringify(doc),
  original: typeof original === 'string' ? original : Buffer.from(bytes).toString('base64'),
  encoding: typeof original === 'string' ? 'utf8' : 'base64',
  identity: { sourceBinding, titleInBody, status: verified ? 'verified' : 'unverified' } }
}

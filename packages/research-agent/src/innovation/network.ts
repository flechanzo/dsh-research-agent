/** Official DSH Web for indexes/HTML, separately bounded public HTTPS for binary PDF. */
import type { WebRuntime } from '@deepseek-ai/dsh-web'
import type { ResearchPaperReaderOptions, ResearchPaperReadContext } from '../workflows/research-coordinator.ts'
import { extractPaperBytes } from '../workflows/paper-reader.ts'
import { textDigest, paperProvenance, workIdentity } from './documents.ts'
import {
  createPublicPdfTransport,
  AcquisitionFetchError,
  type PublicPdfOptions,
} from './public-pdf.ts'
import type { Acquisition, DocumentProvenance } from './schema.ts'
import type { RubricDocument, RubricNetwork, RubricSource } from './pipeline.ts'
import { sharedSourceCoordinator } from './source-coordinator.ts'
import { findCachedPaper, makePaperCacheEntry, sharedPublicPaperCache, withPaperCacheLock, type PublicPaperCacheStore } from './paper-cache.ts'
export function rubricSourceText(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>|<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(
      /&(?:nbsp|amp|lt|gt|quot|apos|#39);/gu,
      e =>
        ({ '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&#39;': "'" })[e] ?? e,
    )
    .replace(/&#(\d+);/gu, (_all: string, digits: string) => {
      const n = Number(digits)
      return n <= 0x10ffff ? String.fromCodePoint(n) : ''
    })
    .replace(/\s+/gu, ' ')
    .trim()
}
const publicUrl = (value: string): string => {
  const u = new URL(value)
  if (
    u.protocol !== 'https:' ||
    u.username ||
    u.password ||
    /^(?:localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/u.test(u.hostname) ||
    /^172\.(?:1[6-9]|2\d|3[01])\./u.test(u.hostname)
  )
    throw new Error('Only public HTTPS paper URLs permitted')
  return u.href
}
function attributes(tag: string): Partial<Record<string, string>> {
  const attrs: Partial<Record<string, string>> = {}
  for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gu)) {
    const name = m.at(1)
    if (name !== undefined) attrs[name.toLowerCase()] = m.at(2) ?? m.at(3) ?? m.at(4)
  }
  return attrs
}
function htmlDocument(
  content: string,
  url: string,
  truncated: boolean,
  maxCharacters: number,
): { text: string; provenance: DocumentProvenance; pdfs: string[] } {
  const raw = rubricSourceText(content)
  const text = raw.slice(0, maxCharacters)
  const links: string[] = []
  const pdfs: string[] = []
  let version = 'unversioned endpoint'
  let versionDate: string | null = null
  for (const m of content.matchAll(/<(?:meta|a|link)\b[^>]*>/giu)) {
    const a = attributes(m[0])
    const name = (a.name ?? a.property ?? '').toLowerCase()
    const href = a.href ?? (name === 'citation_pdf_url' ? a.content : undefined)
    if (href) {
      try {
        const link = publicUrl(new URL(href.replace(/&amp;/gu, '&'), url).href)
        if (!links.includes(link)) links.push(link)
        const linked = new URL(link)
        const repositoryDownload = linked.origin === new URL(url).origin && linked.pathname === '/cgi/viewcontent.cgi' &&
          linked.searchParams.has('article') && linked.searchParams.has('context')
        if (name === 'citation_pdf_url' || a.type === 'application/pdf' || repositoryDownload ||
          /\.pdf(?:[?#]|$)|openreview\.net\/pdf\?/iu.test(link)) pdfs.push(link)
      } catch {
        /* Non-public/relative invalid references are not followed. */
      }
    }
    if (name === 'citation_arxiv_id' && a.content) version = a.content
    // An original publication date is deliberately not treated as a later PDF revision date.
    if (name === 'citation_version_date' && /^\d{4}-\d{2}-\d{2}/u.test(a.content ?? ''))
      versionDate = (a.content ?? '').slice(0, 10)
  }
  const arxiv = new URL(url).pathname.match(/\/(?:html|abs)\/([^/]+)/u)?.[1]
  if (arxiv) version = arxiv
  const cut = truncated || raw.length > maxCharacters
  const locations: DocumentProvenance['locations'] = []
  const headings = [...content.matchAll(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/giu)]
    .map((m) => {
      const label = rubricSourceText(m.at(1) ?? '')
      const prefix = rubricSourceText(content.slice(0, m.index))
      const start = text.indexOf(label, Math.max(0, prefix.length - 1))
      return { label, start, level: Number(m[0].at(2)) }
    })
    .filter(h => h.label.length > 0 && h.start >= 0)
  for (const [i, h] of headings.entries())
    locations.push({
      label:
        'section:' +
        h.label +
        (headings.some((other, j) => j < i && other.label === h.label) ? ' [' + String(i + 1) + ']' : ''),
      start: h.start,
      end: headings.at(i + 1)?.start ?? text.length,
    })
  const coreHeading = /\b(?:methods?|algorithms?|theorems?|proofs?|architecture|formulation|approach|model|analysis|problem definition)\b/iu
  const hasCoreSection = headings.some((heading, i) => {
    if (heading.level < 2 || !coreHeading.test(heading.label)) return false
    const nextPeer = headings.slice(i + 1).find(next => next.level <= heading.level)
    return (nextPeer?.start ?? text.length) - heading.start >= 500
  })
  const isCore = !cut && text.length >= 4000 && hasCoreSection && /<(?:article|section)\b/iu.test(content)
  const metadataPage = !hasCoreSection && pdfs.length > 0
  if (locations.length === 0) locations.push({ label: 'document', start: 0, end: text.length })
  return {
    text,
    provenance: {
      originalUrl: url,
      version,
      versionDate,
      textSha256: textDigest(text),
      coverage: isCore ? 'core-complete' : metadataPage || text.length < 4000 ? 'metadata' : 'partial',
      extraction: 'html',
      truncated: cut,
      locations,
      links: links.slice(0, 1500),
    },
    pdfs,
  }
}
export interface RubricNetworkOptions extends PublicPdfOptions {
  onTiming?: (event: { kind: 'network' | 'extraction'; url: string; milliseconds: number; cpuMilliseconds?: number }) => void
  cacheStore?: PublicPaperCacheStore
  comparisonDate?: string
  cacheMaxAgeMs?: number
  onCacheEvent?: (event: { kind: 'hit' | 'miss' | 'stored'; url: string; milliseconds: number }) => void
  webTransport?: 'dsh-web' | 'public-web'
  onText?: (content: string, acquisition: Acquisition) => Promise<void>
  onPdf?: (bytes: Uint8Array, acquisition: Acquisition) => Promise<void>
  paperOptions?: ResearchPaperReaderOptions
  paperContext?: ResearchPaperReadContext
  maxCharacters?: number
  onDocument?: (document: RubricDocument, bytes?: Uint8Array) => Promise<void>
}
export function createRubricNetwork(web: WebRuntime, inputOptions: RubricNetworkOptions = {}): RubricNetwork {
  const statistics: Record<string, number> = {}
  const add = (key: string, value = 1): void => { statistics[key] = (statistics[key] || 0) + value }
  const options: RubricNetworkOptions = { ...inputOptions,
    onSourceEvent: (event) => {
      if (event.kind === 'request') add('transportRequests')
      if (event.kind === 'wait') add('sourceQueueMilliseconds', event.milliseconds ?? 0)
      if (event.kind === 'response') { add('http' + String(event.status)); add('sourceActionMilliseconds', event.milliseconds ?? 0) }
      if (event.kind === 'cooldown') add('cooldownSkips')
      if (event.kind === 'circuit-open') add('circuitSkips')
      if (event.kind === 'failure') add('failureEvents')
      inputOptions.onSourceEvent?.(event)
    },
    onTiming: (event) => {
      add(event.kind + 'Milliseconds', event.milliseconds)
      if (event.cpuMilliseconds !== undefined) add(event.kind + 'ProcessCpuMilliseconds', event.cpuMilliseconds)
      inputOptions.onTiming?.(event)
    },
    onCacheEvent: (event) => { add('cache_' + event.kind); add('cacheLookupMilliseconds', event.milliseconds); inputOptions.onCacheEvent?.(event) },
  }
  const pdf = createPublicPdfTransport(options)
  const coordinator = options.coordinator ?? sharedSourceCoordinator
  const originalBodies = new Map<string, string>()
  async function fetchText(url: string, signal?: AbortSignal,
    records?: Acquisition[]): Promise<{ content: string; acquisition: Acquisition }> {
    publicUrl(url)
    const bounded = signal
      ? AbortSignal.any([signal, AbortSignal.timeout(options.timeoutMs ?? 20000)])
      : AbortSignal.timeout(options.timeoutMs ?? 20000)
    const result = await coordinator.request(url, bounded, async () => {
      options.beforeRequest?.()
      const networkStarted = Date.now()
      const r = await web.fetch({ url }, bounded)
      options.onTiming?.({ kind: 'network', url, milliseconds: Date.now() - networkStarted })
      publicUrl(r.url)
      const acquisition: Acquisition = { url: r.url, at: new Date().toISOString(), status: r.statusCode,
        sha256: textDigest(r.body.content), transport: options.webTransport ?? 'dsh-web', truncated: r.truncated }
      records?.push(acquisition)
      options.onAcquisition?.(acquisition)
      await options.onText?.(r.body.content, acquisition)
      if (r.statusCode >= 200 && r.statusCode < 300 &&
        !/api\.openalex|api\.semanticscholar|export\.arxiv/u.test(url)) originalBodies.set(acquisition.sha256,
        r.body.content)
      return { value: { content: r.body.content, acquisition }, status: r.statusCode }
      // DSH Web v0.2.1-rc.5 exposes no headers: its cooldown never invents Retry-After.
    }, { intervalMs: options.minIntervalMs, waitForCooldown: !/api\.openalex|api\.semanticscholar|export\.arxiv/u.test(url),
      onEvent: options.onSourceEvent })
    if (result.acquisition.status < 200 || result.acquisition.status >= 300)
      throw new AcquisitionFetchError('HTTP ' + String(result.acquisition.status) + ' ' + url, result.acquisition)
    return result
  }
  const network: RubricNetwork = {
    statistics,
    async search(query, signal) {
      const acquisitions: Acquisition[] = []
      const errors: string[] = []
      const sources: RubricSource[] = []
      try {
        const r = await fetchText(
          'https://api.openalex.org/works?search=' + encodeURIComponent(query) + '&per-page=5',
          signal, acquisitions,
        )
        if (r.acquisition.truncated) throw new Error('OpenAlex response truncated')
        const data = JSON.parse(r.content) as {
          results?: {
            title?: string
            publication_date?: string
            doi?: string
            best_oa_location?: { landing_page_url?: string; pdf_url?: string }
            primary_location?: { landing_page_url?: string; pdf_url?: string }
            locations?: { landing_page_url?: string; pdf_url?: string }[]
          }[]
        }
        if (!Array.isArray(data.results)) throw new Error('Invalid OpenAlex response')
        for (const item of data.results) {
          const loc = item.best_oa_location ?? item.primary_location
          const url = [loc?.landing_page_url, loc?.pdf_url, item.doi].find(
            u => typeof u === 'string' && /^https?:\/\//u.test(u),
          )
          if (url)
            sources.push({
              url: publicUrl(url.replace(/^http:/u, 'https:')),
              title: item.title ?? url,
              publicationDate: item.publication_date ?? null,
              ...(loc?.pdf_url ? { pdfUrl: loc.pdf_url.replace(/^http:/u, 'https:') } : {}),
              alternateUrls: [...new Set((item.locations ?? []).flatMap(l => [l.landing_page_url, l.pdf_url])
                .filter((u): u is string => typeof u === 'string' && /^https?:\/\//u.test(u))
                .map(u => publicUrl(u.replace(/^http:/u, 'https:'))))].filter(u => u !== url).slice(0, 8),
            })
        }
      } catch (e) {
        signal?.throwIfAborted()
        errors.push('OpenAlex: ' + String(e))
      }
      if (sources.length === 0) {
        try {
          const r = await fetchText(
            'https://api.semanticscholar.org/graph/v1/paper/search?query=' +
              encodeURIComponent(query) +
              '&limit=5&fields=title,url,year,publicationDate,openAccessPdf,externalIds',
            signal, acquisitions,
          )
          if (r.acquisition.truncated) throw new Error('Semantic Scholar response truncated')
          const data = JSON.parse(r.content) as {
            data?: {
              title: string
              url: string
              publicationDate?: string
              openAccessPdf?: { url: string } | null
              externalIds?: { ArXiv?: string; DOI?: string }
            }[]
          }
          if (!Array.isArray(data.data)) throw new Error('Invalid Semantic Scholar response')
          for (const item of data.data) {
            const url = item.externalIds?.ArXiv
              ? 'https://arxiv.org/abs/' + item.externalIds.ArXiv
              : item.externalIds?.DOI
                ? 'https://doi.org/' + item.externalIds.DOI
                : (item.openAccessPdf?.url ?? item.url)
            sources.push({
              url: publicUrl(url),
              title: item.title,
              publicationDate: item.publicationDate ?? null,
              ...(item.openAccessPdf?.url ? { pdfUrl: item.openAccessPdf.url } : {}),
            })
          }
        } catch (e) {
          signal?.throwIfAborted()
          errors.push('Semantic Scholar: ' + String(e))
        }
      }
      if (sources.length === 0) {
        try {
          const r = await fetchText(
            'https://export.arxiv.org/api/query?search_query=' +
              encodeURIComponent(query.split(/\s+/u).filter(Boolean).map(term => 'all:"' + term.replace(/["\\]/gu, '') + '"').join(' AND ')) +
              '&start=0&max_results=5',
            signal, acquisitions,
          )
          if (r.acquisition.truncated || !/<feed\b/u.test(r.content)) throw new Error('Invalid/truncated arXiv Atom')
          for (const entry of r.content.matchAll(/<entry>([\s\S]*?)<\/entry>/gu)) {
            const body = entry.at(1) ?? ''
            const id = body.match(/<id>([^<]+)<\/id>/u)?.[1]
            if (id)
              sources.push({
                url: publicUrl(id.replace(/^http:/u, 'https:')),
                title: rubricSourceText(body.match(/<title>([\s\S]*?)<\/title>/u)?.[1] ?? id),
                publicationDate:
                  body
                    .match(/<published>([^<]+)<\/published>/u)
                    ?.at(1)
                    ?.slice(0, 10) ?? null,
              })
          }
        } catch (e) {
          signal?.throwIfAborted()
          errors.push('arXiv: ' + String(e))
        }
      }
      return { sources, acquisitions, errors, status: sources.length ? 'found' : acquisitions.some(a => a.status === 429) ? 'rate-limited' : errors.length ? 'unavailable' : 'empty' }
    },
    async read(source, signal) {
      const original = new URL(publicUrl(source.url))
      const pdfUrls: string[] = []
      const urls: string[] = []
      const acquisitions: Acquisition[] = []
      const errors: string[] = []
      if (/(^|\.)arxiv\.org$/u.test(original.hostname)) {
        const id = original.pathname.replace(/^\/(?:abs|html|pdf)\//u, '').replace(/\.pdf$/u, '')
        if (original.pathname.startsWith('/pdf/')) pdfUrls.push(original.href)
        else urls.push('https://arxiv.org/html/' + id)
        pdfUrls.push('https://arxiv.org/pdf/' + id)
      } else if (original.hostname === 'openreview.net') {
        if (original.pathname === '/pdf') pdfUrls.push(original.href)
        else {
          urls.push(source.url)
          const id = original.searchParams.get('id')
          if (id) pdfUrls.push('https://openreview.net/pdf?id=' + encodeURIComponent(id))
        }
      } else if (/\.pdf$/iu.test(original.pathname)) pdfUrls.push(source.url)
      else urls.push(source.url)
      if (source.pdfUrl) pdfUrls.push(source.pdfUrl)
      // These addresses belong to the same index work; do not substitute merely similar titles.
      for (const alternate of source.alternateUrls ?? []) {
        const u = new URL(publicUrl(alternate))
        if (/\.pdf$/iu.test(u.pathname) || u.pathname === '/pdf' || u.pathname.startsWith('/pdf/')) pdfUrls.unshift(u.href)
        else if (u.hostname !== 'doi.org' && !/(^|\.)arxiv\.org$/u.test(u.hostname)) urls.unshift(u.href)
      }
      if (original.hostname === 'aclanthology.org' && !original.pathname.endsWith('.pdf'))
        pdfUrls.push(source.url.replace(/\/$/u, '') + '.pdf')
      let best: RubricDocument | undefined
      const finish = async (d: RubricDocument, bytes?: Uint8Array): Promise<RubricDocument> => {
        const result = { ...d, attempts: [...acquisitions], errors: [...errors] }
        await options.onDocument?.(result, bytes)
        const original = bytes ?? (d.acquisition ? originalBodies.get(d.acquisition.sha256) : undefined)
        if (original !== undefined) {
          const entry = makePaperCacheEntry(source, result, original, comparisonDate, extractionIdentity)
          if (entry) { await cacheStore.put(entry); options.onCacheEvent?.({ kind: 'stored', url: source.url, milliseconds: 0 }) }
        }
        if (d.acquisition) originalBodies.delete(d.acquisition.sha256)
        return result
      }
      for (const url of urls) {
        try {
          const r = await fetchText(url, signal)
          acquisitions.push(r.acquisition)
          const parseStarted = Date.now(), parseCpu = process.cpuUsage()
          const d = htmlDocument(r.content, r.acquisition.url, r.acquisition.truncated, options.maxCharacters ?? 180000)
          const cpu = process.cpuUsage(parseCpu)
          options.onTiming?.({ kind: 'extraction', url, milliseconds: Date.now() - parseStarted, cpuMilliseconds: (cpu.user + cpu.system) / 1000 })
          pdfUrls.push(...d.pdfs)
          best = {
            id: 'source-' + textDigest(r.acquisition.url + '|' + textDigest(d.text)).slice(0, 20),
            title: source.title,
            text: d.text,
            url: r.acquisition.url,
            workId: workIdentity(source.url),
            primary: d.provenance.coverage === 'core-complete',
            publicationDate: source.publicationDate,
            acquisition: r.acquisition,
            provenance: { ...d.provenance, originalUrl: source.url },
          }
          if (best.primary) return await finish(best)
        } catch (e) {
          signal?.throwIfAborted()
          if (e instanceof AcquisitionFetchError) acquisitions.push(e.acquisition)
          errors.push(url + ': ' + String(e))
        }
      }
      for (const url of [...new Set(pdfUrls)].slice(0, 4)) {
        try {
          const r = await pdf(publicUrl(url), signal)
          acquisitions.push(r.acquisition)
          await options.onPdf?.(r.bytes, r.acquisition)
          const extractStarted = Date.now(), cpuStarted = process.cpuUsage()
          const paper = await extractPaperBytes(r.bytes.slice(), 'public-paper.pdf', options.paperOptions, signal, {
            ...options.paperContext,
            allowPartial: true,
          })
          const cpu = process.cpuUsage(cpuStarted)
          options.onTiming?.({ kind: 'extraction', url, milliseconds: Date.now() - extractStarted, cpuMilliseconds: (cpu.user + cpu.system) / 1000 })
          const at = r.acquisition.at
          const id = new URL(r.acquisition.url).pathname.match(/\/(?:pdf)\/([^/]+)/u)?.[1]
          const provenance = paperProvenance(paper, source.url, at, id ?? 'unversioned PDF endpoint; retrieved ' + at)
          if (paper.text.length > (options.maxCharacters ?? 180000)) {
            provenance.coverage = 'partial'
            provenance.truncated = true
          }
          const text = paper.text.slice(0, options.maxCharacters ?? 180000)
          provenance.textSha256 = textDigest(text)
          provenance.locations = provenance.locations.filter(l => l.end <= text.length)
          const d: RubricDocument = {
            id: 'source-' + textDigest(r.acquisition.url + '|' + textDigest(text)).slice(0, 20),
            url: r.acquisition.url,
            title: source.title,
            text,
            primary: provenance.coverage === 'core-complete',
            publicationDate: source.publicationDate,
            acquisition: r.acquisition,
            provenance,
            workId: workIdentity(source.url),
          }
          if (d.primary) return await finish(d, r.bytes)
          if (!best || text.length > best.text.length) best = d
          await options.onDocument?.({ ...d, attempts: [...acquisitions], errors: [...errors] }, r.bytes)
        } catch (e) {
          signal?.throwIfAborted()
          if (e instanceof AcquisitionFetchError) acquisitions.push(e.acquisition)
          errors.push(url + ': ' + String(e))
        }
      }
      return finish(
        best ?? {
          id: 'source-' + textDigest(source.url).slice(0, 20),
          url: source.url,
          title: source.title,
          text: '',
          primary: false,
          publicationDate: source.publicationDate,
          workId: workIdentity(source.url),
          provenance: {
            originalUrl: source.url,
            version: 'unavailable',
            versionDate: null,
            textSha256: textDigest(''),
            coverage: 'unavailable',
            extraction: 'none',
            truncated: false,
            locations: [],
            links: [],
          },
        },
      )
    },
  }
  const cacheStore = options.cacheStore ?? sharedPublicPaperCache
  const comparisonDate = options.comparisonDate ?? new Date().toISOString().slice(0, 10)
  const extractionIdentity = JSON.stringify({ maxCharacters: options.maxCharacters ?? 180000,
    maxPdfPages: options.paperOptions?.maxPdfPages ?? 12, extraction: 'paper-reader-v1', ocrAllowed: options.paperContext?.allowOcr ?? false })
  const read = network.read.bind(network)
  network.read = async (source, signal) => withPaperCacheLock(cacheStore, source.url, signal, async () => {
    signal?.throwIfAborted()
    const start = Date.now()
    const cached = await findCachedPaper(cacheStore, source, comparisonDate, extractionIdentity, options.cacheMaxAgeMs ?? 24 * 3600000)
    signal?.throwIfAborted()
    options.onCacheEvent?.({ kind: cached ? 'hit' : 'miss', url: source.url, milliseconds: Date.now() - start })
    if (cached) { await options.onDocument?.(cached); return cached }
    return read(source, signal)
  })
  return network
}

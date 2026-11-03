/** Acquisition facts, independently recorded from scientific judgments. */
import { createHash } from 'node:crypto'
import type { DocumentProvenance } from './schema.ts'
import type { ResearchPaperDocument } from '../workflows/research-coordinator.ts'
export const textDigest = (text: string): string => createHash('sha256').update(text).digest('hex')
export function paperProvenance(
  paper: ResearchPaperDocument,
  originalUrl: string,
  at: string,
  version = 'unversioned; retrieved ' + at,
): DocumentProvenance {
  const locations = (paper.textPages ?? []).map((page) => {
    const marker = 'Page ' + String(page.pageNumber) + '\n'
    const start = paper.text.indexOf(marker) + marker.length
    return { label: 'page:' + String(page.pageNumber), start, end: start + page.text.length, page: page.pageNumber }
  })
  const truncated = paper.pageCount !== undefined && paper.processedPageCount !== paper.pageCount
  const missing = paper.missingPages ?? []
  const partial =
    truncated ||
    missing.length > 0 ||
    (paper.extractionMethod === 'ocr' && locations.length !== paper.processedPageCount)
  return {
    originalUrl,
    version,
    versionDate: null,
    textSha256: textDigest(paper.text),
    coverage: partial ? 'partial' : 'core-complete',
    extraction: paper.extractionMethod,
    truncated,
    locations,
    ...(paper.pageCount === undefined
      ? {}
      : { pageCount: paper.pageCount, processedPageCount: paper.processedPageCount ?? 0, missingPages: [...missing] }),
    links: [],
  }
}
/** Same paper through different formats is one work, not independent corroboration. */
export function workIdentity(url: string): string {
  const u = new URL(url)
  if (/(^|\.)arxiv\.org$/u.test(u.hostname))
    return (
      'arxiv:' +
      u.pathname
        .replace(/^\/(?:abs|html|pdf)\//u, '')
        .replace(/\.pdf$/u, '')
        .replace(/v\d+$/u, '')
    )
  if (u.hostname === 'openreview.net') return 'openreview:' + (u.searchParams.get('id') ?? u.pathname)
  if (u.hostname === 'aclanthology.org') return 'acl:' + u.pathname.replace(/\.pdf$/u, '').replace(/\/$/u, '')
  return (u.hostname + u.pathname).replace(/\/$/u, '').toLowerCase()
}

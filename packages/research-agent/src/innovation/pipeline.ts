import type { Acquisition, DocumentProvenance } from './schema.ts'

/**
 * Historical paper transport types retained for literature retrieval and old
 * data readers. They no longer participate in automatic Rubric scoring.
 */
export interface RubricDocument {
  readonly id: string
  readonly title: string
  readonly text: string
  readonly url?: string
  readonly primary: boolean
  readonly publicationDate: string | null
  readonly provenance?: DocumentProvenance
  readonly workId?: string
  readonly attempts?: readonly Acquisition[]
  readonly errors?: readonly string[]
  readonly acquisition?: Acquisition
}

export interface RubricSource {
  readonly url: string
  readonly title: string
  readonly publicationDate: string | null
  readonly pdfUrl?: string
  readonly alternateUrls?: readonly string[]
}

export interface RubricSearchResult {
  readonly status?: 'found' | 'empty' | 'rate-limited' | 'unavailable'
  readonly sources: readonly RubricSource[]
  readonly acquisitions: readonly Acquisition[]
  readonly errors: readonly string[]
}

export interface RubricNetwork {
  readonly statistics?: Readonly<Record<string, number>>
  search(query: string, signal?: AbortSignal): Promise<RubricSearchResult>
  read(source: RubricSource, signal?: AbortSignal): Promise<RubricDocument>
}

export interface RubricModelResponse {
  readonly text: string
  readonly finish: 'completed' | 'aborted' | 'failed' | 'max-tokens'
  readonly inputTokens: number | null
  readonly outputTokens: number | null
}

export type RubricModel = (stage: string, prompt: string, signal?: AbortSignal) =>
  Promise<string | RubricModelResponse>


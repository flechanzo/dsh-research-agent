/** Structured evidence records used by the human-facing research workflow.
 *
 * These records are deliberately smaller and workflow-oriented: they keep the source identity, acquisition
 * provenance, exact quote location, and claim mapping together so ordinary
 * literature stages can become auditable without embedding full documents in
 * Session state.
 */
import { createHash } from 'node:crypto'
import { z } from 'zod'

const text = z.string().trim().min(1).max(12000)
const id = z.string().trim().min(1).max(256)
const sha256 = z.string().regex(/^[a-f0-9]{64}$/u)
const dateTime = z.iso.datetime({ offset: true })

export const researchEvidenceLocationSchema = z.object({
  label: z.string().trim().min(1).max(200),
  page: z.number().int().positive().optional(),
  start: z.number().int().nonnegative().optional(),
  end: z.number().int().nonnegative().optional(),
}).superRefine((location, context) => {
  if (location.start !== undefined && location.end !== undefined && location.end < location.start)
    context.addIssue({ code: 'custom', message: 'evidence location end must be greater than or equal to start' })
})

export type ResearchEvidenceLocation = z.infer<typeof researchEvidenceLocationSchema>

export const researchEvidenceSchema = z.object({
  evidenceId: id,
  sourceId: id,
  sourceRef: text,
  sourceTitle: text,
  provider: z.enum(['upload', 'arxiv', 'openreview', 'semantic-scholar', 'acl-anthology', 'openalex', 'other']),
  workId: id.optional(),
  version: text,
  publicationDate: z.string().trim().max(80).nullable(),
  acquiredAt: dateTime,
  textSha256: sha256,
  coverage: z.enum(['metadata', 'partial', 'core-complete', 'unavailable']),
  extraction: z.enum(['metadata', 'html', 'plain-text', 'embedded-text', 'ocr', 'none']),
  location: researchEvidenceLocationSchema,
  quote: text,
  quoteSha256: sha256,
  verification: z.enum(['exact', 'normalized', 'unverified', 'unavailable']),
})
export type ResearchEvidence = z.infer<typeof researchEvidenceSchema>

export const researchClaimSchema = z.object({
  claimId: id,
  statement: text,
  kind: z.enum(['fact', 'comparison', 'novelty', 'hypothesis']),
  evidenceIds: z.array(id).max(50),
  status: z.enum(['supported', 'partial', 'unresolved', 'contradicted']),
}).superRefine((claim, context) => {
  if (['supported', 'contradicted'].includes(claim.status) && claim.evidenceIds.length === 0)
    context.addIssue({ code: 'custom', message: `${claim.status} claim requires at least one evidence reference` })
})
export type ResearchClaim = z.infer<typeof researchClaimSchema>

export const researchSearchFailureSchema = z.object({
  provider: z.enum(['arxiv', 'openreview', 'semantic-scholar', 'acl-anthology', 'openalex', 'other']),
  category: z.enum([
    'dns-resolution', 'non-public-address', 'proxy-connection', 'connection-timeout',
    'http-429', 'http-5xx', 'response-format', 'network', 'unknown',
  ]),
  attempts: z.number().int().nonnegative(),
  message: text,
})
export type ResearchSearchFailure = z.infer<typeof researchSearchFailureSchema>

export const researchSearchRunSchema = z.object({
  searchRunId: id,
  query: text,
  queryStrategy: text,
  providers: z.array(z.enum(['arxiv', 'openreview', 'semantic-scholar', 'acl-anthology', 'openalex', 'other'])).min(1),
  startedAt: dateTime,
  endedAt: dateTime,
  sourceIds: z.array(id),
  attempts: z.number().int().nonnegative(),
  deduplicatedCount: z.number().int().nonnegative(),
  status: z.enum(['found', 'empty', 'partial', 'failed']),
  completeness: z.enum(['unknown', 'partial', 'sufficient']),
  failures: z.array(researchSearchFailureSchema),
}).superRefine((run, context) => {
  if (run.endedAt < run.startedAt)
    context.addIssue({ code: 'custom', message: 'search run endedAt must not precede startedAt' })
  if (run.status === 'failed' && run.failures.length === 0)
    context.addIssue({ code: 'custom', message: 'failed search run requires provider failures' })
  if (run.completeness === 'sufficient' && run.status !== 'found')
    context.addIssue({ code: 'custom', message: 'only a found search run can be sufficient' })
})
export type ResearchSearchRun = z.infer<typeof researchSearchRunSchema>

export const researchEvidenceBundleSchema = z.object({
  evidence: z.array(researchEvidenceSchema).max(500),
  claims: z.array(researchClaimSchema).max(200),
  searchRuns: z.array(researchSearchRunSchema).max(100),
}).superRefine((bundle, context) => {
  const evidenceIds = new Set<string>()
  for (const [index, record] of bundle.evidence.entries()) {
    if (evidenceIds.has(record.evidenceId))
      context.addIssue({ code: 'custom', message: `duplicate evidenceId: ${record.evidenceId}`, path: ['evidence', index, 'evidenceId'] })
    evidenceIds.add(record.evidenceId)
    const expectedQuoteHash = createHash('sha256').update(record.quote).digest('hex')
    if (expectedQuoteHash !== record.quoteSha256)
      context.addIssue({ code: 'custom', message: `quoteSha256 does not match quote: ${record.evidenceId}`, path: ['evidence', index, 'quoteSha256'] })
    if (record.verification === 'exact' && record.coverage !== 'core-complete')
      context.addIssue({ code: 'custom', message: 'exact evidence requires core-complete source coverage', path: ['evidence', index, 'verification'] })
  }
  const claimIds = new Set<string>()
  for (const [index, claim] of bundle.claims.entries()) {
    if (claimIds.has(claim.claimId))
      context.addIssue({ code: 'custom', message: `duplicate claimId: ${claim.claimId}`, path: ['claims', index, 'claimId'] })
    claimIds.add(claim.claimId)
    for (const evidenceId of claim.evidenceIds) {
      if (!evidenceIds.has(evidenceId))
        context.addIssue({ code: 'custom', message: `claim references missing evidence: ${evidenceId}`, path: ['claims', index, 'evidenceIds'] })
    }
  }
})
export type ResearchEvidenceBundle = z.infer<typeof researchEvidenceBundleSchema>

/** Validate and return a defensive copy before attaching evidence to an artifact. */
export function validateResearchEvidenceBundle(input: {
  readonly evidence: readonly ResearchEvidence[]
  readonly claims: readonly ResearchClaim[]
  readonly searchRuns: readonly ResearchSearchRun[]
}): ResearchEvidenceBundle {
  return structuredClone(researchEvidenceBundleSchema.parse({
    evidence: [...input.evidence],
    claims: [...input.claims],
    searchRuns: [...input.searchRuns],
  }))
}

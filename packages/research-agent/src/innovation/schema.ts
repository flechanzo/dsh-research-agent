/** Runtime schemas shared by the Host, persisted optional v1 fields and UI. */
import { z } from 'zod'
const text = z.string().trim().min(1).max(12000)
const ids = z.array(z.string().min(1)).max(100)
export const targetTaskFieldsSchema = z.object({
  comparisonPoint: z.iso.date(),
  domain: text,
  problem: text,
  input: text,
  output: text,
  constraints: text,
  conditions: text,
  subtaskBoundary: text,
})
export const targetTaskSchema = targetTaskFieldsSchema.extend({
  contextDigest: z.string().regex(/^[a-f0-9]{64}$/u),
  confirmedAt: z.number().int().nonnegative(),
})
export type TargetTaskFields = z.infer<typeof targetTaskFieldsSchema>
export type TargetTask = z.infer<typeof targetTaskSchema>
export const evidenceSchema = z.object({ sourceId: text, location: text, quote: text })
export const factSchema = z.object({ id: text, statement: text, evidence: z.array(evidenceSchema).min(1) })
export const categorySchema = z.enum([
  'A1',
  'A2',
  'A3',
  'A4',
  'B1',
  'B2',
  'B3',
  'B4',
  'C1',
  'C2',
  'C3',
  'C4',
  'C5',
  'C6',
  'C7',
  'C8',
  'D1',
  'D2',
  'D3',
  'D4',
  'E1',
  'E2',
  'E3',
  'E4',
  'E5',
  'E6',
  'E7',
  'E8',
  'E9',
  'E10',
  'E11',
  'P1',
  'P2',
  'P3',
  'P4',
])
export type RubricCategory = z.infer<typeof categorySchema>
export const contributionSeedSchema = z.object({
  id: text,
  claim: text,
  core: z.boolean(),
  kind: z.enum(['algorithm', 'theory', 'problem']),
  evidence: z.array(evidenceSchema).min(1),
})
export const extractionSchema = z.object({
  paperVersion: text,
  comparisonPoint: z.iso.date(),
  coreReadable: z.boolean(),
  mainline: text,
  noveltyUnit: text,
  contributions: z.array(contributionSeedSchema).min(1).max(8),
})
export type ContributionSeed = z.infer<typeof contributionSeedSchema>
export const sourceModuleSchema = z.object({
  origin: text,
  attribution: text,
  novelty: text,
  necessaryComplexity: text,
  role: text,
  factIds: ids,
})
export const problemComparisonSchema = z.object({
  oldProblem: text,
  newProblem: text,
  obstacle: text,
  mapping: text,
  effect: text,
  deduplication: text,
})
export const boundarySchema = z.object({
  lowerCategory: text,
  coreRelation: text,
  basicPrinciple: text,
  problemNonEquivalence: text,
  nonFragmentation: text,
  c8HighEnd: text,
  e9Conditions: text,
})
export const contributionSchema = contributionSeedSchema.extend({
  category: categorySchema.nullable(),
  S0: z.number().min(0).max(10).multipleOf(0.5),
  R: z.union([z.literal(0), z.literal(1), z.literal(1.5), z.literal(2)]),
  R_included: z.union([z.literal(0), z.literal(1), z.literal(1.5), z.literal(2)]),
  eligibility: z.enum(['verified', 'duplicate', 'invalid', 'unknown']),
  servesMainline: z.boolean(),
  validityReview: text,
  validityFactIds: ids,
  categoryFactIds: ids,
  baseFactIds: ids,
  adaptationFactIds: ids,
  independenceFactIds: ids,
  sourceModuleAssessment: sourceModuleSchema,
  problemComparison: problemComparisonSchema,
  boundaryChecks: boundarySchema,
})
export type RubricContribution = z.infer<typeof contributionSchema>
export type RubricFact = z.infer<typeof factSchema>
export const classificationSchema = z.object({
  contributions: z.array(contributionSchema).min(1).max(8),
  facts: z.array(factSchema).max(150),
  sameFactGroups: z.array(ids),
  mainline: z.object({ status: z.enum(['established', 'failed', 'unknown']), reasoning: text }),
  criticalUncertainties: z.array(text),
  nonDecisiveDisputes: z.array(text),
  confidence: z.object({ level: z.enum(['high', 'medium', 'low']), reason: text }),
})
export const acquisitionSchema = z.object({
  url: z.url(),
  at: z.string(),
  status: z.number().int(),
  sha256: z.string(),
  transport: z.enum(['dsh-web', 'public-web', 'public-pdf', 'fixture']),
  truncated: z.boolean(),
  bodyAvailable: z.boolean().optional(),
  bytes: z.number().int().nonnegative().optional(),
})
export type Acquisition = z.infer<typeof acquisitionSchema>
export const documentProvenanceSchema = z.object({
  originalUrl: z.url(),
  version: z.string(),
  versionDate: z.string().nullable(),
  textSha256: z.string().regex(/^[a-f0-9]{64}$/u),
  coverage: z.enum(['metadata', 'partial', 'core-complete', 'unavailable']),
  extraction: z.enum(['html', 'plain-text', 'embedded-text', 'ocr', 'none']),
  truncated: z.boolean(),
  pageCount: z.number().int().optional(),
  processedPageCount: z.number().int().optional(),
  missingPages: z.array(z.number().int()).optional(),
  locations: z.array(
    z.object({
      label: z.string(),
      start: z.number().int().nonnegative(),
      end: z.number().int().nonnegative(),
      page: z.number().int().optional(),
    }),
  ),
  links: z.array(z.url()),
})
export type DocumentProvenance = z.infer<typeof documentProvenanceSchema>
export const sourceReadingSchema = z.object({
  sourceId: text,
  url: z.url(),
  title: text,
  acquisition: acquisitionSchema,
  provenance: documentProvenanceSchema.optional(),
  workId: z.string().optional(),
  readings: z.array(evidenceSchema).min(1),
  primary: z.boolean(),
  publicationDate: z.string().nullable(),
})
export const searchSufficiencySchema = z.object({
  coreVerified: z.boolean(),
  methodReadings: z.array(evidenceSchema).min(1),
  earlierWorkCheck: text,
  isomorphismCheck: text,
  closestPrecedentCheck: text,
  alternativeDecisions: z.array(
    z.object({
      url: z.url(),
      disposition: z.enum(['read', 'excluded', 'unresolved']),
      reason: text,
      evidence: z.array(evidenceSchema).min(1),
    }),
  ),
  unresolvedAlternatives: z.array(text),
})
export const roundReviewSchema = z.object({
  sufficiency: searchSufficiencySchema.optional(),
  nearestPrecedents: ids,
  support: z.array(text),
  counterexamples: z.array(text),
  exclusions: z.array(text),
  changeFromPrevious: text,
  readings: z.array(evidenceSchema).min(1),
  criticalMissingSources: z.array(text),
})
export const searchRoundSchema = z.object({
  contributionId: text,
  round: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  purpose: text,
  queries: z.array(text).min(1),
  adjustmentFromPrevious: text,
  startedAt: z.string(),
  acquisitions: z.array(acquisitionSchema),
  sources: z.array(sourceReadingSchema),
  discoveredSources: z
    .array(
      z.object({
        url: z.url(),
        title: z.string(),
        publicationDate: z.string().nullable(),
        pdfUrl: z.string().optional(),
      }),
    )
    .optional(),
  review: roundReviewSchema.extend({ readings: z.array(evidenceSchema) }),
  completed: z.boolean(),
  errors: z.array(text),
})
export type SearchRound = z.infer<typeof searchRoundSchema>
const halfScore = z.number().min(0).max(10).multipleOf(0.5)
export const contributionScoreSchema = z.object({
  id: text,
  category: categorySchema.nullable(),
  L: halfScore,
  H: halfScore,
  S0: halfScore,
  R: halfScore,
  R_included: halfScore,
  Delta_R: halfScore,
  U0: halfScore,
  U_class: halfScore.nullable(),
  U_i: halfScore,
  S_i: halfScore,
  j_i: z.number().min(0).max(1).multipleOf(0.5),
  disposition: z.enum(['main', 'secondary', 'excluded']),
  reason: text,
})
export const scoreSchema = z.object({
  candidates: z.array(contributionScoreSchema),
  mainId: z.string().nullable(),
  U_main: halfScore.nullable(),
  S_main: halfScore.nullable(),
  J: z.number().min(0).max(1).multipleOf(0.5),
  M: z.union([z.literal(4), z.literal(10)]),
  S: halfScore.nullable(),
  caps: text,
})
export type RubricScore = z.infer<typeof scoreSchema>
export const rubricAssessmentSchema = z
  .object({
    rubricVersion: z.literal('1.7.0'),
    rubricSha256: z.string(),
    mode: z.literal('shadow'),
    assessedAt: z.string(),
    targetTask: targetTaskSchema.nullable(),
    assessmentStatus: z.enum(['complete', 'provisional', 'insufficient']),
    comparisonScope: z.object({
      assessedObject: text,
      paperVersion: text,
      comparisonPoint: text,
      coverage: text,
      missingCriticalSources: z.array(text),
    }),
    searchAudit: z.array(searchRoundSchema),
    mainline: z.object({ status: z.enum(['established', 'failed', 'unknown']), reasoning: text }),
    noveltyUnit: text,
    contributions: z.array(contributionSchema),
    facts: z.array(factSchema),
    sameFactGroups: z.array(ids),
    sourceModuleAssessment: z.array(sourceModuleSchema),
    problemComparison: z.array(problemComparisonSchema),
    boundaryChecks: z.array(boundarySchema),
    validityCheck: z.array(z.object({ contributionId: text, result: text, factIds: ids })),
    score: scoreSchema,
    confidence: z.object({ level: z.enum(['high', 'medium', 'low']), reason: text }),
    uncertainties: z.array(text),
    stages: z.array(z.object({ stage: text, at: z.string(), outcome: text })),
    synthesis: text,
    legacyComparison: z
      .object({ score: z.number(), threshold: z.number(), pass: z.boolean(), disagreement: text })
      .optional(),
  })
  .superRefine((assessment, context) => {
    const issue = (message: string): void => {
      context.addIssue({ code: 'custom', message })
    }
    if ((assessment.assessmentStatus === 'insufficient') !== (assessment.score.S === null)) {
      issue('insufficient must have S=null; complete/provisional must have a numerical S')
    }
    if (assessment.score.S === null) return
    if (assessment.targetTask === null) issue('Numerical assessment requires a confirmed target_task')
    if (assessment.contributions.length === 0) issue('Numerical assessment requires evaluated contributions')
    if (assessment.comparisonScope.missingCriticalSources.length > 0) issue('Critical original source is missing')
    for (const contribution of assessment.contributions) {
      const rounds = assessment.searchAudit.filter(
        round => round.contributionId === contribution.id && round.completed,
      )
      for (const number of [1, 2, 3]) {
        if (!rounds.some(round => round.round === number))
          issue('Contribution lacks three completed rounds: ' + contribution.id)
      }
      const queries = rounds.flatMap(round =>
        round.queries.map(query => query.trim().toLowerCase().replace(/\s+/gu, ' ')),
      )
      if (queries.length !== new Set(queries).size) issue('Repeated query cannot satisfy three distinct rounds')
      if (
        rounds.some(
          round =>
            !round.sources.some(
              source =>
                source.primary &&
                ['dsh-web', 'public-pdf'].includes(source.acquisition.transport) &&
                source.acquisition.status >= 200 &&
                source.acquisition.status < 300 &&
                !source.acquisition.truncated,
            ),
        )
      ) {
        issue('Each completed round requires acquired primary-source evidence')
      }
    }
  })
export type RubricAssessment = z.infer<typeof rubricAssessmentSchema>

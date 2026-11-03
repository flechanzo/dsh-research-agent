import { contributionSchema, factSchema } from './schema.ts'
import { calculateRubricScore } from './scorer.ts'
/** Reviewer identity/provenance is mandatory; independent expertise is never inferred from model count. */
import { z } from 'zod'
export const reviewerSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['human-domain-expert', 'human-reviewer', 'model', 'engineering-fixture']),
  affiliation: z.string().min(1),
  expertise: z.string().min(1),
  independenceDeclaration: z.string().min(1),
})
export const reviewSubmissionSchema = z
  .object({
    caseId: z.string(),
    targetTaskDigest: z.string().regex(/^[a-f0-9]{64}$/u),
    comparisonPoint: z.iso.date(),
    rubricSha256: z.string().regex(/^[a-f0-9]{64}$/u),
    reviewer: reviewerSchema,
    reviewedAt: z.iso.datetime(),
    actualNetworkAudit: z
      .array(
        z.object({ query: z.string(), at: z.string(), sourceUrls: z.array(z.url()), bodyHashes: z.array(z.string()) }),
      )
      .min(3),
    status: z.enum(['complete', 'provisional', 'insufficient']),
    score: z.number().min(0).max(10).multipleOf(0.5).nullable(),
    scorerInput: z
      .object({
        contributions: z.array(contributionSchema),
        facts: z.array(factSchema),
        sameFactGroups: z.array(z.array(z.string())),
        mainline: z.enum(['established', 'failed', 'unknown']),
      })
      .optional(),
    mainId: z.string().nullable(),
    categories: z.record(z.string(), z.string().nullable()),
    R: z.record(z.string(), z.number()),
    J: z.number().min(0).max(1),
    disagreements: z.array(
      z.object({
        axis: z.enum(['retrieval-evidence', 'classification', 'contribution-independence', 'legacy-system']),
        reason: z.string().min(1),
        evidence: z.array(z.string()),
      }),
    ),
  })
  .superRefine((r, c) => {
    if (r.score !== null) {
      if (r.scorerInput === undefined)
        c.addIssue({ code: 'custom', message: 'Numerical review requires deterministic scorer input' })
      else
        try {
          const calculated = calculateRubricScore(
            r.scorerInput.contributions,
            r.scorerInput.facts,
            r.scorerInput.sameFactGroups,
            r.scorerInput.mainline,
          )
          if (calculated.S !== r.score || calculated.J !== r.J || calculated.mainId !== r.mainId)
            c.addIssue({ code: 'custom', message: 'Review numbers differ from deterministic scorer' })
        } catch (error) {
          c.addIssue({ code: 'custom', message: error instanceof Error ? error.message : String(error) })
        }
    }
    if ((r.status === 'insufficient') !== (r.score === null))
      c.addIssue({ code: 'custom', message: 'insufficient requires null' })
  })
export type ReviewSubmission = z.infer<typeof reviewSubmissionSchema>
export function compareReviews(input: readonly ReviewSubmission[]) {
  const rows = input.map(r => reviewSubmissionSchema.parse(r))
  const keys = new Set(
    rows.map(r => r.caseId + '|' + r.targetTaskDigest + '|' + r.comparisonPoint + '|' + r.rubricSha256),
  )
  if (keys.size > 1) throw new Error('Cannot compare different tasks, dates, cases or rubric versions')
  if (new Set(rows.map(r => r.reviewer.id)).size !== rows.length) throw new Error('Duplicate reviewer identity')
  const pairs = []
  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i],
        b = rows[j]
      pairs.push({
        reviewers: [a.reviewer.id, b.reviewer.id],
        statusAgreement: a.status === b.status,
        categoryAgreement:
          JSON.stringify(Object.entries(a.categories).sort()) === JSON.stringify(Object.entries(b.categories).sort()),
        mainAgreement: a.mainId === b.mainId,
        adaptationAgreement: JSON.stringify(Object.entries(a.R).sort()) === JSON.stringify(Object.entries(b.R).sort()),
        independenceAgreement: a.J === b.J,
        absoluteScoreDifference: a.score === null || b.score === null ? null : Math.abs(a.score - b.score),
        disagreements: [...a.disagreements, ...b.disagreements],
      })
    }
  const experts = rows.filter(r => r.reviewer.kind === 'human-domain-expert')
  return {
    pairs,
    independentExpertReviewCount: experts.length,
    expertCalibrationComplete: false,
    readiness:
      experts.length >= 3
        ? 'Eligible for documented expert reconciliation; pairwise agreement alone is not calibration'
        : 'Awaiting at least three attributable independent domain experts for this target domain',
    limitations:
      'Reviewer declarations require external verification. Multiple model outputs never count as independent expert calibration.',
  }
}

import { z } from 'zod'

/** Reviewer identity/provenance is mandatory; independent expertise is never inferred from model count. */
export const reviewerSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(['human-domain-expert', 'human-reviewer', 'model', 'engineering-fixture']),
  affiliation: z.string().min(1),
  expertise: z.string().min(1),
  independenceDeclaration: z.string().min(1),
})

/**
 * A review records evidence and reviewer provenance. Numeric fields are optional
 * compatibility fields for historical records and are intentionally not
 * calculated, validated against a scorer, or used for readiness decisions.
 */
export const reviewSubmissionSchema = z.object({
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
  // Historical fields remain readable but are not produced or used by the workflow.
  score: z.number().min(0).max(10).multipleOf(0.5).nullable().optional(),
  scorerInput: z.unknown().optional(),
  mainId: z.string().nullable().optional(),
  categories: z.record(z.string(), z.string().nullable()).optional(),
  R: z.record(z.string(), z.number()).optional(),
  J: z.number().min(0).max(1).optional(),
  disagreements: z.array(
    z.object({
      axis: z.enum(['retrieval-evidence', 'classification', 'contribution-independence', 'legacy-system']),
      reason: z.string().min(1),
      evidence: z.array(z.string()),
    }),
  ),
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
      const a = rows[i], b = rows[j]
      pairs.push({
        reviewers: [a.reviewer.id, b.reviewer.id],
        statusAgreement: a.status === b.status,
        categoryAgreement: JSON.stringify(Object.entries(a.categories ?? {}).sort()) === JSON.stringify(Object.entries(b.categories ?? {}).sort()),
        mainAgreement: a.mainId === b.mainId,
        adaptationAgreement: null,
        independenceAgreement: a.reviewer.independenceDeclaration === b.reviewer.independenceDeclaration,
        // Numeric fields are historical compatibility data and never enter review comparison.
        absoluteScoreDifference: null,
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


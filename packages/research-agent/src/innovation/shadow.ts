/** Independent, optional audit stream. It never participates in research v1 DAG commits. */
import { z } from 'zod'
import { rubricAssessmentSchema } from './schema.ts'
import type { RubricAssessment } from './schema.ts'
import type { ResearchInnovationEvaluation } from '../types.ts'
export const shadowPolicySchema = z.object({
  enabled: z.boolean().default(true),
  maxMilliseconds: z.number().int().min(1).max(300000).default(90000),
  maxCandidates: z.number().int().min(0).max(10).default(3),
  maxModelCalls: z.number().int().min(0).max(500).default(60),
  maxNetworkOperations: z.number().int().min(0).max(200).default(30),
  maxPromptCharacters: z.number().int().min(0).max(10000000).default(2000000),
  maxOcrPages: z.number().int().min(0).max(20).default(0),
})
export type ShadowPolicy = z.infer<typeof shadowPolicySchema>
export const shadowAuditSchema = z
  .object({
    id: z.string(),
    hostRunId: z.string(),
    sessionId: z.string(),
    sourceRevision: z.number().int(),
    nodeId: z.string(),
    branchId: z.string(),
    attempt: z.number().int(),
    candidate: z.string().nullable(),
    candidateSha256: z.string().nullable(),
    startedAt: z.string(),
    updatedAt: z.string(),
    legacy: z.object({
      status: z.enum(['pending', 'pass', 'reject', 'error']),
      evaluation: z
        .object({ score: z.number(), threshold: z.number(), overlap: z.boolean(), rationale: z.string() })
        .optional(),
      reason: z.string(),
    }),
    lifecycle: z.enum([
      'waiting-legacy',
      'running',
      'complete',
      'provisional',
      'insufficient',
      'disabled',
      'budget-exhausted',
      'cancelled',
      'legacy-error',
      'interrupted',
    ]),
    assessment: rubricAssessmentSchema.optional(),
    policy: shadowPolicySchema,
    usage: z.object({
      modelCalls: z.number().int(),
      networkOperations: z.number().int(),
      promptCharacters: z.number().int(),
      ocrPages: z.number().int(),
      milliseconds: z.number(),
    }),
    disagreements: z.array(
      z.object({
        kind: z.enum(['retrieval-evidence', 'classification', 'contribution-independence', 'legacy-system']),
        reason: z.string(),
      }),
    ),
    reason: z.string(),
  })
  .superRefine((a, c) => {
    if (
      !['complete', 'provisional', 'insufficient', 'budget-exhausted', 'cancelled', 'interrupted'].includes(
        a.lifecycle,
      ) &&
      a.assessment !== undefined
    )
      c.addIssue({ code: 'custom', message: 'Lifecycle does not support an assessment' })
    if (['budget-exhausted', 'cancelled', 'interrupted'].includes(a.lifecycle) && a.assessment?.score.S != null)
      c.addIssue({ code: 'custom', message: 'Unfinished shadow work must not retain a numerical score' })
    if (
      ['complete', 'provisional', 'insufficient'].includes(a.lifecycle) &&
      a.assessment?.assessmentStatus !== a.lifecycle
    )
      c.addIssue({ code: 'custom', message: 'Audit status must match the actual assessment' })
  })
export type ShadowAudit = z.infer<typeof shadowAuditSchema>
export function shadowDisagreements(
  legacy: ResearchInnovationEvaluation | undefined,
  assessment: RubricAssessment | undefined,
): ShadowAudit['disagreements'] {
  const result: ShadowAudit['disagreements'] = [
    {
      kind: 'legacy-system',
      reason:
        '旧0–100分/overlap和Rubric原创性0–10分采用不同判据，不能换算门槛。' + (legacy?.rationale ?? '旧评价尚未完成。'),
    },
  ]
  if (assessment?.score.S === null)
    result.push({
      kind: 'retrieval-evidence',
      reason: assessment.uncertainties.join('；') || '关键原文或三轮反证尚未完成',
    })
  if (assessment && assessment.contributions.length > 0)
    result.push({
      kind: 'classification',
      reason: assessment.contributions
        .map(c => c.id + ':' + (c.category ?? c.eligibility) + ' ' + c.validityReview)
        .join('；'),
    })
  if (assessment && assessment.sameFactGroups.length > 0)
    result.push({
      kind: 'contribution-independence',
      reason: '去重事实组：' + JSON.stringify(assessment.sameFactGroups),
    })
  return result
}
/** Aggregate budget across all attempted candidates in one legacy checkpoint. */
export class ShadowBudget {
  readonly policy: ShadowPolicy
  readonly usage = { modelCalls: 0, networkOperations: 0, promptCharacters: 0, ocrPages: 0, milliseconds: 0 }
  exhausted: string | undefined
  private started = 0
  private deadline: ReturnType<typeof setTimeout> | undefined
  private controller: AbortController | undefined
  constructor(policy: Partial<ShadowPolicy> = {}) {
    this.policy = shadowPolicySchema.parse(policy)
  }
  begin(parent?: AbortSignal): AbortSignal {
    const remaining = this.policy.maxMilliseconds - this.usage.milliseconds
    if (remaining <= 0) this.fail('Shadow elapsed-time budget exhausted')
    this.started = Date.now()
    this.controller = new AbortController()
    this.deadline = setTimeout(() => {
      this.exhausted = 'Shadow elapsed-time budget exhausted'
      this.controller?.abort(new Error(this.exhausted))
    }, remaining)
    return parent === undefined ? this.controller.signal : AbortSignal.any([parent, this.controller.signal])
  }
  end(): void {
    if (this.deadline) clearTimeout(this.deadline)
    if (this.started) {
      this.usage.milliseconds += Date.now() - this.started
      this.started = 0
    }
  }
  private fail(reason: string): never {
    this.exhausted = reason
    throw new Error(reason)
  }
  model(prompt: string, ocrPages = 0): void {
    if (this.usage.modelCalls + Math.max(1, ocrPages) > this.policy.maxModelCalls)
      this.fail('Shadow model-call budget exhausted')
    if (this.usage.promptCharacters + prompt.length > this.policy.maxPromptCharacters)
      this.fail('Shadow prompt-character budget exhausted')
    if (this.usage.ocrPages + ocrPages > this.policy.maxOcrPages)
      this.fail('Shadow OCR disabled or page budget exhausted')
    this.usage.modelCalls += Math.max(1, ocrPages)
    this.usage.promptCharacters += prompt.length
    this.usage.ocrPages += ocrPages
  }
  network(): void {
    if (this.usage.networkOperations >= this.policy.maxNetworkOperations) this.fail('Shadow network budget exhausted')
    this.usage.networkOperations++
  }
}

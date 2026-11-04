/** Rubric execution v1: separate from research v1 and research_review. */
import { z } from 'zod'
import { setTimeout as delay } from 'node:timers/promises'
import { textDigest } from './documents.ts'
import { abortable } from '../workflows/review-checkpoints.ts'
import type { RubricAssessment } from './schema.ts'
export const RUBRIC_EXECUTION_VERSION = 'rubric-execution-2'
export class CheckpointPersistenceError extends Error {}
const stepSchema = z.object({
  key: z.string(), name: z.string(), kind: z.enum(['model', 'search', 'read']), inputSha256: z.string(),
  status: z.enum(['running', 'succeeded', 'failed', 'cancelled']), input: z.string(), output: z.string().optional(),
  rawOutput: z.string().optional(), outputSha256: z.string().optional(), startedAt: z.number(), endedAt: z.number().optional(),
  milliseconds: z.number().optional(), error: z.string().optional(), attempts: z.number(), reuses: z.number(),
  inputTokens: z.number().nullable().default(null), outputTokens: z.number().nullable().default(null),
  validationFailed: z.boolean().optional(),
})
export const rubricCheckpointSchema = z.object({
  version: z.literal(1), id: z.string(), identity: z.string(), rubricVersion: z.string(), rubricSha256: z.string(),
  targetTaskSha256: z.string(), candidateSha256: z.string(), papersSha256: z.string(), modelIdentity: z.string(),
  sourceRevision: z.string(), researchRevision: z.number(), executionVersion: z.string(), comparisonDate: z.string(),
  status: z.enum(['running', 'complete', 'provisional', 'insufficient', 'interrupted', 'budget-exhausted', 'cancelled']),
  currentStage: z.string(), nextResume: z.string(), updatedAt: z.number(), resumeCount: z.number(),
  steps: z.record(z.string(), stepSchema), events: z.array(z.object({ at: z.number(), stage: z.string(), reason: z.string() })),
  history: z.array(stepSchema).default([]),
  budgetRuns: z.array(z.object({ resumeCount: z.number(), at: z.number(), status: z.string(),
    usage: z.record(z.string(), z.number()) })).default([]),
  assessment: z.string().optional(), usage: z.record(z.string(), z.number()),
  materials: z.string(),
  duplicateBillingPossible: z.literal(true),
})
export type RubricCheckpoint = z.infer<typeof rubricCheckpointSchema>
export interface RubricCheckpointStore {
  get(id: string): Promise<RubricCheckpoint | undefined>
  put(row: RubricCheckpoint): Promise<void>
  /** Must exclude concurrent owners of the same assessment; crash residue must fail closed. */
  acquire(id: string): Promise<() => Promise<void>>
}
export class MemoryRubricCheckpointStore implements RubricCheckpointStore {
  readonly rows = new Map<string, RubricCheckpoint>()
  private readonly owners = new Set<string>()
  get(id: string): Promise<RubricCheckpoint | undefined> { return Promise.resolve(structuredClone(this.rows.get(id))) }
  put(row: RubricCheckpoint): Promise<void> {
    this.rows.set(row.id, structuredClone(rubricCheckpointSchema.parse(row)))
    return Promise.resolve()
  }
  acquire(id: string): Promise<() => Promise<void>> {
    if (this.owners.has(id))
      throw new Error('Rubric assessment already running: ' + id)
    this.owners.add(id)
    return Promise.resolve(() => { this.owners.delete(id); return Promise.resolve() })
  }
}
export interface RubricExecutionOptions {
  store: RubricCheckpointStore
  assessmentId?: string
  modelIdentity: string
  sourceRevision: string
  researchRevision?: number
  rubricVersion?: string
  rubricSha256?: string
  maxStageMilliseconds?: number
  searchTtlMs?: number
  readTtlMs?: number
  usage?: () => Record<string, number>
  onEvent?: (event: {
    name: string
    kind: string
    reused: boolean
    milliseconds: number
    inputCharacters: number
    outputCharacters: number
  }) => void
}
export class RubricExecution {
  private cursor = 0
  private release: (() => Promise<void>) | undefined
  private constructor(readonly row: RubricCheckpoint, readonly options: RubricExecutionOptions) { }
  static async open(input: {
    target: unknown
    candidate: string
    papers: unknown
    materials: string
    rubricSha256: string
    comparisonDate: string
  }, options: RubricExecutionOptions): Promise<RubricExecution> {
    if (!options.modelIdentity.trim() || !options.sourceRevision.trim())
      throw new Error('Rubric model/source revision required')
    const identity = JSON.stringify({ target: input.target, candidate: input.candidate, papers: input.papers,
      rubricSha256: options.rubricSha256 ?? input.rubricSha256, rubricVersion: options.rubricVersion ?? '1.7.0',
      modelIdentity: options.modelIdentity, sourceRevision: options.sourceRevision, execution: RUBRIC_EXECUTION_VERSION,
      researchRevision: options.researchRevision ?? 0, comparisonDate: input.comparisonDate })
    const id = options.assessmentId ?? textDigest(identity)
    const release = await options.store.acquire(id)
    try {
      const readStarted = Date.now()
      const loaded = await options.store.get(id)
      const saved = loaded ? rubricCheckpointSchema.parse(loaded) : undefined
      const readMilliseconds = Date.now() - readStarted
      if (saved && rubricCheckpointSchema.parse(saved).identity !== identity)
        throw new Error('Rubric checkpoint input/version/model/source identity mismatch')
      const row: RubricCheckpoint = saved ?? { version: 1, id, identity,
        rubricVersion: options.rubricVersion ?? '1.7.0', rubricSha256: options.rubricSha256 ?? input.rubricSha256,
        targetTaskSha256: textDigest(JSON.stringify(input.target)), candidateSha256: textDigest(input.candidate),
        papersSha256: textDigest(JSON.stringify(input.papers)), modelIdentity: options.modelIdentity,
        sourceRevision: options.sourceRevision,
        researchRevision: options.researchRevision ?? 0, executionVersion: RUBRIC_EXECUTION_VERSION, comparisonDate: input.comparisonDate,
        status: 'running', currentStage: 'start', nextResume: 'start', updatedAt: Date.now(), resumeCount: -1,
        steps: {}, history: [], budgetRuns: [], events: [], usage: {}, materials: input.materials, duplicateBillingPossible: true }
      if (saved && !row.budgetRuns.some(run => run.resumeCount === row.resumeCount))
        row.budgetRuns.push({ resumeCount: row.resumeCount, at: Date.now(), status: 'interrupted',
          usage: Object.fromEntries(Object.entries(row.usage).filter(([key]) => key.startsWith('currentBudget_')).map(([key, value]) => [key.slice(14), value])) })
      row.resumeCount++
      row.usage.storageReadMilliseconds = (row.usage.storageReadMilliseconds || 0) + readMilliseconds
      row.status = 'running'
      // A crash after provider acceptance and before durable success may charge twice on explicit resume.
      for (const s of Object.values(row.steps))
        if (s.status === 'running') {
          s.status = 'failed'
          s.error = 'Interrupted before durable success; possible duplicate billing on resume'
        }
      const execution = new RubricExecution(row, options)
      execution.release = release
      await execution.save()
      return execution
    }
    catch (error) {
      await release()
      throw error
    }
  }
  private async save(): Promise<void> {
    this.row.updatedAt = Date.now()
    this.row.usage = Object.fromEntries(Object.entries(this.row.usage).filter(([key]) => !key.startsWith('currentBudget_')))
    for (const [key, value] of Object.entries(this.options.usage?.() ?? {}))
      this.row.usage['currentBudget_' + key] = value
    const start = Date.now()
    for (let attempt = 0; ; attempt++) {
      try { await this.options.store.put(this.row); break }
      catch (error) {
        // Windows scanners/readers can briefly deny an otherwise valid atomic rename.
        // Retry only this local persistence operation, never the model or network request.
        if (attempt >= 3 || !/\b(?:EPERM|EACCES|EBUSY)\b.*\brename\b/isu.test(String(error)))
          throw new CheckpointPersistenceError('Rubric 检查点保存失败：' + String(error), { cause: error })
        await delay([50, 150, 400][attempt])
      }
    }
    this.row.usage.storageWriteMilliseconds = (this.row.usage.storageWriteMilliseconds || 0) + Date.now() - start
  }
  async run<T>(kind: 'model' | 'search' | 'read', name: string, input: string, work: (signal?: AbortSignal) => Promise<unknown>, validate: (output: unknown) => T, signal?: AbortSignal, reusable: (value: T) => boolean = () => true): Promise<T> {
    signal?.throwIfAborted()
    const key = String(this.cursor++) + ':' + name, inputSha256 = textDigest(input)
    this.row.currentStage = key
    this.row.nextResume = key
    const prior = Object.hasOwn(this.row.steps, key) ? this.row.steps[key] : undefined
    const repairKey = String(this.cursor) + ':' + name + '-format-repair'
    const repaired = Object.hasOwn(this.row.steps, repairKey) ? this.row.steps[repairKey] : undefined
    if (kind === 'model' && prior?.status === 'failed' && prior.validationFailed &&
      prior.inputSha256 === inputSha256 && prior.rawOutput !== undefined && repaired?.status === 'succeeded') {
      // Replay the same validation failure to reach the durable repair at the same cursor.
      // The repair's own input hash, output hash and validation are still checked by run().
      let validationError: Error | undefined
      try { validate(JSON.parse(prior.rawOutput)) }
      catch (error) { validationError = error instanceof Error ? error : new Error(String(error)) }
      if (validationError !== undefined) {
        prior.reuses++
        this.row.usage.replayedValidationFailures = (this.row.usage.replayedValidationFailures || 0) + 1
        await this.save()
        throw validationError
      }
    }
    const ttl = kind === 'search' ? (this.options.searchTtlMs ?? 15 * 60000) : kind === 'read' ? (this.options.readTtlMs ?? 24 * 3600000) : Infinity
    if (prior?.status === 'succeeded' && prior.inputSha256 === inputSha256 && prior.output &&
      textDigest(prior.output) === prior.outputSha256 && Date.now() - (prior.endedAt ?? 0) < ttl) {
      const value = validate(JSON.parse(prior.output))
      if (reusable(value)) {
        prior.reuses++
        this.row.usage.reusedSteps = (this.row.usage.reusedSteps || 0) + 1
        await this.save()
        this.options.onEvent?.({ name, kind, reused: true, milliseconds: 0, inputCharacters: input.length,
          outputCharacters: prior.output.length })
        return value
      }
    }
    if (prior) this.row.history.push(structuredClone(prior))
    const step: z.infer<typeof stepSchema> = { key, name, kind, inputSha256, input, status: 'running',
      startedAt: Date.now(), attempts: (prior?.attempts || 0) + 1, reuses: prior?.reuses ?? 0, inputTokens: null, outputTokens: null }
    this.row.steps[key] = step
    if (kind === 'model') {
      this.row.usage.modelStageAttempts = (this.row.usage.modelStageAttempts || 0) + 1
      this.row.usage.promptCharacters = (this.row.usage.promptCharacters || 0) + input.length
    }
    await this.save() // Refuse the external call if the running record cannot be saved.
    step.startedAt = Date.now()
    const deadline = AbortSignal.timeout(this.options.maxStageMilliseconds ?? 60000)
    const bounded = signal ? AbortSignal.any([signal, deadline]) : deadline
    try {
      const raw = await abortable(Promise.resolve().then(() => work(bounded)), bounded)
      bounded.throwIfAborted()
      step.rawOutput = JSON.stringify(raw)
      let value: T
      try { value = validate(raw) }
      catch (error) { step.validationFailed = true; throw error }
      bounded.throwIfAborted()
      step.output = JSON.stringify(value)
      step.outputSha256 = textDigest(step.output)
      step.status = 'succeeded'
      step.endedAt = Date.now()
      step.milliseconds = step.endedAt - step.startedAt
      this.row.nextResume = 'after ' + key
      this.row.usage[kind + 'Milliseconds'] = (this.row.usage[kind + 'Milliseconds'] || 0) + step.milliseconds
      await this.save()
      this.options.onEvent?.({ name, kind, reused: false, milliseconds: step.milliseconds,
        inputCharacters: input.length, outputCharacters: step.output.length })
      return value
    }
    catch (error) {
      step.status = signal?.aborted ? 'cancelled' : 'failed'
      step.error = String(error)
      delete step.output
      delete step.outputSha256
      step.endedAt = Date.now()
      step.milliseconds = step.endedAt - step.startedAt
      this.row.usage[kind + 'Milliseconds'] = (this.row.usage[kind + 'Milliseconds'] || 0) + step.milliseconds
      this.row.events.push({ at: Date.now(), stage: key, reason: String(error) })
      await this.save()
      throw error
    }
  }
  async finish(assessment: RubricAssessment, status: RubricCheckpoint['status'] = assessment.assessmentStatus, reason?: string): Promise<void> {
    this.row.status = status
    this.row.assessment = JSON.stringify(assessment)
    this.row.budgetRuns.push({ resumeCount: this.row.resumeCount, at: Date.now(), status, usage: this.options.usage?.() ?? {} })
    if (reason)
      this.row.events.push({ at: Date.now(), stage: this.row.currentStage, reason })
    await this.save()
  }
  recordTokens(inputTokens: number | null, outputTokens: number | null, rawOutput?: string): void {
    const step = Object.hasOwn(this.row.steps, this.row.currentStage) ? this.row.steps[this.row.currentStage] : undefined
    if (!step || step.kind !== 'model' || step.status !== 'running') throw new Error('Model usage outside active model stage')
    step.inputTokens = inputTokens
    step.outputTokens = outputTokens
    if (rawOutput !== undefined) step.rawOutput = rawOutput
    if (inputTokens !== null) this.row.usage.reportedInputTokens = (this.row.usage.reportedInputTokens || 0) + inputTokens
    if (outputTokens !== null) this.row.usage.reportedOutputTokens = (this.row.usage.reportedOutputTokens || 0) + outputTokens
  }
  /** Semantic gates run after schema validation; failed gates cannot become reusable success. */
  invalidateCurrentModel(reason: string): void {
    const step = Object.hasOwn(this.row.steps, this.row.currentStage) ? this.row.steps[this.row.currentStage] : undefined
    if (step?.kind === 'model' && step.status === 'succeeded') {
      step.status = 'failed'
      step.error = reason
      delete step.output
      delete step.outputSha256
    }
  }
  async close(): Promise<void> { await this.release?.(); this.release = undefined }
}

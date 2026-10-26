/** Host Remote owner for the confirmed, Session-scoped automatic research workflow. */

import type { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-api-session-controller'
import type { FileAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { SessionId } from '@deepseek-ai/dsh-session'
import { isAbsolute, join, normalize, sep } from 'node:path'
import { FsError, type FileSystem, type FsTarget } from '@deepseek-ai/dsh-fs'
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox'
import type {} from '@deepseek-ai/dsh-sandbox-policy'
import { JsonStorageBackend } from '@deepseek-ai/dsh-storage-json'
import { defineDomain, domainTable, DomainFacility, type Domain } from '@deepseek-ai/dsh-storage-domain'
import { createHostResearchCoordinator, type ResearchAdvanceResult } from './workflows/index.ts'
import {
  addResearchFeedback,
  confirmResearchNode,
  continueFromResearchNode,
  createResearchState,
  rejectIdea,
  selectResearchBranch,
  selectResearchNode,
  setResearchReviewerRoles,
  setResearchDirectionWeights,
  setResearchDirectionFocuses,
  setResearchLiteratureSources,
  markResearchSessionBoundary,
  researchSourceSessionId,
} from './workflows/index.ts'
import type {
  ResearchArtifact,
  ResearchBranch,
  ResearchLiteratureSourceId,
  ResearchMemorySnapshot,
  ResearchNode,
  ResearchState,
} from './types.ts'
import z from '@deepseek-ai/schemastery'
import { Remote, RemoteError, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import { z as zod } from 'zod'
import type {
  ResearchCommandValue,
  ResearchConfirmRequest,
  ResearchContinueRequest,
  ResearchFeedbackRequest,
  ResearchReadRequest,
  ResearchRejectRequest,
  ResearchRestoreRequest,
  ResearchSelectBranchRequest,
  ResearchSelectNodeRequest,
  ResearchSnapshot,
  ResearchUploadRequest,
} from './types.ts'

export type * from './types.ts'

declare module '@deepseek-ai/cordis' {
  interface Context {
    /** Session-scoped automatic research Remote owner. */
    researchController: ResearchController
  }
}

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    /** Browser state was based on an older durable research revision. */
    'research/stale': { readonly expected: number; readonly actual: number }
    /** A historical node must be continued into a new branch before mutation. */
    'research/history': { readonly nodeId: string; readonly branchId: string }
    /** The selected Session does not exist or cannot be resumed. */
    'research/session-not-found': { readonly sessionId: SessionId }
  }
}

const researchStage = zod.enum([
  'paper-upload', 'paper-read', 'problem-summary', 'literature-search',
  'idea-generation', 'idea-refinement', 'targeted-literature-search', 'multi-agent-review',
  'simulation-or-final-plan', 'final-plan',
])
const researchStatus = zod.enum(['pending', 'active', 'awaiting-confirmation', 'confirmed', 'rejected', 'completed'])
const researchKind = zod.enum(['paper', 'summary', 'problem', 'literature', 'idea', 'review', 'simulation', 'plan', 'decision'])
const researchLiteratureSourceInput = zod.enum(['web', 'arxiv', 'openreview', 'semantic-scholar', 'acl-anthology', 'openalex'])
const researchDirectionFocus = zod.enum(['method', 'data', 'theory', 'efficiency', 'application'])
const researchLiteratureSourceConfig = z.union(['arxiv', 'openreview', 'semantic-scholar', 'acl-anthology', 'openalex'] as const)
const researchDirectionWeights = zod.object({
  novelty: zod.number().int().min(0).max(100),
  impact: zod.number().int().min(0).max(100),
  feasibility: zod.number().int().min(0).max(100),
  reproducibility: zod.number().int().min(0).max(100),
})
const researchInnovationEvaluation = zod.object({
  score: zod.number().min(0).max(100), threshold: zod.number().min(0).max(100),
  overlap: zod.boolean(), rationale: zod.string(),
})
const researchArtifactInput = zod.object({
  artifactId: zod.string(), kind: researchKind, title: zod.string(), content: zod.string(),
  source: zod.string().optional(), evaluation: researchInnovationEvaluation.optional(), createdAt: zod.number(),
})
const researchArtifact = researchArtifactInput.transform((artifact): ResearchArtifact => ({
  artifactId: artifact.artifactId,
  kind: artifact.kind,
  title: artifact.title,
  content: artifact.content,
  ...(artifact.source === undefined ? {} : { source: artifact.source }),
  ...(artifact.evaluation === undefined ? {} : { evaluation: artifact.evaluation }),
  createdAt: artifact.createdAt,
}))
const researchMemoryInput = zod.object({
  artifactIds: zod.array(zod.string()), feedback: zod.array(zod.string()), reviewerRoles: zod.array(zod.string()),
  directionWeights: researchDirectionWeights.optional(), literatureSources: zod.array(researchLiteratureSourceInput).optional(),
  directionFocuses: zod.array(researchDirectionFocus).optional(),
})
const researchMemory = researchMemoryInput.transform((memory): ResearchMemorySnapshot => {
  // `web` was accepted by the first released research snapshot. Treat that
  // legacy value as the new explicit-index defaults so it can never invoke
  // the removed native Web Search operation after a Session is reopened.
  const literatureSources = memory.literatureSources?.filter((source): source is ResearchLiteratureSourceId => source !== 'web')
  return {
    artifactIds: memory.artifactIds,
    feedback: memory.feedback,
    reviewerRoles: memory.reviewerRoles,
    directionWeights: memory.directionWeights ?? { novelty: 30, impact: 25, feasibility: 25, reproducibility: 20 },
    literatureSources: literatureSources === undefined || literatureSources.length === 0
      ? ['arxiv', 'openreview', 'semantic-scholar', 'acl-anthology', 'openalex']
      : literatureSources,
    directionFocuses: memory.directionFocuses ?? ['method', 'data', 'theory', 'efficiency', 'application'],
  }
})
const researchNodeInput = zod.object({
  nodeId: zod.string(), parentNodeId: zod.string().optional(), branchId: zod.string(),
  stage: researchStage, status: researchStatus, artifactRefs: zod.array(zod.string()),
  sessionSeq: zod.number().int().nonnegative().optional(), sourceSessionId: zod.string().optional(),
  userDecision: zod.enum(['confirm', 'reject', 'feedback']).optional(), memorySnapshot: researchMemory,
  userNote: zod.string().optional(),
})
const researchNode = researchNodeInput.transform((node): ResearchNode => ({
  nodeId: node.nodeId,
  ...(node.parentNodeId === undefined ? {} : { parentNodeId: node.parentNodeId }),
  branchId: node.branchId,
  stage: node.stage,
  status: node.status,
  artifactRefs: node.artifactRefs,
  ...(node.sessionSeq === undefined ? {} : { sessionSeq: node.sessionSeq }),
  ...(node.sourceSessionId === undefined ? {} : { sourceSessionId: SessionId(node.sourceSessionId) }),
  memorySnapshot: node.memorySnapshot,
  ...(node.userDecision === undefined ? {} : { userDecision: node.userDecision }),
  ...(node.userNote === undefined ? {} : { userNote: node.userNote }),
}))
const researchBranchInput = zod.object({
  branchId: zod.string(), label: zod.string(), forkNodeId: zod.string().optional(), nodeIds: zod.array(zod.string()),
})
const researchBranch = researchBranchInput.transform((branch): ResearchBranch => ({
  branchId: branch.branchId,
  label: branch.label,
  ...(branch.forkNodeId === undefined ? {} : { forkNodeId: branch.forkNodeId }),
  nodeIds: branch.nodeIds,
}))
const researchStateInput = zod.object({
  nodes: zod.record(zod.string(), researchNode), branches: zod.record(zod.string(), researchBranch),
  artifacts: zod.record(zod.string(), researchArtifact), selectedNodeId: zod.string(), activeBranchId: zod.string(),
  nextNodeNumber: zod.number().int().nonnegative(), nextBranchNumber: zod.number().int().nonnegative(),
  nextArtifactNumber: zod.number().int().nonnegative(),
})
const researchState = researchStateInput.transform((state): ResearchState => ({
  nodes: state.nodes,
  branches: state.branches,
  artifacts: state.artifacts,
  selectedNodeId: state.selectedNodeId,
  activeBranchId: state.activeBranchId,
  nextNodeNumber: state.nextNodeNumber,
  nextBranchNumber: state.nextBranchNumber,
  nextArtifactNumber: state.nextArtifactNumber,
}))

/** Durable row keyed by Session identity; the whole immutable DAG is one record. */
const researchRecord = zod.object({
  revision: zod.number().int().nonnegative(), state: researchState, updatedAt: zod.number().int().nonnegative(),
})

/** One global domain stores all Session sidecars without opening one domain per Session. */
export const researchDomain = defineDomain({
  name: 'research', version: 1,
  tables: { sessions: domainTable<SessionId, ResearchRecord>(researchRecord) },
})

/** Fixed root below each Session cwd for automatic-research project files. */
const RESEARCH_PROJECT_ROOT = 'research-projects'

/** Standard DSH compositions mount the fixed numerical simulation adapter. */
const RESEARCH_SIMULATION_AVAILABLE = true

/** Validate the configured plan path before it is joined to a project root. */
function validatePlanPath(planPath: string): void {
  if (planPath.trim().length === 0 || isAbsolute(planPath)) {
    throw new TypeError('research planPath must be a non-empty relative path')
  }
  const normalized = normalize(planPath)
  if (normalized === '.' || normalized === '..' || normalized.startsWith(`..${sep}`)) {
    throw new TypeError('research planPath must stay inside the project directory')
  }
}

/** Persisted research row inferred from the durable schema. */
export type ResearchRecord = zod.infer<typeof researchRecord>

/** Host limits and provider selection for automatic research. */
export interface Config {
  /** Optional absolute directory for research.json; omission preserves the existing DSH storage route. */
  readonly dataDirectory?: string
  /** Registered subagent provider used for summarization, ideation, and review. */
  readonly subagentProvider?: string
  /** Relative output path inside the automatic-research project directory. */
  readonly planPath?: string
  /** Maximum uploaded paper bytes read into the summarizer prompt. */
  readonly maxPaperBytes?: number
  /** Maximum indexed paper sources included in one literature step. */
  readonly maxLiteratureResults?: number
  /** Literature backends enabled by default for new research Sessions. */
  readonly literatureSources?: ResearchLiteratureSourceId[]
  /** Minimum isolated expert score required before an idea is shown. */
  readonly innovationScoreThreshold?: number
  /** Maximum fresh candidates tried before reporting that all were rejected. */
  readonly maxIdeaAttempts?: number
  /** Maximum PDF pages inspected and rendered for OCR. */
  readonly maxPdfPages?: number
  /** Initial PDF rendering scale before pixel capping. */
  readonly ocrScale?: number
  /** Maximum width × height for one rendered OCR page. */
  readonly maxOcrPixels?: number
}

type ResolvedConfig = Required<Omit<Config, 'dataDirectory'>> & Pick<Config, 'dataDirectory'>

/** Host service backing `ctx.remote.research`. */
export class ResearchController extends TypertRemoteService {
  static inject = ['attachments', 'fs', 'sessionController', 'storage', 'storageDomain', 'subagents', 'typert', 'web']

  static Config: z<Config, ResolvedConfig> = z.object({
    dataDirectory: z.string(),
    subagentProvider: z.string().min(1).default('spawn'),
    planPath: z.string().default('research-plan.md'),
    maxPaperBytes: z.natural().min(1).default(20 * 1024 * 1024),
    maxLiteratureResults: z.natural().min(1).max(50).default(8),
    literatureSources: z.array(researchLiteratureSourceConfig).min(1).default(['arxiv', 'openreview', 'semantic-scholar', 'acl-anthology', 'openalex']),
    innovationScoreThreshold: z.natural().max(100).default(70),
    maxIdeaAttempts: z.natural().min(1).max(10).default(3),
    maxPdfPages: z.number().step(1).min(1).max(100).default(12),
    ocrScale: z.number().min(0.25).max(4).default(1.5),
    maxOcrPixels: z.number().step(1).min(1).max(16_000_000).default(4_000_000),
  })

  private readonly config: ResolvedConfig
  private readonly ready: Promise<Domain<typeof researchDomain>>
  private chain: Promise<unknown> = Promise.resolve()

  /**
   * @param ctx - Host services for attachments, indexed paper fetches, subagents, and Session resumption.
   * @param config - bounded research provider policy.
   */
  constructor(ctx: Context, config: Config = {}) {
    super(ctx, 'researchController', { namespace: 'research' })
    this.config = ResearchController.Config(config)
    validatePlanPath(this.config.planPath)
    if (this.config.dataDirectory !== undefined) {
      if (!isAbsolute(this.config.dataDirectory)) throw new TypeError('research dataDirectory must be absolute')
      const backend = new JsonStorageBackend(this.config.dataDirectory)
      ctx.effect(() => {
        const unregister = ctx.storage.backend.register('research-agent-data', backend)
        return async () => { unregister(); await backend.close() }
      })
      this.ready = new DomainFacility(ctx, { backend: 'research-agent-data' }).open(researchDomain)
    } else {
      this.ready = ctx.storageDomain.open(researchDomain)
    }
    ctx.effect(() => async () => { await this.chain; await (await this.ready).close() }, 'research-controller.domain')
  }

  /**
   * Read one persisted research DAG without resuming its Agent.
   * @param request - Session identity to read.
   * @returns The current durable research snapshot.
   */
  @Remote('read')
  async read(request: ResearchReadRequest): Promise<ResearchSnapshot> {
    const record = (await this.ready).table('sessions').get(request.sessionId)
    return this.snapshot(request.sessionId, record)
  }

  /**
   * Upload a paper and run the paper-reading and summarization step.
   * @param request - Session, revision, and uploaded paper reference.
   * @param signal - Cancellation signal for attachment and agent work.
   * @returns The committed snapshot and newly visible summary artifact.
   */
  @Remote('upload')
  upload(request: ResearchUploadRequest, signal: AbortSignal): Promise<ResearchCommandValue> {
    return this.serialize(() => this.advance(request.sessionId, request.expectedRevision, signal, state => ({
      state,
      ...(request.paper === undefined ? {} : { paper: request.paper }),
      ...(request.papers === undefined ? {} : { papers: request.papers }),
      ...(request.supplemental === true ? { supplemental: true } : {}),
    })))
  }

  /**
   * Confirm the current output and run exactly one next stage.
   * @param request - Session, revision, reviewer roles, and optional final choice.
   * @param signal - Cancellation signal for coordinator work.
   * @returns The committed snapshot and stage output when one is generated.
   */
  @Remote('confirm')
  confirm(request: ResearchConfirmRequest, signal: AbortSignal): Promise<ResearchCommandValue> {
    return this.serialize(() => this.advance(request.sessionId, request.expectedRevision, signal, (state) => {
      let next = state
      if (request.reviewerRoles !== undefined) next = setResearchReviewerRoles(next, request.reviewerRoles)
      if (request.directionWeights !== undefined) next = setResearchDirectionWeights(next, request.directionWeights)
      if (request.directionFocuses !== undefined) next = setResearchDirectionFocuses(next, request.directionFocuses)
      if (request.literatureSources !== undefined) next = setResearchLiteratureSources(next, request.literatureSources)
      const confirmed = confirmResearchNode(next)
      return request.finalChoice === undefined
        ? { state: confirmed }
        : { state: confirmed, finalChoice: request.finalChoice }
    }))
  }

  /**
   * Save human feedback without running a model step.
   * @param request - Session, revision, and feedback text.
   * @returns The committed snapshot containing the feedback.
   */
  @Remote('feedback')
  feedback(request: ResearchFeedbackRequest): Promise<ResearchCommandValue> {
    return this.serialize(async () => {
      const current = await this.current(request.sessionId, request.expectedRevision)
      this.requireActiveTail(current.state, request.sessionId)
      const state = addResearchFeedback(current.state, request.feedback)
      const committed = await this.commit(request.sessionId, current.revision, state)
      await this.persistProjectRecord(request.sessionId, state)
      return committed
    })
  }

  /**
   * Reject the selected idea, create an isolated branch, and generate its first idea.
   * @param request - Session, revision, and optional rejection reason.
   * @param signal - Cancellation signal for coordinator work.
   * @returns The committed snapshot and replacement idea artifact.
   */
  @Remote('reject')
  reject(request: ResearchRejectRequest, signal: AbortSignal): Promise<ResearchCommandValue> {
    return this.serialize(() => this.advance(request.sessionId, request.expectedRevision, signal, state => ({
      state: rejectIdea(state, request.reason),
    })))
  }

  /**
   * Select an existing branch without mutating its historical nodes.
   * @param request - Session, revision, and branch identity.
   * @returns The committed snapshot with the branch selected.
   */
  @Remote('selectBranch')
  selectBranch(request: ResearchSelectBranchRequest): Promise<ResearchCommandValue> {
    return this.serialize(async () => {
      const current = await this.current(request.sessionId, request.expectedRevision)
      const state = selectResearchBranch(current.state, request.branchId)
      const committed = await this.commit(request.sessionId, current.revision, state)
      await this.persistProjectRecord(request.sessionId, state)
      return committed
    })
  }

  /**
   * Select a historical node for inspection.
   * @param request - Session, revision, and node identity.
   * @returns The committed snapshot with the node selected.
   */
  @Remote('selectNode')
  selectNode(request: ResearchSelectNodeRequest): Promise<ResearchCommandValue> {
    return this.serialize(async () => {
      const current = await this.current(request.sessionId, request.expectedRevision)
      const state = selectResearchNode(current.state, request.nodeId)
      const committed = await this.commit(request.sessionId, current.revision, state)
      await this.persistProjectRecord(request.sessionId, state)
      return committed
    })
  }

  /**
   * Continue from a historical node in a new isolated branch.
   * @param request - Session, revision, and source node identity.
   * @returns The committed snapshot with the continuation selected.
   */
  @Remote('continueFromNode')
  continueFromNode(request: ResearchContinueRequest): Promise<ResearchCommandValue> {
    return this.serialize(async () => {
      const current = await this.current(request.sessionId, request.expectedRevision)
      const state = this.continueResearchNodeInCurrentSession(current.state, request.nodeId, request.sessionId)
      const committed = await this.commit(request.sessionId, current.revision, state)
      await this.persistProjectRecord(request.sessionId, state)
      return committed
    })
  }

  /**
 * Continue a displayed node inside the current Session while retaining its
 * branch memory. Nodes copied from a previously restored Session carry that
 * Session's event boundary; a same-panel continuation must bind its next
 * mutation to the current Session instead.
 * @param state - Current research DAG.
 * @param nodeId - Node selected for continuation.
 * @param sessionId - Session that will receive the continuation.
 * @returns A continuation state safe for mutation in `sessionId`.
 */
  private continueResearchNodeInCurrentSession(
    state: ResearchState,
    nodeId: string,
    sessionId: SessionId,
  ): ResearchState {
    const continued = continueFromResearchNode(state, nodeId)
    const node = continued.nodes[continued.selectedNodeId]
    if (node === undefined || node.sourceSessionId === undefined || node.sourceSessionId === sessionId) return continued
    const { sessionSeq: _sessionSeq, sourceSessionId: _sourceSessionId, ...rebound } = node
    return { ...continued, nodes: { ...continued.nodes, [node.nodeId]: rebound } }
  }

  /**
   * Restore a historical stage by forking the Session at its recorded boundary.
   * @param request - Session, revision, and historical node identity.
   * @returns The new Session snapshot with the selected historical branch.
   */
  @Remote('restore')
  restore(request: ResearchRestoreRequest): Promise<ResearchCommandValue> {
    return this.serialize(async () => {
      const current = await this.current(request.sessionId, request.expectedRevision)
      const source = current.state.nodes[request.nodeId]
      if (source === undefined) {
        throw new RemoteError('gateway/bad-request', `research node "${request.nodeId}" does not exist`, {})
      }
      const branchState = continueFromResearchNode(current.state, request.nodeId)
      if (source.sessionSeq === undefined) {
        const committed = await this.commit(request.sessionId, current.revision, branchState)
        await this.persistProjectRecord(request.sessionId, branchState)
        return committed
      }
      const sourceSessionId = researchSourceSessionId(source, request.sessionId)
      const fork = await this.ctx.sessionController.fork({
        sessionId: sourceSessionId,
        atSeq: source.sessionSeq,
      })
      const forkedState = markResearchSessionBoundary(branchState, source.sessionSeq, fork.sessionId)
      const childRevision = 1
      await (await this.ready).table('sessions').put(fork.sessionId, {
        revision: childRevision, state: forkedState, updatedAt: Date.now(),
      })
      await this.persistProjectRecord(fork.sessionId, forkedState)
      return {
        snapshot: {
          sessionId: fork.sessionId,
          revision: childRevision,
          state: forkedState,
          simulationAvailable: RESEARCH_SIMULATION_AVAILABLE,
        },
      }
    })
  }

  private async advance(
    sessionId: SessionId,
    expectedRevision: number,
    signal: AbortSignal,
    prepare: (state: ResearchState) => {
      readonly state: ResearchState
      readonly paper?: FileAttachmentRef
      readonly papers?: readonly FileAttachmentRef[]
      readonly supplemental?: boolean
      readonly finalChoice?: 'simulation' | 'plan'
    },
  ): Promise<ResearchCommandValue> {
    const current = await this.current(sessionId, expectedRevision)
    this.requireActiveTail(current.state, sessionId)
    const prepared = prepare(current.state)
    const agent = await this.agent(sessionId)
    const project = this.ensureProject(agent, sessionId)
    const planPath = project === undefined ? this.config.planPath : join(project.path, this.config.planPath)
    const fs = agent.ctx.get('fs') ?? this.ctx.fs
    const sandboxPolicy = this.resolveSandboxPolicy(agent)
    const coordinator = createHostResearchCoordinator({
      attachments: this.ctx.attachments,
      web: this.ctx.web,
      subagents: this.ctx.subagents,
      fs,
    }, {
      subagentProvider: this.config.subagentProvider,
      planPath,
      maxPaperBytes: this.config.maxPaperBytes,
      maxLiteratureResults: this.config.maxLiteratureResults,
      maxPdfPages: this.config.maxPdfPages,
      ocrScale: this.config.ocrScale,
      maxOcrPixels: this.config.maxOcrPixels,
      innovationScoreThreshold: this.config.innovationScoreThreshold,
      maxIdeaAttempts: this.config.maxIdeaAttempts,
      ...(sandboxPolicy === undefined ? {} : { sandboxPolicy }),
    })
    const result: ResearchAdvanceResult = await coordinator.advance({
      state: prepared.state,
      parent: agent,
      ...(prepared.paper === undefined ? {} : { paper: prepared.paper }),
      ...(prepared.papers === undefined ? {} : { papers: prepared.papers }),
      ...(prepared.supplemental === true
        ? { supplementalPapers: prepared.papers ?? (prepared.paper === undefined ? [] : [prepared.paper]) }
        : {}),
      ...(prepared.finalChoice === undefined ? {} : { finalChoice: prepared.finalChoice }),
      signal,
    })
    const lastEventSeq = Number(agent.session.seq) - 1
    const state = lastEventSeq < 0
      ? result.state
      : markResearchSessionBoundary(result.state, lastEventSeq, sessionId)
    const committed = await this.commit(sessionId, current.revision, state, { ...result, state })
    if (project !== undefined) {
      const papers = prepared.papers ?? (prepared.paper === undefined ? undefined : [prepared.paper])
      await this.writeProjectRecord(fs, project.path, sessionId, papers, state, sandboxPolicy)
    }
    return committed
  }

  /**
   * Resolve the stable on-disk project directory for one research Session.
   * @param agent - Session Agent whose cwd owns the project directory.
   * @param sessionId - Session identity used for the directory leaf.
   * @returns the project path, or undefined for a Session without a cwd.
   */
  private ensureProject(agent: Agent, sessionId: SessionId): { readonly path: string } | undefined {
    const cwd = agent.session.header.cwd
    if (cwd === undefined) return undefined
    const leaf = String(sessionId).replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = join(cwd, RESEARCH_PROJECT_ROOT, leaf)
    return { path }
  }

  /**
   * Persist the visible research history beside the Session workspace.
   * @param fs - Session filesystem provider.
   * @param projectPath - Fixed project directory for this research Session.
   * @param sessionId - Session identity written into the manifest.
   * @param papers - Uploaded paper references shown in the manifest.
   * @param state - Complete immutable research DAG after the step.
   */
  private async writeProjectRecord(
    fs: FileSystem,
    projectPath: string,
    sessionId: SessionId,
    papers: readonly FileAttachmentRef[] | undefined,
    state: ResearchState,
    sandboxPolicy?: SandboxExecutionPolicy,
  ): Promise<void> {
    const recordPath = await fs.resolve(join(projectPath, 'research-conversation.md'))
    const previousEntries = await this.previousPaperEntries(fs, recordPath)
    const newEntries = papers === undefined
      ? []
      : papers.map(paper => `- ${paper.name} (${paper.bytes} bytes, ${paper.attachmentId})`)
    const paperEntries = [...new Set([...previousEntries, ...newEntries])]
    const manifest = [
      '# 自动科研项目',
      '',
      `- Session: ${sessionId}`,
      `- 工作区: ${projectPath}`,
      '',
      '## 上传论文',
      '',
      ...(paperEntries.length === 0 ? ['暂无附件。'] : paperEntries),
      '',
      '## 阶段输出',
      '',
      ...Object.values(state.nodes)
        .sort((left, right) =>
          (left.sessionSeq ?? Number.MAX_SAFE_INTEGER) - (right.sessionSeq ?? Number.MAX_SAFE_INTEGER))
        .flatMap(node => node.artifactRefs
          .map(id => state.artifacts[id])
          .filter((artifact): artifact is ResearchArtifact => artifact !== undefined)
          .map(artifact => `### ${artifact.title}\n\n${artifact.content}`)),
      '',
    ].join('\n')
    await fs.writeText(recordPath, manifest, undefined, undefined, sandboxPolicy)
    const stateFile = await fs.resolve(join(projectPath, 'research-state.json'))
    await fs.writeText(stateFile, JSON.stringify(state, null, 2), undefined, undefined, sandboxPolicy)
  }

  /**
   * Keep the paper list when a later state update has no new upload payload.
   * @param fs - Session filesystem provider.
   * @param recordPath - Existing or future conversation manifest target.
   * @returns Existing paper list entries, or an empty list when no manifest exists.
   */
  private async previousPaperEntries(fs: FileSystem, recordPath: FsTarget): Promise<readonly string[]> {
    let previous: string
    try {
      previous = await fs.readText(recordPath)
    } catch (error) {
      // The first project write has no prior manifest; unrelated filesystem errors must remain visible.
      if (error instanceof FsError && error.code === 'FS_NOT_FOUND') return []
      throw error
    }
    const section = previous.split('## 上传论文', 2)[1]?.split('## 阶段输出', 2)[0]
    if (section === undefined) return []
    return section.split(/\r?\n/u).map(line => line.trim()).filter(line => line.startsWith('- '))
  }

  /**
   * Synchronize the project files after a state-only research command.
   * @param sessionId - Session whose project directory receives the record.
   * @param state - Updated immutable research DAG.
   * @param papers - New paper references, when this command uploaded papers.
   */
  private async persistProjectRecord(
    sessionId: SessionId,
    state: ResearchState,
    papers?: readonly FileAttachmentRef[],
  ): Promise<void> {
    const agent = await this.agent(sessionId)
    const project = this.ensureProject(agent, sessionId)
    if (project === undefined) return
    const fs = agent.ctx.get('fs') ?? this.ctx.fs
    const sandboxPolicy = this.resolveSandboxPolicy(agent)
    await this.writeProjectRecord(fs, project.path, sessionId, papers, state, sandboxPolicy)
  }

  private async agent(sessionId: SessionId): Promise<Agent> {
    const result = await this.ctx.sessionController.resolveAgent(sessionId)
    if ('error' in result) throw result.error
    return result.agent
  }

  /** Resolve the session policy from the Agent scope, falling back to the host scope. */
  private resolveSandboxPolicy(agent: Agent): SandboxExecutionPolicy | undefined {
    const provider = agent.ctx.get('sandboxPolicy') ?? this.ctx.get('sandboxPolicy')
    return provider?.resolve({ session: agent.session })
  }

  private async current(sessionId: SessionId, expectedRevision: number): Promise<ResearchSnapshot> {
    const snapshot = this.snapshot(sessionId, (await this.ready).table('sessions').get(sessionId))
    if (snapshot.revision !== expectedRevision) {
      throw new RemoteError('research/stale', 'Research state changed; reload this Session before retrying.', {
        expected: expectedRevision, actual: snapshot.revision,
      })
    }
    return snapshot
  }

  private requireActiveTail(state: ResearchState, sessionId: SessionId): void {
    const selected = state.nodes[state.selectedNodeId]
    if (selected?.sourceSessionId !== undefined && selected.sourceSessionId !== sessionId) {
      throw new RemoteError('research/history', 'Restore this node into its source Session before changing it.', {
        nodeId: state.selectedNodeId,
        branchId: state.activeBranchId,
      })
    }
    const branch = state.branches[state.activeBranchId]
    if (branch?.nodeIds.at(-1) !== state.selectedNodeId) {
      throw new RemoteError('research/history', 'Continue from the selected historical node before changing it.', {
        nodeId: state.selectedNodeId,
        branchId: state.activeBranchId,
      })
    }
  }

  private async commit(
    sessionId: SessionId,
    previousRevision: number,
    state: ResearchState,
    result?: ResearchAdvanceResult,
  ): Promise<ResearchCommandValue> {
    const nextRevision = previousRevision + 1
    await (await this.ready).table('sessions').put(sessionId, {
      revision: nextRevision, state, updatedAt: Date.now(),
    })
    return {
      snapshot: {
        sessionId,
        revision: nextRevision,
        state,
        simulationAvailable: RESEARCH_SIMULATION_AVAILABLE,
      },
      ...(result?.artifact === undefined ? {} : { artifact: result.artifact }),
      ...(result?.planFile === undefined ? {} : { planFile: result.planFile }),
    }
  }

  private snapshot(sessionId: SessionId, record: ResearchRecord | undefined): ResearchSnapshot {
    if (record !== undefined) {
      return {
        sessionId,
        revision: record.revision,
        state: record.state,
        simulationAvailable: RESEARCH_SIMULATION_AVAILABLE,
      }
    }
    const initial = createResearchState(Date.now())
    const state = setResearchLiteratureSources(initial, this.config.literatureSources)
    return { sessionId, revision: 0, state, simulationAvailable: RESEARCH_SIMULATION_AVAILABLE }
  }

  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const next = this.chain.then(work)
    this.chain = next.catch(() => undefined)
    return next
  }
}

export default ResearchController

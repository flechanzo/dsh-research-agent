import { startResearchRun } from './subagent-adapter.ts'
import { parentAgentOptionsForDelegation } from '@deepseek-ai/dsh-subagent'
/** Host-side execution coordinator for the human-confirmed research DAG. */

import type {} from '@deepseek-ai/dsh-api-session-controller'
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { Agent, AgentOptions } from '@deepseek-ai/dsh-agent'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import type {
  AttachmentStore,
  FileAttachmentRef,
} from '@deepseek-ai/dsh-attachment'
import { createCanvas } from '@napi-rs/canvas'
import { getDocument, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type {
  ContentBlock,
} from '@deepseek-ai/dsh-llm'
import type {
  SubagentRuntime,
} from '@deepseek-ai/dsh-subagent'
import type {
  WebRuntime,
} from '@deepseek-ai/dsh-web'
import type { FileSystem } from '@deepseek-ai/dsh-fs'
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox'
import { createNumericalResearchSimulationRunner } from './research-simulation.ts'
import {
  appendResearchOutput,
  assertInnovationClaim,
  completeResearchNode,
  markResearchPlanWritten,
  selectedResearchNode,
  setResearchReviewerRoles,
  type ResearchArtifact,
  type ResearchDirectionWeights,
  type ResearchInnovationEvaluation,
  type ResearchLiteratureSourceId,
  type ResearchStage,
  type ResearchState,
} from './research.ts'

/** A bounded, decoded representation of an uploaded paper. */
export interface ResearchPaperDocument {
  /** Sanitized display name from the durable file reference. */
  readonly fileName: string
  /** Extracted text passed to summarizer agents. */
  readonly text: string
  /** Number of bytes read from the attachment. */
  readonly byteLength: number
  /** Extraction path used for this document. */
  readonly extractionMethod: ResearchPaperExtractionMethod
  /** Total number of pages in the uploaded PDF. */
  readonly pageCount?: number
  /** Number of pages inspected; a smaller value than pageCount indicates truncation. */
  readonly processedPageCount?: number
}

/** Extraction path reported to the user and research-session log. */
export type ResearchPaperExtractionMethod = 'plain-text' | 'embedded-text' | 'ocr'

/** One rendered page supplied to an OCR adapter. */
export interface ResearchPaperOcrPage {
  /** One-based page number in the source PDF. */
  readonly pageNumber: number
  /** PNG bytes for the rendered page. */
  readonly data: Uint8Array
}

/** OCR request for a bounded set of PDF pages. */
export interface ResearchPaperOcrInput {
  /** Original uploaded filename. */
  readonly fileName: string
  /** Rendered pages in source order. */
  readonly pages: readonly ResearchPaperOcrPage[]
}

/** OCR capability used when a PDF has no usable text layer. */
export interface ResearchPaperOcr {
  /**
   * Recognize all supplied pages.
   * @param input - Bounded rendered pages and source filename.
   * @param parent - Agent that owns the visual child-agent runs.
   * @param signal - Optional cancellation signal.
   * @returns OCR text with page markers.
   */
  recognize(input: ResearchPaperOcrInput, parent: Agent, signal?: AbortSignal): Promise<string>
}

/** Reads one durable paper attachment into bounded text. */
export interface ResearchPaperReader {
  /**
   * Read and extract a paper.
   * @param paper - Durable uploaded file reference.
   * @param signal - Optional cancellation signal.
   * @param context - Parent agent used by the OCR adapter when needed.
   * @returns Extracted paper text.
   */
  read(paper: FileAttachmentRef, signal?: AbortSignal, context?: ResearchPaperReadContext): Promise<ResearchPaperDocument>
}

/** Optional execution context for a paper read. */
export interface ResearchPaperReadContext {
  /** Parent Agent for visual OCR delegation. */
  readonly parent?: Agent
}

/** Host limits and OCR adapter for PDF extraction. */
export interface ResearchPaperReaderOptions {
  /** Maximum number of PDF pages inspected and rendered. */
  readonly maxPdfPages?: number
  /** Initial PDF rendering scale before pixel capping. */
  readonly ocrScale?: number
  /** Maximum width × height for each rendered OCR page. */
  readonly maxOcrPixels?: number
  /** Optional visual OCR implementation. */
  readonly ocr?: ResearchPaperOcr
}

/** One normalized source returned by a literature provider. */
export interface ResearchLiteratureSource {
  /** Citeable URL. */
  readonly url: string
  /** Backend that returned this source. */
  readonly provider?: ResearchLiteratureSourceId
  /** Provider title when available. */
  readonly title?: string
  /** Provider snippet when available. */
  readonly snippet?: string
  /** Provider publication date when available. */
  readonly publishedAt?: string
}

/** Searches external literature sources. */
export interface ResearchLiteratureSearcher {
  /**
   * Search for papers related to a problem statement.
   * @param query - Problem-derived search query.
   * @param signal - Optional cancellation signal.
   * @param options - Optional backend selection and result limit.
   * @returns Normalized citeable sources.
   */
  search(query: string, signal?: AbortSignal, options?: ResearchLiteratureSearchOptions): Promise<readonly ResearchLiteratureSource[]>
}

/** Backend selection for one literature search. */
export interface ResearchLiteratureSearchOptions {
  /** Sources to query; omitted uses the configured default set. */
  readonly sources?: readonly ResearchLiteratureSourceId[]
  /** Maximum merged, de-duplicated sources. */
  readonly maxResults?: number
}

/** Roles used by the coordinator when delegating model work. */
export type ResearchAgentRole =
  | 'paper-summarizer'
  | 'problem-extractor'
  | 'idea-generator'
  | 'idea-refiner'
  | 'innovation-reviewer'
  | 'method-reviewer'
  | 'novelty-reviewer'
  | 'reproducibility-reviewer'

/** Runs one isolated model agent and returns its visible text. */
export interface ResearchAgentRunner {
  /**
   * Run one role with the branch memory supplied in the prompt.
   * @param role - Fixed role label used for tracing and provider policy.
   * @param prompt - Model-visible task prompt.
   * @param parent - Live parent Agent that owns the delegated child.
   * @param signal - Optional cancellation signal.
   * @returns Visible assistant text.
   */
  run(role: ResearchAgentRole, prompt: string, parent: Agent, signal?: AbortSignal): Promise<string>
}

/** Provider-independent limits for candidate scoring and retry. */
export interface ResearchInnovationPolicy {
  /** Minimum score required before a candidate is returned to the user. */
  readonly scoreThreshold?: number
  /** Maximum candidates generated for one idea checkpoint. */
  readonly maxAttempts?: number
}

/** Optional simple simulation capability selected by the user. */
export interface ResearchSimulationRunner {
  /**
   * Run a bounded simulation for a confirmed idea and review.
   * @param input - Immutable branch artifacts used by the simulation.
   * @param signal - Optional cancellation signal.
   * @returns Human-readable simulation evidence.
   */
  run(input: ResearchSimulationInput, signal?: AbortSignal): Promise<string>
}

/** Inputs supplied to a simple simulation runner. */
export interface ResearchSimulationInput {
  /** Confirmed idea artifact. */
  readonly idea: ResearchArtifact
  /** Optional review artifact. */
  readonly review?: ResearchArtifact
  /** Stable node identity for experiment provenance. */
  readonly researchNodeId?: string
  /** Branch identity for experiment provenance. */
  readonly branchId?: string
  /** Registered experiment template; omitted uses the Host numerical smoke task. */
  readonly task?: 'numerical-linear-regression'
  /** Recorded seed for reproducibility; fixed templates may not sample randomness. */
  readonly seed?: number
}

/** Final plan file produced by a writer adapter. */
export interface ResearchPlanFile {
  /** Safe display filename chosen by the writer. */
  readonly fileName: string
  /** UTF-8 Markdown file content. */
  readonly content: string
}

/** Optional durable writer for the final Markdown research plan. */
export interface ResearchPlanWriter {
  /**
   * Persist the final plan.
   * @param file - Rendered plan file.
   * @returns The persisted file descriptor.
   */
  write(file: ResearchPlanFile): Promise<ResearchPlanFile>
}

/** Capabilities required by the coordinator. */
export interface ResearchCoordinatorAdapters {
  readonly papers: ResearchPaperReader
  readonly literature: ResearchLiteratureSearcher
  readonly agents: ResearchAgentRunner
  readonly simulation?: ResearchSimulationRunner
  readonly planWriter?: ResearchPlanWriter
  /** Expert scoring policy for innovation candidates. */
  readonly innovation?: ResearchInnovationPolicy
}

/** Request for one user-confirmed coordinator step. */
export interface ResearchAdvanceRequest {
  /** Current immutable DAG snapshot. */
  readonly state: ResearchState
  /** Parent Agent that owns child-agent runs. */
  readonly parent: Agent
  /** Required for the paper-upload root step. */
  readonly paper?: FileAttachmentRef
  /** All papers selected for the initial reading checkpoint. */
  readonly papers?: readonly FileAttachmentRef[]
  /** Papers uploaded after a literature search for the current checkpoint. */
  readonly supplementalPapers?: readonly FileAttachmentRef[]
  /** Review roles selected by the user before the review step. */
  readonly reviewerRoles?: readonly string[]
  /** Direction emphasis copied into the next idea prompt. */
  readonly directionWeights?: ResearchDirectionWeights
  /** Literature backends copied into the next search prompt. */
  readonly literatureSources?: readonly ResearchLiteratureSourceId[]
  /** Required when the simulation-or-plan choice node is reached. */
  readonly finalChoice?: 'simulation' | 'plan'
  /** Optional cancellation signal. */
  readonly signal?: AbortSignal
}

/** Result of one completed coordinator step. */
export interface ResearchAdvanceResult {
  /** Updated immutable DAG state. */
  readonly state: ResearchState
  /** Newly visible output, when this step appended one. */
  readonly artifact?: ResearchArtifact
  /** Persisted final plan, when a writer was configured. */
  readonly planFile?: ResearchPlanFile
}

/**
 * Host coordinator that turns confirmed nodes into real paper, search, agent,
 * review, simulation, and plan operations. It never mutates a previous state.
 */
export class ResearchCoordinator {
  /**
   * @param adapters - Host capabilities used by each workflow stage.
   */
  constructor(private readonly adapters: ResearchCoordinatorAdapters) {}

  /**
   * Execute exactly one next stage. A node awaiting confirmation is rejected,
   * so callers must show its artifact and record the user's decision first.
   * @param request - Current branch, parent Agent, and stage options.
   * @returns The new state and the output visible to the user.
   */
  async advance(request: ResearchAdvanceRequest): Promise<ResearchAdvanceResult> {
    const signal = request.signal
    signal?.throwIfAborted()
    const state = request.state
    const node = selectedResearchNode(state)
    if (request.supplementalPapers !== undefined) {
      return this.addSupplementalLiterature(request)
    }
    if (node.status === 'awaiting-confirmation') {
      throw new Error(`research stage "${node.stage}" requires user confirmation before it can continue`)
    }
    if (node.status === 'rejected') throw new Error('rejected research nodes cannot continue')

    switch (node.stage) {
      case 'paper-upload':
        return this.readAndSummarize(request)
      case 'paper-read':
        this.requireConfirmed(node.stage, node.status)
        return this.extractProblem(request)
      case 'problem-summary':
        this.requireConfirmed(node.stage, node.status)
        return this.searchLiterature(request)
      case 'literature-search':
        this.requireConfirmed(node.stage, node.status)
        return this.generateIdea(request)
      case 'idea-generation':
        this.requireConfirmed(node.stage, node.status)
        return node.artifactRefs.length === 0 ? this.generateIdea(request) : this.refineIdea(request)
      case 'idea-refinement':
        this.requireConfirmed(node.stage, node.status)
        return node.userDecision === 'feedback' ? this.refineIdea(request) : this.searchTargetedLiterature(request)
      case 'targeted-literature-search':
        this.requireConfirmed(node.stage, node.status)
        return this.reviewIdea(request)
      case 'multi-agent-review':
        this.requireConfirmed(node.stage, node.status)
        return this.createFinalChoice(request)
      case 'simulation-or-final-plan':
        this.requireConfirmed(node.stage, node.status)
        return this.chooseSimulationOrPlan(request)
      case 'final-plan':
        this.requireConfirmed(node.stage, node.status)
        return this.writeFinalPlan(request)
      default:
        return unreachableStage(node.stage)
    }
  }

  private async addSupplementalLiterature(request: ResearchAdvanceRequest): Promise<ResearchAdvanceResult> {
    const node = selectedResearchNode(request.state)
    if (node.stage !== 'literature-search' && node.stage !== 'targeted-literature-search') {
      throw new Error('supplemental literature can only be uploaded after a literature search')
    }
    const papers = request.supplementalPapers ?? []
    if (papers.length === 0) throw new Error('at least one supplemental paper attachment is required')
    const documents: ResearchPaperDocument[] = []
    for (const paper of papers) {
      request.signal?.throwIfAborted()
      documents.push(await this.adapters.papers.read(paper, request.signal, { parent: request.parent }))
    }
    const prompt = documents.map(paper =>
      `文件：${paper.fileName}\n读取方式：${paper.extractionMethod}\n\n${paper.text}`,
    ).join('\n\n---\n\n')
    const summary = await this.adapters.agents.run(
      'paper-summarizer',
      `请用简体中文总结以下补充论文，并逐篇列出与当前研究方向相关的方法、基线、证据、限制和可借鉴之处。不要编造事实；保留论文标题、URL、公式和代码原样。\n\n${prompt}`,
      request.parent,
      request.signal,
    )
    const fileNames = documents.map(paper => paper.fileName).join(', ')
    const state = appendResearchOutput(request.state, {
      stage: node.stage,
      kind: 'literature',
      title: `补充文献调研（${String(documents.length)} 篇）`,
      content: `${documents.map(paper => `### ${paper.fileName}\n\n读取方式：${paper.extractionMethod}`).join('\n\n')}\n\n${summary}`,
      source: fileNames,
    }, Date.now())
    return this.withLatestArtifact(state)
  }

  private async readAndSummarize(request: ResearchAdvanceRequest): Promise<ResearchAdvanceResult> {
    const papers = request.papers ?? (request.paper === undefined ? [] : [request.paper])
    if (papers.length === 0) throw new Error('at least one paper attachment is required before paper reading')
    const documents: ResearchPaperDocument[] = []
    for (const paperRef of papers) {
      request.signal?.throwIfAborted()
      documents.push(await this.adapters.papers.read(paperRef, request.signal, { parent: request.parent }))
    }
    const prompt = documents.map(paper =>
      `File: ${paper.fileName}\nExtraction method: ${paper.extractionMethod}\nInspected pages: ${paper.pageCount === undefined ? 'not applicable' : `${paper.processedPageCount ?? paper.pageCount} / ${paper.pageCount}`}\n\n${paper.text}`,
    ).join('\n\n---\n\n')
    const summary = await this.adapters.agents.run(
      'paper-summarizer',
      `请始终使用简体中文回答（论文标题、URL、代码、公式和 JSON 字段名可保留原样）。阅读以下全部上传论文。请逐篇给出忠实、结构化的摘要，再比较它们的研究问题、方法、证据和局限。不要编造事实；如果使用 OCR，请标出不确定字符，不要擅自补全不可读文本。\n\n${prompt}`,
      request.parent,
      request.signal,
    )
    const fileNames = documents.map(paper => paper.fileName).join(', ')
    const state = appendResearchOutput(request.state, {
      stage: 'paper-read',
      kind: 'summary',
      title: `论文摘要（${String(documents.length)} 篇）`,
      content: `${documents.map(paper => `### ${paper.fileName}\n\n读取方式：${paper.extractionMethod}；检查页数：${paper.pageCount === undefined ? '不适用' : `${paper.processedPageCount ?? paper.pageCount} / ${paper.pageCount}（仅前者页数已检查）`}`).join('\n\n')}\n\n${summary}`,
      source: fileNames,
    }, Date.now())
    return this.withLatestArtifact(state)
  }

  private async extractProblem(request: ResearchAdvanceRequest): Promise<ResearchAdvanceResult> {
    const summary = this.latestArtifact(request.state, 'summary')
    const problem = await this.adapters.agents.run(
      'problem-extractor',
      `请用简体中文提炼摘要中的每一个彼此独立且可检验的研究问题与研究缺口；存在多个问题时必须全部保留，不能只选择一个。按优先级编号，并分别说明假设、可测失败模式、约束和可能证伪该主张的证据。最后说明问题之间的关系以及适合组合解决的部分。保持不同问题的答案分开，便于后续逐项检索和提出想法。\n\n${summary.content}`,
      request.parent,
      request.signal,
    )
    const state = appendResearchOutput(request.state, {
      stage: 'problem-summary', kind: 'problem', title: '待确认的研究问题', content: problem,
    }, Date.now())
    return this.withLatestArtifact(state)
  }

  private async searchLiterature(request: ResearchAdvanceRequest): Promise<ResearchAdvanceResult> {
    const problem = this.latestArtifact(request.state, 'problem')
    const sources = await this.adapters.literature.search(problem.content, request.signal, {
      sources: selectedResearchNode(request.state).memorySnapshot.literatureSources,
    })
    const content = sources.length === 0
      ? '未找到可引用的相关论文；请修改问题描述或检索条件后重试。'
      : sources.map((source, index) => {
        const title = source.title ?? source.url
        const detail = source.snippet === undefined ? '' : `\n${source.snippet}`
        return `${index + 1}. [${title}](${source.url})${detail}`
      }).join('\n\n')
    const state = appendResearchOutput(request.state, {
      stage: 'literature-search', kind: 'literature', title: '相关论文与证据', content,
    }, Date.now())
    return this.withLatestArtifact(state)
  }

  private async generateIdea(request: ResearchAdvanceRequest): Promise<ResearchAdvanceResult> {
    const problem = this.latestArtifact(request.state, 'problem')
    return this.generateEvaluatedIdea(request, {
      stage: 'idea-generation',
      title: '候选改进想法',
      problem: `${problem.content}\n\nUser feedback:\n${selectedResearchNode(request.state).memorySnapshot.feedback.join('\n')}`,
      literature: this.researchEvidence(request.state),
    })
  }

  private async refineIdea(request: ResearchAdvanceRequest): Promise<ResearchAdvanceResult> {
    const idea = this.latestArtifact(request.state, 'idea')
    const feedback = selectedResearchNode(request.state).memorySnapshot.feedback.join('\n') || '没有额外反馈；补齐可复现细节。'
    return this.generateEvaluatedIdea(request, {
      stage: 'idea-refinement',
      title: '根据反馈完善后的想法',
      problem: `Existing candidate:\n${idea.content}\n\nUser feedback:\n${feedback}`,
      literature: this.researchEvidence(request.state),
      refinement: true,
    })
  }

  private async generateEvaluatedIdea(
    request: ResearchAdvanceRequest,
    input: {
      readonly stage: 'idea-generation' | 'idea-refinement'
      readonly title: string
      readonly problem: string
      readonly literature: string
      readonly refinement?: boolean
    },
  ): Promise<ResearchAdvanceResult> {
    const memory = selectedResearchNode(request.state).memorySnapshot
    const policy = this.adapters.innovation ?? {}
    const threshold = policy.scoreThreshold ?? 70
    const maxAttempts = policy.maxAttempts ?? 3
    if (!Number.isInteger(threshold) || threshold < 0 || threshold > 100) throw new Error('innovation score threshold must be an integer from 0 to 100')
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1) throw new Error('innovation max attempts must be a positive integer')
    const weights = memory.directionWeights
    const focuses = memory.directionFocuses.join(', ')
    let lastFailure = ''
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const role: ResearchAgentRole = input.refinement ? 'idea-refiner' : 'idea-generator'
      const idea = await this.adapters.agents.run(
        role,
        `请用简体中文${input.refinement ? '根据反馈修改候选研究想法' : '提出一个研究改进想法'}，只能使用下面的材料。给出一个可证伪、可实现的候选方案，明确标注创新点并解释它与已有工作的差异，包含方法、基线、消融、指标和风险。本次是第 ${attempt} 个候选；如果前一个候选被否决，必须做出实质不同的方案。\n\n方向权重（不要求总和为 100）：创新性=${weights.novelty}，影响力=${weights.impact}，可行性=${weights.feasibility}，可复现性=${weights.reproducibility}。\n选择的方向侧重：${focuses}。\n\n问题或候选方案上下文：\n${input.problem}\n\n文献证据：\n${input.literature}${lastFailure.length === 0 ? '' : `\n\n上一个候选被否决的原因（不要重复）：\n${lastFailure}`}`,
        request.parent,
        request.signal,
      )
      const candidate: ResearchArtifact = {
        artifactId: `candidate-${attempt}`,
        kind: 'idea',
        title: input.title,
        content: idea,
        createdAt: Date.now(),
      }
      assertInnovationClaim(candidate)
      const candidateSources = await this.adapters.literature.search(
        `候选创新点专项查重检索 ${decodeURIComponent(encodeLiteratureQuery(idea, 800))} ${decodeURIComponent(encodeLiteratureQuery(input.problem, 250))}`,
        request.signal,
        { sources: memory.literatureSources },
      )
      const candidateEvidence = formatLiteratureSources(candidateSources)
      const evaluationText = await this.adapters.agents.run(
        'innovation-reviewer',
        `你是完全独立的创新性专家。不要推断或索取原始对话、用户反馈、隐藏状态或论文全文；只能评价下面给出的候选方案和文献证据。你必须把上传论文摘要、初始相关文献、确认方向后的针对性文献，以及本候选点专项检索到的已发表论文逐篇比较。逐项比较研究机制、核心模块、训练目标、数据与实验设置、指标和贡献声明；只要任意一篇已有论文与候选方案实质高度重合，就将 overlap 设为 true。专项检索没有返回结果时，证据不足，必须把 score 设为 0 且 overlap 设为 true，不能把“没有检索到”当作“没有重复”。只返回严格 JSON，不要 Markdown：{"score":0,"overlap":false,"rationale":"……"}。score 必须是 0 到 100 的整数；rationale 必须用简体中文。\n\n候选方案：\n${idea}\n\n上传论文摘要与当前分支全部相关文献证据：\n${input.literature}\n\n本候选点专项检索结果：\n${candidateEvidence}`,
        request.parent,
        request.signal,
      )
      const evaluation = parseInnovationEvaluation(evaluationText, threshold)
      if (candidateSources.length > 0 && evaluation.score >= threshold && !evaluation.overlap) {
        const state = appendResearchOutput(request.state, {
          stage: input.stage,
          kind: 'idea',
          title: input.title,
          content: idea,
          evaluation,
        }, Date.now())
        const latest = this.latestArtifact(state, 'idea')
        return { state, artifact: latest }
      }
      lastFailure = candidateSources.length === 0
        ? '候选点专项检索没有返回已发表论文证据，无法通过创新性查重。'
        : evaluation.rationale
        || (evaluation.overlap ? 'candidate overlaps existing literature' : `score ${evaluation.score} is below threshold ${threshold}`)
    }
    throw new Error(`INNOVATION_SCORE_BELOW_THRESHOLD: no candidate passed the ${threshold} score and overlap checks after ${maxAttempts} attempts`)
  }

  private async reviewIdea(request: ResearchAdvanceRequest): Promise<ResearchAdvanceResult> {
    let state = request.state
    if (request.reviewerRoles !== undefined) state = setResearchReviewerRoles(state, request.reviewerRoles)
    const idea = this.latestArtifact(state, 'idea')
    const evidence = this.researchEvidence(state)
    const roles = selectedResearchNode(state).memorySnapshot.reviewerRoles
    const selectedRoles = roles.length > 0 ? roles : ['method', 'novelty', 'reproducibility']
    const roleMap: Record<string, ResearchAgentRole> = {
      method: 'method-reviewer', novelty: 'novelty-reviewer', reproducibility: 'reproducibility-reviewer',
      '方法审查': 'method-reviewer', '创新性审查': 'novelty-reviewer', '可复现性审查': 'reproducibility-reviewer',
    }
    const reviews = await Promise.all(selectedRoles.map(async (label) => {
      const role = roleMap[label] ?? 'method-reviewer'
      const review = await this.adapters.agents.run(
        role,
        `请用简体中文以“${label}”审查者身份评审下面的研究想法。指出一个具体优点、一个阻塞性问题，以及一项明确的修改或测试；同时检查明确写出的创新性主张。仅根据给出的研究想法和文献证据判断，不要索取原始对话。\n\n研究想法：\n${idea.content}\n\n文献证据：\n${evidence}`,
        request.parent,
        request.signal,
      )
      return `### ${label}\n${review}`
    }))
    const stateWithReview = appendResearchOutput(state, {
      stage: 'multi-agent-review', kind: 'review', title: '多智能体协同审查', content: reviews.join('\n\n'),
    }, Date.now())
    return this.withLatestArtifact(stateWithReview)
  }

  private async searchTargetedLiterature(request: ResearchAdvanceRequest): Promise<ResearchAdvanceResult> {
    const problem = this.latestArtifact(request.state, 'problem')
    const idea = this.latestArtifact(request.state, 'idea')
    const sources = await this.adapters.literature.search(
      `请围绕已经确认的方向检索近期且直接可比较的研究，优先寻找可能挑战该创新点的方法、基线和证据，并用简体中文整理结果。\n\n研究问题：\n${problem.content}\n\n已确认方向：\n${idea.content}`,
      request.signal,
      { sources: selectedResearchNode(request.state).memorySnapshot.literatureSources },
    )
    const content = sources.length === 0
      ? '确认研究方向后的针对性检索没有找到可引用的相关论文；请回到改进想法阶段调整方向。'
      : sources.map((source, index) => {
        const title = source.title ?? source.url
        const detail = source.snippet === undefined ? '' : `\n${source.snippet}`
        return `${index + 1}. [${title}](${source.url})${detail}`
      }).join('\n\n')
    const state = appendResearchOutput(request.state, {
      stage: 'targeted-literature-search', kind: 'literature', title: '确认方向后的针对性文献调研', content,
    }, Date.now())
    return this.withLatestArtifact(state)
  }

  private async chooseSimulationOrPlan(request: ResearchAdvanceRequest): Promise<ResearchAdvanceResult> {
    const current = this.latestArtifact(request.state, 'decision')
    if (current.title !== '仿真或直接输出选择') throw new Error('simulation-or-plan stage is missing its user choice checkpoint')
    if (request.finalChoice === undefined) throw new Error('finalChoice must be selected before the simulation-or-plan stage')
    const latestNodeArtifactId = selectedResearchNode(request.state).artifactRefs.at(-1)
    const latestNodeArtifact = latestNodeArtifactId === undefined ? undefined : request.state.artifacts[latestNodeArtifactId]
    if (latestNodeArtifact?.kind === 'simulation') {
      if (request.finalChoice !== 'plan') throw new Error('a completed simulation must be confirmed before generating the final plan')
      return this.finishPlan(request)
    }
    if (request.finalChoice === 'plan') return this.finishPlan(request)
    if (this.adapters.simulation === undefined) throw new Error('simulation was selected but no simulation adapter is configured')
    const idea = this.latestArtifact(request.state, 'idea')
    const review = this.latestArtifact(request.state, 'review')
    const node = selectedResearchNode(request.state)
    const simulation = await this.adapters.simulation.run({
      idea,
      review,
      researchNodeId: node.nodeId,
      branchId: node.branchId,
      task: 'numerical-linear-regression',
      seed: 0,
    }, request.signal)
    const state = appendResearchOutput(request.state, {
      stage: 'simulation-or-final-plan', kind: 'simulation', title: '简单仿真结果', content: simulation,
    }, Date.now())
    return this.withLatestArtifact(state)
  }

  private createFinalChoice(request: ResearchAdvanceRequest): ResearchAdvanceResult {
    const state = appendResearchOutput(request.state, {
      stage: 'simulation-or-final-plan', kind: 'decision', title: '仿真或直接输出选择',
      content: '请确认是否运行简单仿真；确认后可选择运行仿真或直接生成完整科研方案。',
    }, Date.now())
    return this.withLatestArtifact(state)
  }

  private finishPlan(request: ResearchAdvanceRequest): ResearchAdvanceResult {
    const node = selectedResearchNode(request.state)
    const artifacts = node.memorySnapshot.artifactIds
      .map(artifactId => request.state.artifacts[artifactId])
      .filter((artifact): artifact is ResearchArtifact => artifact !== undefined)
    const content = renderResearchPlan(artifacts)
    const file = { fileName: 'research-plan.md', content }
    const state = appendResearchOutput(request.state, {
      stage: 'final-plan', kind: 'plan', title: '完整科研方案（待写入）', content: file.content,
    }, Date.now())
    return this.withLatestArtifact(state)
  }

  private async writeFinalPlan(request: ResearchAdvanceRequest): Promise<ResearchAdvanceResult> {
    const plan = this.latestArtifact(request.state, 'plan')
    const file = { fileName: plan.source ?? 'research-plan.md', content: plan.content }
    const planFile = this.adapters.planWriter === undefined ? file : await this.adapters.planWriter.write(file)
    const written = markResearchPlanWritten(request.state, planFile.fileName)
    const state = completeResearchNode(written)
    return { ...(this.withLatestArtifact(state)), planFile }
  }

  private latestArtifact(state: ResearchState, kind: ResearchArtifact['kind']): ResearchArtifact {
    const node = selectedResearchNode(state)
    for (const artifactId of [...node.memorySnapshot.artifactIds].reverse()) {
      const artifact = state.artifacts[artifactId]
      if (artifact?.kind === kind) return artifact
    }
    throw new Error(`research artifact of kind "${kind}" is missing from the selected branch`)
  }

  /**
   * Collect every paper summary and literature checkpoint visible in the branch.
   * @param state - Current immutable research state.
   * @returns Evidence text for the isolated innovation reviewer.
   */
  private researchEvidence(state: ResearchState): string {
    const node = selectedResearchNode(state)
    const evidence = node.memorySnapshot.artifactIds
      .map(artifactId => state.artifacts[artifactId])
      .filter((artifact): artifact is ResearchArtifact => artifact !== undefined)
      .filter(artifact => artifact.kind === 'summary' || artifact.kind === 'literature')
    if (evidence.length === 0) return '（当前分支没有可供创新性查重的上传论文摘要或文献证据。）'
    return evidence.map((artifact, index) => {
      const category = artifact.kind === 'summary' ? '上传论文摘要' : '相关文献检索结果'
      return `### 证据 ${index + 1}：${category}｜${artifact.title}\n${artifact.content}`
    }).join('\n\n---\n\n')
  }

  private withLatestArtifact(state: ResearchState): ResearchAdvanceResult {
    const node = selectedResearchNode(state)
    const artifactId = node.artifactRefs[node.artifactRefs.length - 1]
    const artifact = artifactId === undefined ? undefined : state.artifacts[artifactId]
    return artifact === undefined ? { state } : { state, artifact }
  }

  private requireConfirmed(stage: ResearchStage, status: ResearchState['nodes'][string]['status']): void {
    if (status !== 'confirmed' && status !== 'active') throw new Error(`research stage "${stage}" is not confirmed`)
  }
}

/**
 * Build a Host paper reader backed by the durable attachment service.
 * @param attachments - Durable attachment provider that owns the uploaded bytes.
 * @param maxBytes - Explicit extraction limit for one paper.
 * @param options - PDF page, raster, and OCR limits.
 * @returns A bounded paper reader adapter.
 */
export function createAttachmentPaperReader(
  attachments: AttachmentStore,
  maxBytes: number,
  options: ResearchPaperReaderOptions = {},
): ResearchPaperReader {
  const resolved = resolvePaperReaderOptions(options)
  return {
    async read(paper, signal, context) {
      const chunks: Uint8Array[] = []
      let byteLength = 0
      for await (const chunk of attachments.readFileStream(paper, signal)) {
        byteLength += chunk.byteLength
        if (byteLength > maxBytes) throw new Error(`paper exceeds the ${maxBytes} byte extraction limit`)
        chunks.push(chunk)
      }
      const bytes = new Uint8Array(byteLength)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      signal?.throwIfAborted()
      if (!isPdfUpload(bytes, paper.name)) {
        const text = new TextDecoder().decode(bytes)
        if (text.trim().length === 0) throw new Error(`paper "${paper.name}" produced no readable text`)
        return { fileName: paper.name, text, byteLength, extractionMethod: 'plain-text' }
      }

      const pdf = await openPdf(bytes, paper.name, resolved, signal)
      if (pdf.pages.length === 0) {
        return {
          fileName: paper.name,
          text: pdf.text,
          byteLength,
          extractionMethod: 'embedded-text',
          pageCount: pdf.pageCount,
          processedPageCount: pdf.processedPageCount,
        }
      }
      if (resolved.ocr === undefined) {
        throw new Error('PDF_OCR_UNAVAILABLE: this PDF has no usable text layer and no OCR adapter is configured')
      }
      if (context?.parent === undefined) {
        throw new Error('PDF_OCR_PARENT_REQUIRED: OCR requires the parent Agent used for visual delegation')
      }
      const text = await resolved.ocr.recognize(
        { fileName: paper.name, pages: pdf.pages },
        context.parent,
        signal,
      )
      const mergedText = mergePdfText(pdf.embeddedPages, text)
      if (mergedText.trim().length === 0) throw new Error(`PDF_OCR_EMPTY: OCR produced no readable text for "${paper.name}"`)
      return {
        fileName: paper.name,
        text: mergedText,
        byteLength,
        extractionMethod: 'ocr',
        pageCount: pdf.pageCount,
        processedPageCount: pdf.processedPageCount,
      }
    },
  }
}

/**
 * Build a literature search adapter backed by the configured fetch provider.
 * @param web - Configured Web runtime used only for explicit paper-index fetches.
 * @param maxResults - Explicit source limit for one search.
 * @returns A literature search adapter that fetches missing snippets.
 */
export function createWebLiteratureSearcher(web: WebRuntime, maxResults: number): ResearchLiteratureSearcher {
  return {
    async search(query, signal, options) {
      const requested = options?.sources === undefined || options.sources.length === 0
        ? ['arxiv', 'openreview', 'semantic-scholar', 'acl-anthology', 'openalex'] as const
        : options.sources
      const sources = [...new Set(requested.flatMap(source => source === 'web'
        ? ['arxiv', 'openreview', 'semantic-scholar', 'acl-anthology', 'openalex'] as const
        : [source]))]
      const limit = options?.maxResults ?? maxResults
      const outcomes = await Promise.all(sources.map(source => searchLiteratureSource(web, source, query, signal, limit)))
      const failures = outcomes.filter((outcome): outcome is LiteratureSourceFailure => 'error' in outcome)
      const collected = outcomes.flatMap(outcome => outcome.sources)
      // A failed index used to look exactly like an index with no matching papers.
      // Keep partial results usable, but surface a useful error when every selected
      // backend failed so the caller can distinguish network/provider failure from
      // a valid empty search.
      if (collected.length === 0 && failures.length === outcomes.length && failures.length > 0) {
        const details = failures.map(failure => `${failure.source} (${failure.error})`).join('; ')
        const diagnostics = failures.map(failure => `${failure.source}=${failure.category}`).join('; ')
        throw new Error(`literature search failed for all selected sources: ${details}; diagnostics: ${diagnostics}`)
      }
      const seen = new Set<string>()
      return collected.filter((source) => {
        if (seen.has(source.url)) return false
        seen.add(source.url)
        return true
      }).slice(0, limit)
    },
  }
}

interface LiteratureSourceSuccess {
  readonly sources: readonly ResearchLiteratureSource[]
}

interface LiteratureSourceFailure {
  readonly source: ResearchLiteratureSourceId
  readonly sources: readonly []
  readonly error: string
  readonly category: LiteratureErrorCategory
}

/** Failure categories surfaced when every configured literature index is unavailable. */
type LiteratureErrorCategory =
  | 'dns-resolution'
  | 'non-public-address'
  | 'proxy-connection'
  | 'connection-timeout'
  | 'http-429'
  | 'http-5xx'
  | 'response-format'
  | 'network'

interface LiteratureErrorDiagnostic {
  readonly detail: string
  readonly category: LiteratureErrorCategory
}

/** Search one explicit paper index while retaining diagnostics for unavailable indexes. */
async function searchLiteratureSource(
  web: WebRuntime,
  source: Exclude<ResearchLiteratureSourceId, 'web'>,
  query: string,
  signal: AbortSignal | undefined,
  maxResults: number,
): Promise<LiteratureSourceSuccess | LiteratureSourceFailure> {
  let lastError: unknown
  for (let attempt = 0; attempt < LITERATURE_MAX_ATTEMPTS; attempt += 1) {
    try {
      let sources: readonly ResearchLiteratureSource[]
      switch (source) {
        case 'arxiv': sources = await searchArxiv(web, query, signal, maxResults); break
        case 'openreview': sources = await searchOpenReview(web, query, signal, maxResults); break
        case 'semantic-scholar': sources = await searchSemanticScholar(web, query, signal, maxResults); break
        case 'acl-anthology': sources = await searchAclAnthology(web, query, signal, maxResults); break
        case 'openalex': sources = await searchOpenAlex(web, query, signal, maxResults); break
        default: return unreachableLiteratureSource(source)
      }
      return { sources }
    } catch (error: unknown) {
      signal?.throwIfAborted()
      lastError = error
      if (attempt + 1 >= LITERATURE_MAX_ATTEMPTS || !isRetryableLiteratureError(error)) break
      await waitForLiteratureRetry(signal, attempt)
    }
  }
  const diagnostic = describeLiteratureError(lastError)
  return { source, sources: [], error: diagnostic.detail, category: diagnostic.category }
}

const LITERATURE_MAX_ATTEMPTS = 2
const LITERATURE_RETRY_DELAY_MS = 50

function isRetryableLiteratureError(error: unknown): boolean {
  const diagnostic = describeLiteratureError(error)
  if (diagnostic.category === 'non-public-address' || diagnostic.category === 'response-format') return false
  if (diagnostic.category === 'http-429' || diagnostic.category === 'http-5xx' || diagnostic.category === 'connection-timeout') return true
  const code = literatureErrorCode(error)
  if (code === 'WEB_PROXY_ERROR') return true
  if (diagnostic.category === 'proxy-connection') {
    return /ECONNRESET|EAI_AGAIN|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH/iu.test(diagnostic.detail)
  }
  return diagnostic.category === 'dns-resolution' && /EAI_AGAIN|ETIMEDOUT/iu.test(diagnostic.detail)
}

function waitForLiteratureRetry(signal: AbortSignal | undefined, attempt: number): Promise<void> {
  const delay = LITERATURE_RETRY_DELAY_MS * (attempt + 1)
  signal?.throwIfAborted()
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer)
      reject(signal?.reason instanceof Error ? signal.reason : new Error('Literature retry aborted', { cause: signal?.reason }))
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, delay)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

async function fetchText(web: WebRuntime, url: string, signal?: AbortSignal): Promise<string> {
  const result = await web.fetch({ url }, signal)
  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw new Error(`HTTP ${result.statusCode}`)
  }
  if (result.body.content.trim().length === 0) {
    throw new Error('empty response body')
  }
  return result.body.content
}

function describeLiteratureError(error: unknown): LiteratureErrorDiagnostic {
  const detail = literatureErrorText(error).replace(/\s+/gu, ' ').trim().slice(0, 240) || 'unknown error'
  const code = literatureErrorCode(error)
  if (code === 'WEB_BLOCKED_URL' || /non-public (?:IP|IPv4)|NAT64/iu.test(detail)) return { detail, category: 'non-public-address' }
  if (code === 'WEB_FETCH_TIMEOUT' || /tim(?:e|ed) out|timeout|ETIMEDOUT/iu.test(detail)) return { detail, category: 'connection-timeout' }
  if (/\bHTTP 429\b/iu.test(detail)) return { detail, category: 'http-429' }
  if (/\bHTTP 5\d{2}\b/iu.test(detail)) return { detail, category: 'http-5xx' }
  if (code === 'WEB_PROXY_ERROR' || /\bproxy\b|und_err_proxy/iu.test(detail)) return { detail, category: 'proxy-connection' }
  if (code === 'WEB_UNSUPPORTED_CONTENT_TYPE' || /^empty response body$/iu.test(detail) || error instanceof SyntaxError || /JSON parse|unexpected token|malformed response|response body/iu.test(detail)) {
    return { detail, category: 'response-format' }
  }
  if (code === 'WEB_PROVIDER_ERROR' && /DNS|EAI_|ENOTFOUND|getaddrinfo/iu.test(detail)) return { detail, category: 'dns-resolution' }
  if (/DNS|EAI_|ENOTFOUND|getaddrinfo/iu.test(detail)) return { detail, category: 'dns-resolution' }
  return { detail, category: 'network' }
}

function literatureErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined
  return typeof error.code === 'string' ? error.code : undefined
}

function literatureErrorText(error: unknown): string {
  const parts: string[] = []
  const seen = new Set<object>()
  let current: unknown = error
  for (let depth = 0; depth < 4 && current !== undefined; depth += 1) {
    if (current instanceof Error) {
      parts.push(current.message)
      if ('code' in current && typeof current.code === 'string') parts.push(current.code)
      if ('cause' in current) current = current.cause
      else break
      continue
    }
    if (typeof current !== 'object' || current === null) {
      switch (typeof current) {
        case 'string': parts.push(current); break
        case 'number': case 'boolean': case 'bigint': case 'symbol': parts.push(current.toString()); break
        default: parts.push(current === null ? 'null' : typeof current)
      }
      break
    }
    if (seen.has(current)) break
    seen.add(current)
    if ('code' in current && typeof current.code === 'string') parts.push(current.code)
    if ('message' in current && typeof current.message === 'string') parts.push(current.message)
    if ('cause' in current) current = current.cause
    else break
  }
  return parts.join(': ')
}

/** Keep explicit index requests below the HTTP fetch provider's URL limit. */
const MAX_ENCODED_LITERATURE_QUERY_LENGTH = 1200

function encodeLiteratureQuery(query: string, budget = MAX_ENCODED_LITERATURE_QUERY_LENGTH): string {
  const normalized = query
    .replace(/https?:\/\/\S+/gu, ' ')
    .replace(/[\[\]()`*_#]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
  const characters = Array.from(normalized)
  let low = 0
  let high = characters.length
  let best = ''
  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const candidate = characters.slice(0, middle).join('')
    const encoded = encodeURIComponent(candidate)
    if (encoded.length <= budget) {
      best = encoded
      low = middle + 1
    } else {
      high = middle - 1
    }
  }
  return best
}

async function searchOpenReview(
  web: WebRuntime,
  query: string,
  signal: AbortSignal | undefined,
  maxResults: number,
): Promise<readonly ResearchLiteratureSource[]> {
  const suffix = `&limit=${Math.max(1, Math.min(maxResults, 50))}&sort=tcdate:desc`
  const url = `https://api2.openreview.net/notes?content=${encodeLiteratureQuery(query)}${suffix}`
  const value = JSON.parse(await fetchText(web, url, signal)) as { readonly notes?: readonly OpenReviewNote[] }
  return (value.notes ?? []).map((note) => {
    const id = note.id ?? note.forum
    if (id === undefined || id.length === 0) return undefined
    const content = note.content ?? {}
    const title = textField(content.title)
    const abstract = textField(content.abstract)
    const venue = textField(content.venue)
    return {
      url: `https://openreview.net/forum?id=${encodeURIComponent(id)}`,
      provider: 'openreview' as const,
      ...(title === undefined ? {} : { title }),
      ...(abstract === undefined ? {} : { snippet: abstract.slice(0, 1200) }),
      ...(venue === undefined ? {} : { publishedAt: venue }),
    }
  }).filter((source): source is NonNullable<typeof source> => source !== undefined)
}

interface OpenReviewNote { readonly id?: string; readonly forum?: string; readonly content?: Readonly<Record<string, unknown>> }
function textField(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined
  if (typeof value === 'object' && value !== null && 'value' in value) return textField((value as { readonly value?: unknown }).value)
  return undefined
}

async function searchSemanticScholar(
  web: WebRuntime,
  query: string,
  signal: AbortSignal | undefined,
  maxResults: number,
): Promise<readonly ResearchLiteratureSource[]> {
  const fields = 'title,abstract,url,publicationDate,venue'
  const suffix = `&limit=${Math.max(1, Math.min(maxResults, 100))}&fields=${fields}`
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeLiteratureQuery(query)}${suffix}`
  const value = JSON.parse(await fetchText(web, url, signal)) as { readonly data?: readonly SemanticScholarPaper[] }
  const results: ResearchLiteratureSource[] = []
  for (const paper of value.data ?? []) {
    const paperUrl = paper.url
    if (paperUrl === undefined || paperUrl.length === 0) continue
    results.push({
      url: paperUrl,
      provider: 'semantic-scholar',
      ...(paper.title === undefined ? {} : { title: paper.title }),
      ...(paper.abstract === undefined ? {} : { snippet: paper.abstract.slice(0, 1200) }),
      ...(paper.publicationDate === undefined ? {} : { publishedAt: paper.publicationDate }),
    })
  }
  return results
}
interface SemanticScholarPaper {
  readonly title?: string
  readonly abstract?: string
  readonly url?: string
  readonly publicationDate?: string
  readonly venue?: string
}

async function searchAclAnthology(
  web: WebRuntime,
  query: string,
  signal: AbortSignal | undefined,
  maxResults: number,
): Promise<readonly ResearchLiteratureSource[]> {
  const url = `https://aclanthology.org/search/?q=${encodeLiteratureQuery(query)}`
  const html = await fetchText(web, url, signal)
  const results: ResearchLiteratureSource[] = []
  const pattern = /<a[^>]+href=["'](\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  for (const match of html.matchAll(pattern)) {
    const path = match[1] ?? ''
    const title = stripHtml(match[2] ?? '')
    if (!/^\/[A-Z0-9][^/]*\/?$/u.test(path) || title.length === 0) continue
    results.push({ url: `https://aclanthology.org${path}`, provider: 'acl-anthology', title })
    if (results.length >= maxResults) break
  }
  return results
}
function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

async function searchOpenAlex(
  web: WebRuntime,
  query: string,
  signal: AbortSignal | undefined,
  maxResults: number,
): Promise<readonly ResearchLiteratureSource[]> {
  const suffix = `&per-page=${Math.max(1, Math.min(maxResults, 100))}`
  const url = `https://api.openalex.org/works?search=${encodeLiteratureQuery(query)}${suffix}`
    + '&select=id,doi,title,publication_date,abstract_inverted_index'
  const value = JSON.parse(await fetchText(web, url, signal)) as { readonly results?: readonly OpenAlexWork[] }
  return (value.results ?? []).map((work) => {
    const url = work.doi ?? work.id
    if (url === undefined || url.length === 0) return undefined
    return {
      url,
      provider: 'openalex' as const,
      ...(work.title === undefined ? {} : { title: work.title }),
      ...(work.publication_date === undefined ? {} : { publishedAt: work.publication_date }),
      ...(work.abstract_inverted_index === undefined
        ? {}
        : { snippet: openAlexAbstract(work.abstract_inverted_index).slice(0, 1200) }),
    }
  }).filter((source): source is NonNullable<typeof source> => source !== undefined)
}
interface OpenAlexWork {
  readonly id?: string
  readonly doi?: string
  readonly title?: string
  readonly publication_date?: string
  readonly abstract_inverted_index?: Readonly<Record<string, readonly number[]>>
}
function openAlexAbstract(index: Readonly<Record<string, readonly number[]>>): string {
  const words: Array<[number, string]> = []
  for (const [word, positions] of Object.entries(index)) for (const position of positions) words.push([position, word])
  return words.sort(([left], [right]) => left - right).map(([, word]) => word).join(' ')
}

async function searchArxiv(
  web: WebRuntime,
  query: string,
  signal: AbortSignal | undefined,
  maxResults: number,
): Promise<readonly ResearchLiteratureSource[]> {
  const searchQuery = `all:${query} AND (cat:cs.LG OR cat:cs.AI OR cat:cs.CL OR cat:stat.ML)`
  const suffix = `&start=0&max_results=${Math.max(1, Math.min(maxResults, 50))}&sortBy=submittedDate&sortOrder=descending`
  // export.arxiv.org avoids the cross-origin redirect from arxiv.org that the
  // hardened HTTP provider intentionally refuses to follow.
  const url = `https://export.arxiv.org/api/query?search_query=${encodeLiteratureQuery(searchQuery)}${suffix}`
  const xml = await fetchText(web, url, signal)
  const parsed: ResearchLiteratureSource[] = []
  for (const match of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const entry = match[1] ?? ''
    const id = xmlText(entry, 'id')
    const title = xmlText(entry, 'title')
    const summary = xmlText(entry, 'summary')
    const publishedAt = xmlText(entry, 'published')
    if (id === '') continue
    parsed.push({
      url: id,
      provider: 'arxiv' as const,
      ...(title === '' ? {} : { title }),
      ...(summary === '' ? {} : { snippet: summary.slice(0, 1200) }),
      ...(publishedAt === '' ? {} : { publishedAt }),
    })
  }
  return parsed
}

function xmlText(xml: string, tag: string): string {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(xml)
  const value = match?.[1] ?? ''
  return value.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim()
}

/**
 * Build an agent adapter backed by the named subagent provider.
 * @param subagents - Subagent runtime that owns child lifecycle.
 * @param provider - Registered provider name.
 * @returns A role-aware research agent runner.
 */
export function createSubagentResearchRunner(subagents: SubagentRuntime, provider: string): ResearchAgentRunner {
  return {
    async run(role, prompt, parent, signal) {
      const agentOptions = inheritedAgentOptions(parent)
      const run = await startResearchRun(subagents, provider, {
        parent,
        label: `research:${role}`,
        prompt: [{ type: 'text', text: `${CHINESE_OUTPUT_INSTRUCTION}\n\n${prompt}` }],
        ...(agentOptions === undefined ? {} : { agentOptions }),
        signal: signal ?? new AbortController().signal,
      })
      try {
        const result = await run.result
        if (result.stopReason !== 'completed') {
          throw new Error(`research agent ${role} stopped with ${result.stopReason}`)
        }
        const text = result.output.filter((block: ContentBlock) => block.type === 'text').map(block => block.text).join('\n')
        if (text.trim().length === 0) throw new Error(`research agent ${role} returned no visible text`)
        return text
      } finally {
        await run.dispose()
      }
    },
  }
}

/**
 * Build a page-by-page visual OCR adapter backed by the named subagent provider.
 * @param attachments - Durable image store used to make rendered pages model-visible.
 * @param subagents - Subagent runtime that owns visual child lifecycle.
 * @param provider - Registered provider name.
 * @returns OCR adapter that preserves page order and visible uncertainty.
 */
export function createSubagentResearchOcr(
  attachments: AttachmentStore,
  subagents: SubagentRuntime,
  provider: string,
): ResearchPaperOcr {
  return {
    async recognize(input, parent, signal) {
      const pages: string[] = []
      for (const page of input.pages) {
        signal?.throwIfAborted()
        let run: Awaited<ReturnType<typeof startResearchRun>> | undefined
        try {
          const image = await attachments.saveImage({
            data: page.data,
            mediaType: 'image/png',
            name: `${input.fileName}.page-${page.pageNumber}.png`,
          })
          const agentOptions = inheritedAgentOptions(parent)
          run = await startResearchRun(subagents, provider, {
            parent,
            label: 'research:paper-ocr',
            prompt: [
              {
                type: 'text',
                text: `${CHINESE_OUTPUT_INSTRUCTION}\n\n请对 ${input.fileName} 的第 ${page.pageNumber} 页进行忠实 OCR。按阅读顺序转录所有可读文字、公式、表格标签和脚注；保留有意义的换行；不确定字符标记为 [?]；不要总结或臆造缺失文本。只返回转录内容。`,
              },
              { type: 'image', attachment: image },
            ],
            ...(agentOptions === undefined ? {} : { agentOptions }),
            signal: signal ?? new AbortController().signal,
          })
          const result = await run.result
          if (result.stopReason !== 'completed') {
            throw new Error(`OCR agent stopped with ${result.stopReason}`)
          }
          const text = result.output
            .filter((block: ContentBlock): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
            .map(block => block.text)
            .join('\n')
            .trim()
          if (text.length === 0) throw new Error('OCR agent returned no visible text')
          pages.push(`Page ${page.pageNumber}\n${text}`)
        } catch (error) {
          signal?.throwIfAborted()
          const detail = error instanceof Error ? error.message : String(error)
          throw new Error(`PDF_OCR_FAILED: page ${page.pageNumber}: ${detail}`, { cause: error })
        } finally {
          if (run !== undefined) await run.dispose()
        }
      }
      const text = pages.join('\n\n')
      if (text.trim().length === 0) throw new Error('PDF_OCR_EMPTY: OCR produced no readable text')
      return text
    },
  }
}

const CHINESE_OUTPUT_INSTRUCTION = '除论文标题、URL、代码、公式和 JSON 字段名外，所有模型可见输出必须使用简体中文。'

function inheritedAgentOptions(parent: Agent): AgentOptions | undefined {
  const previous = parentAgentOptionsForDelegation(parent)
  const pending = parent.ctx.get('sessionProjections')?.stateOf(parent.session, 'modelSelection')?.pending
  const { provider: _provider, model: _model, reasoningEffort: _effort, ...limits } = previous
  const options: AgentOptions = pending == null ? previous : {
    ...limits,
    provider: pending.provider,
    model: pending.model,
    ...(pending.reasoningEffort === undefined ? {} : { reasoningEffort: ReasoningEffortId(pending.reasoningEffort) }),
  }
  const inherited: AgentOptions = {
    ...(options.provider === undefined ? {} : { provider: options.provider }),
    ...(options.model === undefined ? {} : { model: options.model }),
    ...(options.reasoningEffort === undefined ? {} : { reasoningEffort: options.reasoningEffort }),
    ...(options.maxTokens === undefined ? {} : { maxTokens: options.maxTokens }),
  }
  return Object.keys(inherited).length === 0 ? undefined : inherited
}

/** Options used when assembling all configured Host capabilities. */
export interface HostResearchCoordinatorOptions {
  /** Named subagent provider used for every research role. */
  readonly subagentProvider: string
  /** Explicit path in the caller's Session filesystem for the Markdown plan. */
  readonly planPath: string
  /** Maximum paper bytes admitted to extraction. */
  readonly maxPaperBytes: number
  /** Maximum literature sources returned from the configured provider. */
  readonly maxLiteratureResults: number
  /** Maximum PDF pages inspected and rendered for OCR. */
  readonly maxPdfPages: number
  /** Initial PDF rendering scale before pixel capping. */
  readonly ocrScale: number
  /** Maximum pixels in one rendered OCR page. */
  readonly maxOcrPixels: number
  /** Minimum isolated innovation score required before a candidate is shown. */
  readonly innovationScoreThreshold?: number
  /** Maximum fresh candidates generated for one idea checkpoint. */
  readonly maxIdeaAttempts?: number
  /** Sandbox policy resolved for the parent Session's file writes. */
  readonly sandboxPolicy?: SandboxExecutionPolicy
}

/** Host capabilities needed to assemble a coordinator from the DSH services. */
export interface HostResearchCoordinatorServices {
  readonly attachments: AttachmentStore
  readonly web: WebRuntime
  readonly subagents: SubagentRuntime
  readonly fs: FileSystem
  /** Optional reviewed simulation adapter; the default is a fixed numerical template. */
  readonly simulation?: ResearchSimulationRunner
}

/**
 * Assemble the real attachment, web, subagent, and Session-filesystem adapters.
 * The parent Agent remains an explicit per-run input to {@link ResearchCoordinator.advance}.
 * @param services - DSH Host services selected by the active profile.
 * @param options - Explicit provider route, plan path, and result bounds.
 * @returns A coordinator with durable paper reads, network search, delegated agents, and file output.
 */
export function createHostResearchCoordinator(
  services: HostResearchCoordinatorServices,
  options: HostResearchCoordinatorOptions,
): ResearchCoordinator {
  const planWriter: ResearchPlanWriter = {
    async write(file) {
      const target = await services.fs.resolve(options.planPath)
      await services.fs.writeText(target, file.content, undefined, undefined, options.sandboxPolicy)
      return { fileName: target.displayPath, content: file.content }
    },
  }
  return new ResearchCoordinator({
    papers: createAttachmentPaperReader(services.attachments, options.maxPaperBytes, {
      maxPdfPages: options.maxPdfPages,
      ocrScale: options.ocrScale,
      maxOcrPixels: options.maxOcrPixels,
      ocr: createSubagentResearchOcr(services.attachments, services.subagents, options.subagentProvider),
    }),
    literature: createWebLiteratureSearcher(services.web, options.maxLiteratureResults),
    agents: createSubagentResearchRunner(services.subagents, options.subagentProvider),
    simulation: services.simulation ?? createNumericalResearchSimulationRunner(),
    innovation: {
      ...(options.innovationScoreThreshold === undefined ? {} : { scoreThreshold: options.innovationScoreThreshold }),
      ...(options.maxIdeaAttempts === undefined ? {} : { maxAttempts: options.maxIdeaAttempts }),
    },
    planWriter,
  })
}

/**
 * Render all confirmed branch evidence as the final Markdown plan.
 * @param artifacts - Artifacts visible in one selected branch.
 * @returns UTF-8 Markdown content for the final plan file.
 */
export function renderResearchPlan(artifacts: readonly ResearchArtifact[]): string {
  const section = (kind: ResearchArtifact['kind'], heading: string): string => {
    const artifact = [...artifacts].reverse().find(item => item.kind === kind)
    return artifact === undefined ? `## ${heading}\n\n待补充。` : `## ${heading}\n\n${artifact.content}`
  }
  const literature = artifacts.filter(item => item.kind === 'literature')
  const literatureSection = literature.length === 0
    ? '## 相关工作与证据\n\n待补充。'
    : `## 相关工作与证据\n\n${literature.map(item => `### ${item.title}\n\n${item.content}`).join('\n\n')}`
  return [
    '# 自动科研方案',
    section('summary', '论文摘要'),
    section('problem', '研究问题与缺口'),
    literatureSection,
    section('idea', '改进方法与创新点'),
    section('review', '多智能体审查与修订'),
    section('simulation', '简单仿真证据'),
    '## 实验设计\n\n请依据审查意见补齐数据、基线、指标、消融、风险和复现步骤。',
  ].join('\n\n') + '\n'
}

interface PdfExtraction {
  readonly text: string
  readonly embeddedPages: readonly PdfTextPage[]
  readonly pageCount: number
  readonly processedPageCount: number
  readonly pages: readonly ResearchPaperOcrPage[]
}

interface PdfTextPage {
  readonly pageNumber: number
  readonly text: string
}

interface ResolvedPaperReaderOptions {
  readonly maxPdfPages: number
  readonly ocrScale: number
  readonly maxOcrPixels: number
  readonly ocr?: ResearchPaperOcr
}

const DEFAULT_PDF_PAGES = 12
const DEFAULT_OCR_SCALE = 1.5
const DEFAULT_MAX_OCR_PIXELS = 4_000_000
const MIN_EMBEDDED_TEXT = 24

function resolvePaperReaderOptions(options: ResearchPaperReaderOptions): ResolvedPaperReaderOptions {
  const maxPdfPages = options.maxPdfPages ?? DEFAULT_PDF_PAGES
  const ocrScale = options.ocrScale ?? DEFAULT_OCR_SCALE
  const maxOcrPixels = options.maxOcrPixels ?? DEFAULT_MAX_OCR_PIXELS
  if (!Number.isSafeInteger(maxPdfPages) || maxPdfPages < 1) throw new Error('maxPdfPages must be a positive integer')
  if (!Number.isFinite(ocrScale) || ocrScale <= 0) throw new Error('ocrScale must be a positive number')
  if (!Number.isSafeInteger(maxOcrPixels) || maxOcrPixels < 1) throw new Error('maxOcrPixels must be a positive integer')
  return { maxPdfPages, ocrScale, maxOcrPixels, ...(options.ocr === undefined ? {} : { ocr: options.ocr }) }
}

function isPdfUpload(bytes: Uint8Array, fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.pdf')
    || bytes.length >= 5 && new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-'
}

async function openPdf(
  bytes: Uint8Array,
  fileName: string,
  options: ResolvedPaperReaderOptions,
  signal?: AbortSignal,
): Promise<PdfExtraction> {
  signal?.throwIfAborted()
  let document: PDFDocumentProxy | undefined
  let loadingTask: ReturnType<typeof getDocument> | undefined
  try {
    loadingTask = getDocument({
      data: bytes,
      useWorkerFetch: false,
      stopAtErrors: false,
      disableFontFace: true,
      standardFontDataUrl: `${join(dirname(createRequire(import.meta.url).resolve('pdfjs-dist/package.json')), 'standard_fonts')}/`,
    })
    document = await loadingTask.promise
    const pageCount = document.numPages
    const pagesToRead = Math.min(pageCount, options.maxPdfPages)
    const embeddedPages: PdfTextPage[] = []
    for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
      signal?.throwIfAborted()
      const page = await document.getPage(pageNumber)
      const content = await page.getTextContent()
      const pageText = content.items
        .map(item => 'str' in item ? item.str : '')
        .filter(text => text.trim().length > 0)
        .join(' ')
      if (pageText.trim().length >= MIN_EMBEDDED_TEXT) embeddedPages.push({ pageNumber, text: pageText.trim() })
    }

    const pages: ResearchPaperOcrPage[] = []
    for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
      if (embeddedPages.some(page => page.pageNumber === pageNumber)) continue
      signal?.throwIfAborted()
      const page = await document.getPage(pageNumber)
      const initialViewport = page.getViewport({ scale: options.ocrScale })
      const requestedPixels = initialViewport.width * initialViewport.height
      const capScale = requestedPixels > options.maxOcrPixels
        ? Math.sqrt(options.maxOcrPixels / requestedPixels)
        : 1
      const viewport = capScale === 1
        ? initialViewport
        : page.getViewport({ scale: options.ocrScale * capScale })
      const width = Math.max(1, Math.ceil(viewport.width))
      const height = Math.max(1, Math.ceil(viewport.height))
      const canvas = createCanvas(width, height)
      const context = canvas.getContext('2d')
      await page.render({ canvas: null, canvasContext: context as never, viewport }).promise
      pages.push({ pageNumber, data: canvas.toBuffer('image/png') })
    }
    return { text: renderPdfTextPages(embeddedPages), embeddedPages, pageCount, processedPageCount: pagesToRead, pages }
  } catch (error) {
    signal?.throwIfAborted()
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(`PDF_TEXT_EXTRACTION_FAILED: ${fileName}: ${detail}`, { cause: error })
  } finally {
    if (loadingTask !== undefined) await loadingTask.destroy()
  }
}

function renderPdfTextPages(pages: readonly PdfTextPage[]): string {
  return pages.map(page => `Page ${page.pageNumber}\n${page.text}`).join('\n\n').trim()
}

function mergePdfText(embeddedPages: readonly PdfTextPage[], ocrText: string): string {
  const pages = new Map<number, string>(embeddedPages.map(page => [page.pageNumber, page.text]))
  const marker = /(?:^|\n)Page (\d+)\n([\s\S]*?)(?=\nPage \d+\n|$)/g
  let matched = false
  for (const match of ocrText.matchAll(marker)) {
    const pageNumber = Number(match[1])
    const text = match[2]?.trim()
    if (!Number.isSafeInteger(pageNumber) || text === undefined || text.length === 0) continue
    pages.set(pageNumber, text)
    matched = true
  }
  if (!matched && ocrText.trim().length > 0) return [renderPdfTextPages(embeddedPages), ocrText.trim()].filter(Boolean).join('\n\n')
  return [...pages.entries()]
    .sort(([left], [right]) => left - right)
    .map(([pageNumber, text]) => `Page ${pageNumber}\n${text}`)
    .join('\n\n')
    .trim()
}

function parseInnovationEvaluation(text: string, threshold: number): ResearchInnovationEvaluation {
  const candidate = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('INNOVATION_REVIEW_INVALID: expert did not return a JSON object')
  let value: unknown
  try {
    value = JSON.parse(candidate.slice(start, end + 1))
  } catch (error) {
    throw new Error('INNOVATION_REVIEW_INVALID: expert returned malformed JSON', { cause: error })
  }
  if (typeof value !== 'object' || value === null) throw new Error('INNOVATION_REVIEW_INVALID: expert result is not an object')
  const record = value as Record<string, unknown>
  const score = record.score
  const overlap = record.overlap
  const rationale = record.rationale
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 100 || typeof overlap !== 'boolean' || typeof rationale !== 'string') {
    throw new Error('INNOVATION_REVIEW_INVALID: expected integer score, boolean overlap, and rationale')
  }
  return { score, threshold, overlap, rationale: rationale.trim() }
}

/** Format candidate-specific index results for the isolated innovation reviewer. */
function formatLiteratureSources(sources: readonly ResearchLiteratureSource[]): string {
  if (sources.length === 0) return '（本候选点专项检索没有返回结果，不能据此证明不存在重复工作。）'
  return sources.map((source, index) => {
    const title = source.title ?? source.url
    const provider = source.provider === undefined ? '未标明来源' : source.provider
    const publishedAt = source.publishedAt === undefined ? '' : `\n发表信息：${source.publishedAt}`
    const snippet = source.snippet === undefined ? '' : `\n摘要或检索片段：${source.snippet}`
    return `${index + 1}. ${title}\n来源：${provider}\nURL：${source.url}${publishedAt}${snippet}`
  }).join('\n\n')
}

function unreachableStage(stage: never): never {
  throw new Error(`unsupported research stage ${String(stage)}`)
}

function unreachableLiteratureSource(source: never): never {
  throw new Error(`unsupported research literature source ${String(source)}`)
}

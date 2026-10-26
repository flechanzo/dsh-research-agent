/**
 * Durable state vocabulary for the human-in-the-loop research workflow.
 *
 * The coordinator deliberately stores every user-visible stage as an immutable
 * node. Continuing from an earlier node creates a new branch, so a rejected
 * idea or a historical inspection cannot rewrite the memory used by a later
 * branch.
 *
 * @module @deepseek-ai/dsh-workflow/research
 */

import type { SessionId } from '@deepseek-ai/dsh-session'

/** Stages shown by the research workflow navigator. */
export type ResearchStage =
  | 'paper-upload'
  | 'paper-read'
  | 'problem-summary'
  | 'literature-search'
  | 'idea-generation'
  | 'idea-refinement'
  | 'targeted-literature-search'
  | 'multi-agent-review'
  | 'simulation-or-final-plan'
  | 'final-plan'

/** Lifecycle of one stage node. */
export type ResearchNodeStatus =
  | 'pending'
  | 'active'
  | 'awaiting-confirmation'
  | 'confirmed'
  | 'rejected'
  | 'completed'

/** Human decision recorded against a stage output. */
export type ResearchDecision = 'confirm' | 'reject' | 'feedback'

/** Search backends available to the research literature stages.
 *
 * These are explicit paper indexes. The generic DeepSeek Web Search tool is
 * deliberately absent so a literature step never silently broadens its
 * search to an unrelated web provider.
 */
export type ResearchLiteratureSourceId = 'arxiv' | 'openreview' | 'semantic-scholar' | 'acl-anthology' | 'openalex'

/** User-selectable research emphasis areas shown as a multi-select. */
export type ResearchDirectionFocusId =
  | 'method'
  | 'data'
  | 'theory'
  | 'efficiency'
  | 'application'

/** Default focus areas used when a new research Session has no selection. */
export const DEFAULT_RESEARCH_DIRECTION_FOCUSES: readonly ResearchDirectionFocusId[] = [
  'method', 'data', 'theory', 'efficiency', 'application',
]

/** User-adjustable emphasis applied when agents propose and evaluate ideas. */
export interface ResearchDirectionWeights {
  /** Weight for novelty and separation from prior work. */
  readonly novelty: number
  /** Weight for expected research impact. */
  readonly impact: number
  /** Weight for implementation feasibility. */
  readonly feasibility: number
  /** Weight for reproducibility and evaluation clarity. */
  readonly reproducibility: number
}

/** Default direction emphasis used before the user adjusts the sliders. */
export const DEFAULT_RESEARCH_DIRECTION_WEIGHTS: ResearchDirectionWeights = {
  novelty: 30, impact: 25, feasibility: 25, reproducibility: 20,
}

/** Default literature indexes, including major ML conference proceedings. */
export const DEFAULT_RESEARCH_LITERATURE_SOURCES: readonly ResearchLiteratureSourceId[] = [
  'arxiv', 'openreview', 'semantic-scholar', 'acl-anthology', 'openalex',
]

/**
 * Render a stable human-facing label for a numbered idea branch.
 *
 * The root branch is numbered one and called “方案 A”. Subsequent branches
 * use spreadsheet-style letters so labels remain unique after 26 branches.
 * @param branchNumber - One-based branch number.
 * @returns A branch label without the “方案” prefix.
 */
export function researchBranchLabel(branchNumber: number): string {
  if (!Number.isSafeInteger(branchNumber) || branchNumber < 1) {
    throw new Error('research branch number must be a positive safe integer')
  }
  let value = branchNumber
  let label = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    label = String.fromCharCode(65 + remainder) + label
    value = Math.floor((value - 1) / 26)
  }
  return label
}

/** The output a stage makes available to the user and later agents. */
export interface ResearchArtifact {
  /** Stable artifact id within one research session. */
  readonly artifactId: string
  /** Artifact category used by the UI renderer and final planner. */
  readonly kind: 'paper' | 'summary' | 'problem' | 'literature' | 'idea' | 'review' | 'simulation' | 'plan' | 'decision'
  /** User-visible title. */
  readonly title: string
  /** Markdown content shown to the user. */
  readonly content: string
  /** Optional paper filename or source URL. */
  readonly source?: string
  /** Structured innovation evaluation, when this artifact is a scored idea. */
  readonly evaluation?: ResearchInnovationEvaluation
  /** Stable creation time supplied by the coordinator. */
  readonly createdAt: number
}

/** Expert evaluation attached to an innovation candidate before user presentation. */
export interface ResearchInnovationEvaluation {
  /** Expert score in the inclusive 0–100 range. */
  readonly score: number
  /** Minimum score required before the candidate is shown to the user. */
  readonly threshold: number
  /** Whether the candidate substantially overlaps a cited prior paper. */
  readonly overlap: boolean
  /** Short expert rationale shown with the candidate. */
  readonly rationale: string
}

/** Snapshot of the memory available when a node was created. */
export interface ResearchMemorySnapshot {
  /** Artifact ids visible to agents at this point in the branch. */
  readonly artifactIds: readonly string[]
  /** User feedback accumulated before this node. */
  readonly feedback: readonly string[]
  /** Selected expert roles for the next review. */
  readonly reviewerRoles: readonly string[]
  /** Direction emphasis copied into downstream nodes. */
  readonly directionWeights: ResearchDirectionWeights
  /** Literature backends copied into downstream nodes. */
  readonly literatureSources: readonly ResearchLiteratureSourceId[]
  /** Research aspects selected by the user for idea generation. */
  readonly directionFocuses: readonly ResearchDirectionFocusId[]
}

/** One immutable point in the conversation DAG. */
export interface ResearchNode {
  /** Stable node id. */
  readonly nodeId: string
  /** Parent node, absent only for the root upload node. */
  readonly parentNodeId?: string
  /** Branch that owns this node. */
  readonly branchId: string
  /** Workflow stage represented by this node. */
  readonly stage: ResearchStage
  /** Current stage status. */
  readonly status: ResearchNodeStatus
  /** Artifacts produced by this stage. */
  readonly artifactRefs: readonly string[]
  /** Inclusive Session event boundary used to restore this stage in a fork. */
  readonly sessionSeq?: number
  /** Session whose event log contains the boundary, including copied history nodes. */
  readonly sourceSessionId?: SessionId
  /** Last human decision, if any. */
  readonly userDecision?: ResearchDecision
  /** Exact memory snapshot used by downstream agents. */
  readonly memorySnapshot: ResearchMemorySnapshot
  /** Optional rejection reason or feedback visible in the branch. */
  readonly userNote?: string
}

/** One named idea branch in the right-hand navigator. */
export interface ResearchBranch {
  /** Stable branch id. */
  readonly branchId: string
  /** Human-facing label. */
  readonly label: string
  /** Node from which this branch diverged. */
  readonly forkNodeId?: string
  /** Node ids in creation order. */
  readonly nodeIds: readonly string[]
}

/** Complete workflow snapshot suitable for a session projection or UI store. */
export interface ResearchState {
  /** All immutable nodes, indexed for O(1) history selection. */
  readonly nodes: Readonly<Record<string, ResearchNode>>
  /** All branches, indexed for the branch navigator. */
  readonly branches: Readonly<Record<string, ResearchBranch>>
  /** Artifacts shared by node references. */
  readonly artifacts: Readonly<Record<string, ResearchArtifact>>
  /** Currently displayed node. */
  readonly selectedNodeId: string
  /** Current branch receiving new work. */
  readonly activeBranchId: string
  /** Monotonic counters make fixture and replay ids deterministic. */
  readonly nextNodeNumber: number
  readonly nextBranchNumber: number
  readonly nextArtifactNumber: number
}

/** Input for appending a user-visible stage output. */
export interface ResearchOutputInput {
  readonly stage: ResearchStage
  readonly title: string
  readonly content: string
  readonly kind: ResearchArtifact['kind']
  readonly source?: string
  readonly evaluation?: ResearchInnovationEvaluation
  readonly status?: ResearchNodeStatus
}

/** Create the empty workflow with an active paper-upload root.
 * @param now - Reserved clock input for deterministic coordinators.
 * @returns A new research state with one active root node.
 */
export function createResearchState(now = 0): ResearchState {
  const branchId = 'branch-1'
  const nodeId = 'node-1'
  const root: ResearchNode = {
    nodeId,
    branchId,
    stage: 'paper-upload',
    status: 'active',
    artifactRefs: [],
    memorySnapshot: {
      artifactIds: [], feedback: [], reviewerRoles: [],
      directionWeights: { ...DEFAULT_RESEARCH_DIRECTION_WEIGHTS },
      literatureSources: [...DEFAULT_RESEARCH_LITERATURE_SOURCES],
      directionFocuses: [...DEFAULT_RESEARCH_DIRECTION_FOCUSES],
    },
  }
  void now
  return {
    nodes: { [nodeId]: root },
    branches: { [branchId]: { branchId, label: '方案 A', nodeIds: [nodeId] } },
    artifacts: {},
    selectedNodeId: nodeId,
    activeBranchId: branchId,
    nextNodeNumber: 2,
    nextBranchNumber: 2,
    nextArtifactNumber: 1,
  }
}

/** Return the selected node, throwing when a corrupted projection references nothing.
 * @param state - Research state to inspect.
 * @returns The selected immutable node.
 */
export function selectedResearchNode(state: ResearchState): ResearchNode {
  const node = state.nodes[state.selectedNodeId]
  if (node === undefined) throw new Error(`research node "${state.selectedNodeId}" is missing`)
  return node
}

/** Append a stage output to the active branch without mutating existing nodes.
 * @param state - Current research state.
 * @param input - User-visible stage output to append.
 * @param createdAt - Timestamp assigned to the artifact.
 * @returns The next state with a new node and artifact.
 */
export function appendResearchOutput(
  state: ResearchState,
  input: ResearchOutputInput,
  createdAt = 0,
): ResearchState {
  const parent = selectedResearchNode(state)
  const artifactId = `artifact-${state.nextArtifactNumber}`
  const nodeId = `node-${state.nextNodeNumber}`
  const artifact: ResearchArtifact = {
    artifactId,
    kind: input.kind,
    title: input.title,
    content: input.content,
    ...(input.source === undefined ? {} : { source: input.source }),
    ...(input.evaluation === undefined ? {} : { evaluation: input.evaluation }),
    createdAt,
  }
  const node: ResearchNode = {
    nodeId,
    parentNodeId: parent.nodeId,
    branchId: state.activeBranchId,
    stage: input.stage,
    status: input.status ?? 'awaiting-confirmation',
    artifactRefs: [artifactId],
    memorySnapshot: {
      artifactIds: [...parent.memorySnapshot.artifactIds, artifactId],
      feedback: parent.memorySnapshot.feedback,
      reviewerRoles: parent.memorySnapshot.reviewerRoles,
      directionWeights: parent.memorySnapshot.directionWeights,
      literatureSources: parent.memorySnapshot.literatureSources,
      directionFocuses: parent.memorySnapshot.directionFocuses,
    },
  }
  const branch = state.branches[state.activeBranchId]
  if (branch === undefined) throw new Error(`research branch "${state.activeBranchId}" is missing`)
  return {
    ...state,
    nodes: { ...state.nodes, [nodeId]: node },
    branches: { ...state.branches, [branch.branchId]: { ...branch, nodeIds: [...branch.nodeIds, nodeId] } },
    artifacts: { ...state.artifacts, [artifactId]: artifact },
    selectedNodeId: nodeId,
    nextNodeNumber: state.nextNodeNumber + 1,
    nextArtifactNumber: state.nextArtifactNumber + 1,
  }
}

/** Confirm a stage, preserving the output and marking it ready for the next stage.
 * @param state - Current research state.
 * @returns The state with the selected node confirmed.
 */
export function confirmResearchNode(state: ResearchState): ResearchState {
  const node = selectedResearchNode(state)
  if (node.status !== 'awaiting-confirmation' && node.status !== 'active') return state
  const confirmed: ResearchNode = {
    ...node,
    status: 'confirmed',
    ...(node.userDecision === 'feedback' ? { userDecision: 'feedback' } : { userDecision: 'confirm' }),
  }
  return { ...state, nodes: { ...state.nodes, [node.nodeId]: confirmed } }
}

/** Attach feedback to a node while keeping the node identity stable.
 * @param state - Current research state.
 * @param feedback - User feedback to retain in branch memory.
 * @returns The state with feedback attached to the selected node.
 */
export function addResearchFeedback(state: ResearchState, feedback: string): ResearchState {
  const node = selectedResearchNode(state)
  const trimmed = feedback.trim()
  if (trimmed === '') return state
  const updated: ResearchNode = {
    ...node,
    userDecision: 'feedback',
    userNote: trimmed,
    memorySnapshot: { ...node.memorySnapshot, feedback: [...node.memorySnapshot.feedback, trimmed] },
  }
  return { ...state, nodes: { ...state.nodes, [node.nodeId]: updated } }
}

/**
 * Select the expert roles that will review the next idea. The roles are kept
 * in the selected node's immutable memory snapshot so a historical branch
 * cannot silently change the review roster of another branch.
 * @param state - Current research state.
 * @param reviewerRoles - Non-blank role labels in display order.
 * @returns The state with the selected node's review roster updated.
 */
export function setResearchReviewerRoles(
  state: ResearchState,
  reviewerRoles: readonly string[],
): ResearchState {
  const node = selectedResearchNode(state)
  const roles = reviewerRoles.map(role => role.trim()).filter(role => role.length > 0)
  if (roles.length === 0) return state
  const updated: ResearchNode = {
    ...node,
    memorySnapshot: { ...node.memorySnapshot, reviewerRoles: [...roles] },
  }
  return { ...state, nodes: { ...state.nodes, [node.nodeId]: updated } }
}

/**
 * Store user-selected direction emphasis on the current node.
 * @param state - Current research state.
 * @param directionWeights - Four bounded emphasis values.
 * @returns The state with the selected node's emphasis updated.
 */
export function setResearchDirectionWeights(
  state: ResearchState,
  directionWeights: ResearchDirectionWeights,
): ResearchState {
  for (const [name, value] of Object.entries(directionWeights)) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 100) throw new Error(`research direction weight "${name}" must be an integer from 0 to 100`)
  }
  const node = selectedResearchNode(state)
  const updated: ResearchNode = {
    ...node,
    memorySnapshot: { ...node.memorySnapshot, directionWeights: { ...directionWeights } },
  }
  return { ...state, nodes: { ...state.nodes, [node.nodeId]: updated } }
}

/**
 * Store the literature backends selected for subsequent searches.
 * @param state - Current research state.
 * @param literatureSources - One or more supported backend ids.
 * @returns The state with the selected node's backend selection updated.
 */
export function setResearchLiteratureSources(
  state: ResearchState,
  literatureSources: readonly ResearchLiteratureSourceId[],
): ResearchState {
  const sources = [...new Set(literatureSources)]
  if (sources.length === 0) throw new Error('at least one research literature source is required')
  const node = selectedResearchNode(state)
  const updated: ResearchNode = {
    ...node,
    memorySnapshot: { ...node.memorySnapshot, literatureSources: sources },
  }
  return { ...state, nodes: { ...state.nodes, [node.nodeId]: updated } }
}

/**
 * Store the research aspects selected for the next idea prompt.
 * @param state - Current research state.
 * @param directionFocuses - One or more supported focus areas.
 * @returns The state with the selected focus areas stored in branch memory.
 */
export function setResearchDirectionFocuses(
  state: ResearchState,
  directionFocuses: readonly ResearchDirectionFocusId[],
): ResearchState {
  const focuses = [...new Set(directionFocuses)]
  if (focuses.length === 0) throw new Error('at least one research direction focus is required')
  const node = selectedResearchNode(state)
  const updated: ResearchNode = {
    ...node,
    memorySnapshot: { ...node.memorySnapshot, directionFocuses: focuses },
  }
  return { ...state, nodes: { ...state.nodes, [node.nodeId]: updated } }
}

/**
 * Mark the selected final node complete after its output has been written.
 * @param state - Current research state.
 * @returns The state with the selected node marked complete.
 */
export function completeResearchNode(state: ResearchState): ResearchState {
  const node = selectedResearchNode(state)
  if (node.status === 'completed') return state
  const completed: ResearchNode = { ...node, status: 'completed', userDecision: 'confirm' }
  return { ...state, nodes: { ...state.nodes, [node.nodeId]: completed } }
}

/**
 * Attach the persisted path to the selected final-plan artifact.
 * @param state - Research state whose final plan was written.
 * @param fileName - Workspace-relative path returned by the writer.
 * @returns The state with the plan artifact marked as persisted.
 */
export function markResearchPlanWritten(state: ResearchState, fileName: string): ResearchState {
  const trimmed = fileName.trim()
  if (trimmed === '') throw new Error('research plan file name must not be empty')
  const node = selectedResearchNode(state)
  const artifactId = node.artifactRefs.at(-1)
  const artifact = artifactId === undefined ? undefined : state.artifacts[artifactId]
  if (artifact === undefined || artifact.kind !== 'plan') {
    throw new Error('research plan artifact is required before it can be written')
  }
  if (artifact.source === trimmed) return state
  return {
    ...state,
    artifacts: {
      ...state.artifacts,
      [artifact.artifactId]: { ...artifact, source: trimmed },
    },
  }
}

/**
 * Attach the durable Session boundary reached after a stage operation.
 * @param state - Current research state.
 * @param sessionSeq - Inclusive event sequence reached by the operation.
 * @param sourceSessionId - Session containing the event, when known.
 * @returns The state with the selected node's restore metadata updated.
 */
export function markResearchSessionBoundary(
  state: ResearchState,
  sessionSeq: number,
  sourceSessionId?: SessionId,
): ResearchState {
  if (!Number.isSafeInteger(sessionSeq) || sessionSeq < 0) throw new Error('research Session boundary must be a non-negative safe integer')
  const node = selectedResearchNode(state)
  return {
    ...state,
    nodes: {
      ...state.nodes,
      [node.nodeId]: {
        ...node,
        sessionSeq,
        ...(sourceSessionId === undefined ? {} : { sourceSessionId }),
      },
    },
  }
}

/**
 * Resolve the Session that owns a node's restore boundary.
 * @param node - Node metadata from the durable DAG.
 * @param currentSessionId - Session carrying legacy nodes without a recorded source Session.
 * @returns The source Session for the node's event boundary.
 */
export function researchSourceSessionId(
  node: Pick<ResearchNode, 'sourceSessionId'>,
  currentSessionId: SessionId,
): SessionId {
  return node.sourceSessionId ?? currentSessionId
}

/**
 * Reject an idea and start a fresh idea-generation branch from the problem
 * summary. The rejected branch remains readable and immutable.
 * @param state - Current research state.
 * @param reason - Optional reason shown on the new branch.
 * @returns The state with a new active idea branch.
 */
export function rejectIdea(state: ResearchState, reason = ''): ResearchState {
  let source = selectedResearchNode(state)
  while (source.stage !== 'problem-summary' && source.parentNodeId !== undefined) {
    const parent = state.nodes[source.parentNodeId]
    if (parent === undefined) break
    source = parent
  }
  if (source.stage !== 'problem-summary') {
    const fallback = Object.values(state.nodes).find(node => node.stage === 'problem-summary')
    if (fallback === undefined) throw new Error('research problem summary is required before rejecting an idea')
    source = fallback
  }
  const visibleArtifactIds = selectedResearchNode(state).memorySnapshot.artifactIds.filter((artifactId) => {
    const artifact = state.artifacts[artifactId]
    return artifact?.kind === 'summary' || artifact?.kind === 'problem' || artifact?.kind === 'literature'
  })
  const branchId = `branch-${state.nextBranchNumber}`
  const nodeId = `node-${state.nextNodeNumber}`
  const node: ResearchNode = {
    nodeId,
    parentNodeId: source.nodeId,
    branchId,
    stage: 'idea-generation',
    status: 'active',
    artifactRefs: [],
    ...(reason.trim() === '' ? {} : { userNote: reason.trim() }),
    memorySnapshot: {
      artifactIds: visibleArtifactIds,
      feedback: [],
      reviewerRoles: [],
      directionWeights: { ...source.memorySnapshot.directionWeights },
      literatureSources: [...source.memorySnapshot.literatureSources],
      directionFocuses: [...source.memorySnapshot.directionFocuses],
    },
  }
  return {
    ...state,
    nodes: { ...state.nodes, [nodeId]: node },
    branches: {
      ...state.branches,
      [branchId]: {
        branchId,
        label: `方案 ${researchBranchLabel(state.nextBranchNumber)}`,
        forkNodeId: source.nodeId,
        nodeIds: [source.nodeId, nodeId],
      },
    },
    activeBranchId: branchId,
    selectedNodeId: nodeId,
    nextNodeNumber: state.nextNodeNumber + 1,
    nextBranchNumber: state.nextBranchNumber + 1,
  }
}

/** Continue from a historical node by creating an isolated branch.
 * The copied node keeps its restore metadata; a Host Session fork rebinds the
 * continuation's source Session after the new Session id is allocated.
 * @param state - Current research state.
 * @param nodeId - Historical node to fork from.
 * @returns The state with a new active continuation branch.
 */
export function continueFromResearchNode(state: ResearchState, nodeId: string): ResearchState {
  const source = state.nodes[nodeId]
  if (source === undefined) throw new Error(`research node "${nodeId}" is missing`)
  const branchId = `branch-${state.nextBranchNumber}`
  const continuationId = `node-${state.nextNodeNumber}`
  const continuation: ResearchNode = {
    nodeId: continuationId,
    parentNodeId: source.nodeId,
    branchId,
    stage: source.stage,
    status: source.status,
    artifactRefs: source.artifactRefs,
    ...(source.sessionSeq === undefined ? {} : { sessionSeq: source.sessionSeq }),
    ...(source.sourceSessionId === undefined ? {} : { sourceSessionId: source.sourceSessionId }),
    memorySnapshot: source.memorySnapshot,
    ...(source.userDecision === undefined ? {} : { userDecision: source.userDecision }),
    ...(source.userNote === undefined ? {} : { userNote: source.userNote }),
  }
  return {
    ...state,
    nodes: { ...state.nodes, [continuationId]: continuation },
    branches: {
      ...state.branches,
      [branchId]: {
        branchId,
        label: `回溯 ${state.nextBranchNumber - 1}`,
        forkNodeId: source.nodeId,
        nodeIds: [source.nodeId, continuationId],
      },
    },
    activeBranchId: branchId,
    selectedNodeId: continuationId,
    nextNodeNumber: state.nextNodeNumber + 1,
    nextBranchNumber: state.nextBranchNumber + 1,
  }
}

/** Select a historical node without changing the active branch or its memory.
 * @param state - Current research state.
 * @param nodeId - Node to display.
 * @returns The state with the requested node selected.
 */
export function selectResearchNode(state: ResearchState, nodeId: string): ResearchState {
  if (state.nodes[nodeId] === undefined) throw new Error(`research node "${nodeId}" is missing`)
  return { ...state, selectedNodeId: nodeId }
}

/** Select the latest node of an existing branch without creating a continuation.
 * @param state - Research state to inspect.
 * @param branchId - Existing branch to display and receive later appends.
 * @returns The state with the branch selected.
 */
export function selectResearchBranch(state: ResearchState, branchId: string): ResearchState {
  const branch = state.branches[branchId]
  if (branch === undefined) throw new Error(`research branch "${branchId}" is missing`)
  const nodeId = branch.nodeIds.at(-1)
  if (nodeId === undefined || state.nodes[nodeId] === undefined) {
    throw new Error(`research branch "${branchId}" has no selectable node`)
  }
  return { ...state, activeBranchId: branchId, selectedNodeId: nodeId }
}

/** Verify that a generated idea makes an explicit, non-empty innovation claim.
 * @param idea - Idea artifact to validate.
 * @returns Nothing when the claim is present.
 */
export function assertInnovationClaim(idea: ResearchArtifact): void {
  if (idea.kind !== 'idea') throw new Error('innovation validation requires an idea artifact')
  const text = idea.content.toLowerCase()
  if (!text.includes('创新') && !text.includes('novel') && !text.includes('innovation')) {
    throw new Error('idea must state an innovation claim before review')
  }
}

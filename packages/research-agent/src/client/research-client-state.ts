/** Browser adapter for the research state vocabulary.
 *
 * The canonical coordinator lives in `dsh-workflow/research` on the Host. The
 * UI keeps this small pure reducer local so the browser bundle does not import
 * a Host package across the client bundle purity seam.
 */
import type {
  ResearchArtifact, ResearchDirectionWeights, ResearchNode, ResearchOutputInput, ResearchState,
} from '@deepseek-ai/dsh-workflow'

const DEFAULT_DIRECTION_WEIGHTS: ResearchDirectionWeights = {
  novelty: 30, impact: 25, feasibility: 25, reproducibility: 20,
}

const DEFAULT_DIRECTION_FOCUSES = ['method', 'data', 'theory', 'efficiency', 'application'] as const

/** Render a stable letter label for a numbered browser-side branch. */
function researchBranchLabel(branchNumber: number): string {
  let value = branchNumber
  let label = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    label = String.fromCharCode(65 + remainder) + label
    value = Math.floor((value - 1) / 26)
  }
  return label
}

/** Create the first paper-upload node for one browser tab.
 * @returns A new browser research state.
 */
export function createResearchState(): ResearchState {
  const root: ResearchNode = {
    nodeId: 'node-1', branchId: 'branch-1', stage: 'paper-upload', status: 'active', artifactRefs: [],
    memorySnapshot: {
      artifactIds: [], feedback: [], reviewerRoles: [],
      directionWeights: { ...DEFAULT_DIRECTION_WEIGHTS }, literatureSources: ['arxiv', 'openreview', 'semantic-scholar', 'acl-anthology', 'openalex'],
      directionFocuses: [...DEFAULT_DIRECTION_FOCUSES],
    },
  }
  return {
    nodes: { 'node-1': root },
    branches: { 'branch-1': { branchId: 'branch-1', label: '方案 A', nodeIds: ['node-1'] } },
    artifacts: {}, selectedNodeId: 'node-1', activeBranchId: 'branch-1',
    nextNodeNumber: 2, nextBranchNumber: 2, nextArtifactNumber: 1,
  }
}

/** Return the selected node.
 * @param state - Browser research state to inspect.
 * @returns The selected immutable node.
 */
export function selectedResearchNode(state: ResearchState): ResearchNode {
  const node = state.nodes[state.selectedNodeId]
  if (node === undefined) throw new Error(`research node "${state.selectedNodeId}" is missing`)
  return node
}

/** Append one browser-visible output to the selected branch.
 * @param state - Current browser state.
 * @param input - Stage output to append.
 * @param createdAt - Timestamp for the new artifact.
 * @returns The next browser state.
 */
export function appendResearchOutput(state: ResearchState, input: ResearchOutputInput, createdAt = Date.now()): ResearchState {
  const parent = selectedResearchNode(state)
  const artifactId = `artifact-${state.nextArtifactNumber}`
  const nodeId = `node-${state.nextNodeNumber}`
  const artifact: ResearchArtifact = {
    artifactId, kind: input.kind, title: input.title, content: input.content, createdAt,
    ...(input.source === undefined ? {} : { source: input.source }),
    ...(input.evaluation === undefined ? {} : { evaluation: input.evaluation }),
  }
  const branch = state.branches[state.activeBranchId]
  if (branch === undefined) throw new Error(`research branch "${state.activeBranchId}" is missing`)
  const node: ResearchNode = {
    nodeId, parentNodeId: parent.nodeId, branchId: state.activeBranchId, stage: input.stage,
    status: input.status ?? 'awaiting-confirmation', artifactRefs: [artifactId],
    memorySnapshot: { ...parent.memorySnapshot, artifactIds: [...parent.memorySnapshot.artifactIds, artifactId] },
  }
  return {
    ...state,
    nodes: { ...state.nodes, [nodeId]: node },
    branches: { ...state.branches, [branch.branchId]: { ...branch, nodeIds: [...branch.nodeIds, nodeId] } },
    artifacts: { ...state.artifacts, [artifactId]: artifact }, selectedNodeId: nodeId,
    nextNodeNumber: state.nextNodeNumber + 1, nextArtifactNumber: state.nextArtifactNumber + 1,
  }
}

/** Confirm the selected output.
 * @param state - Current browser state.
 * @returns The state with the selected node confirmed.
 */
export function confirmResearchNode(state: ResearchState): ResearchState {
  const node = selectedResearchNode(state)
  if (node.status !== 'active' && node.status !== 'awaiting-confirmation') return state
  return { ...state, nodes: { ...state.nodes, [node.nodeId]: { ...node, status: 'confirmed', userDecision: 'confirm' } } }
}

/** Add a user feedback note to the selected node memory.
 * @param state - Current browser state.
 * @param feedback - Feedback entered by the user.
 * @returns The next browser state.
 */
export function addResearchFeedback(state: ResearchState, feedback: string): ResearchState {
  const value = feedback.trim()
  if (value === '') return state
  const node = selectedResearchNode(state)
  return {
    ...state,
    nodes: { ...state.nodes, [node.nodeId]: {
      ...node, userDecision: 'feedback', userNote: value,
      memorySnapshot: { ...node.memorySnapshot, feedback: [...node.memorySnapshot.feedback, value] },
    } },
  }
}

/** Reject the current idea and start a new branch from the problem node.
 * @param state - Current browser state.
 * @param reason - Optional rejection reason.
 * @returns The next browser state with a new active branch.
 */
export function rejectIdea(state: ResearchState, reason = ''): ResearchState {
  const source = Object.values(state.nodes).find(node => node.stage === 'problem-summary')
  if (source === undefined) throw new Error('research problem summary is required before rejecting an idea')
  const branchId = `branch-${state.nextBranchNumber}`
  const nodeId = `node-${state.nextNodeNumber}`
  const node: ResearchNode = {
    nodeId, parentNodeId: source.nodeId, branchId, stage: 'idea-generation', status: 'active', artifactRefs: [],
    memorySnapshot: source.memorySnapshot,
    ...(reason.trim() === '' ? {} : { userNote: reason.trim() }),
  }
  return {
    ...state,
    nodes: { ...state.nodes, [nodeId]: node },
    branches: { ...state.branches, [branchId]: { branchId, label: `方案 ${researchBranchLabel(state.nextBranchNumber)}`, forkNodeId: source.nodeId, nodeIds: [source.nodeId, nodeId] } },
    activeBranchId: branchId, selectedNodeId: nodeId,
    nextNodeNumber: state.nextNodeNumber + 1, nextBranchNumber: state.nextBranchNumber + 1,
  }
}

/** Continue from a historical node by opening an isolated branch.
 * @param state - Current browser state.
 * @param nodeId - Historical node to fork from.
 * @returns The next browser state with a continuation branch.
 */
export function continueFromResearchNode(state: ResearchState, nodeId: string): ResearchState {
  const source = state.nodes[nodeId]
  if (source === undefined) throw new Error(`research node "${nodeId}" is missing`)
  const branchId = `branch-${state.nextBranchNumber}`
  const continuationId = `node-${state.nextNodeNumber}`
  const continuation: ResearchNode = {
    nodeId: continuationId, parentNodeId: source.nodeId, branchId, stage: source.stage, status: 'active',
    artifactRefs: source.artifactRefs, memorySnapshot: source.memorySnapshot,
  }
  return {
    ...state, nodes: { ...state.nodes, [continuationId]: continuation },
    branches: { ...state.branches, [branchId]: { branchId, label: `回溯 ${state.nextBranchNumber - 1}`, forkNodeId: source.nodeId, nodeIds: [source.nodeId, continuationId] } },
    activeBranchId: branchId, selectedNodeId: continuationId,
    nextNodeNumber: state.nextNodeNumber + 1, nextBranchNumber: state.nextBranchNumber + 1,
  }
}

/** Select a historical node without changing branch memory.
 * @param state - Current browser state.
 * @param nodeId - Node to display.
 * @returns The next browser state.
 */
export function selectResearchNode(state: ResearchState, nodeId: string): ResearchState {
  if (state.nodes[nodeId] === undefined) throw new Error(`research node "${nodeId}" is missing`)
  return { ...state, selectedNodeId: nodeId }
}

/** Select an existing branch without creating a continuation.
 * @param state - Current browser state.
 * @param branchId - Branch to display.
 * @returns The next browser state.
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

/** Require an explicit innovation claim in an idea artifact.
 * @param idea - Idea artifact to validate.
 * @returns Nothing when the claim is present.
 */
export function assertInnovationClaim(idea: ResearchArtifact): void {
  if (idea.kind !== 'idea') throw new Error('innovation validation requires an idea artifact')
  const text = idea.content.toLowerCase()
  if (!text.includes('创新') && !text.includes('novel') && !text.includes('innovation')) throw new Error('idea must state an innovation claim before review')
}

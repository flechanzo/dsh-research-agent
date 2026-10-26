import { describe, expect, it } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import {
  addResearchFeedback,
  appendResearchOutput,
  assertInnovationClaim,
  confirmResearchNode,
  continueFromResearchNode,
  createResearchState,
  markResearchPlanWritten,
  markResearchSessionBoundary,
  researchSourceSessionId,
  rejectIdea,
  researchBranchLabel,
  selectResearchNode,
  setResearchDirectionFocuses,
} from '../packages/research-agent/src/workflows/research.ts'

describe('research workflow state', () => {
  it('keeps generated branch labels unique beyond the alphabet', () => {
    expect(researchBranchLabel(1)).toBe('A')
    expect(researchBranchLabel(2)).toBe('B')
    expect(researchBranchLabel(26)).toBe('Z')
    expect(researchBranchLabel(27)).toBe('AA')
    expect(researchBranchLabel(52)).toBe('AZ')
    expect(researchBranchLabel(53)).toBe('BA')
  })

  it('keeps stage outputs visible and confirms them before continuation', () => {
    let state = createResearchState()
    state = appendResearchOutput(state, {
      stage: 'paper-read', kind: 'summary', title: '论文摘要', content: '摘要内容',
    })
    expect(state.nodes[state.selectedNodeId]?.status).toBe('awaiting-confirmation')
    state = confirmResearchNode(state)
    expect(state.nodes[state.selectedNodeId]?.userDecision).toBe('confirm')
  })

  it('marks the displayed final plan as written only after a valid path is returned', () => {
    let state = appendResearchOutput(createResearchState(), {
      stage: 'final-plan', kind: 'plan', title: '方案预览', content: '# 方案',
    })
    expect(() => markResearchPlanWritten(state, '  ')).toThrow('file name')
    expect(() => markResearchPlanWritten(createResearchState(), 'research-plan.md')).toThrow('plan artifact')
    state = appendResearchOutput(createResearchState(), {
      stage: 'paper-read', kind: 'summary', title: '摘要', content: '内容',
    })
    expect(() => markResearchPlanWritten(state, 'research-plan.md')).toThrow('plan artifact')
    state = appendResearchOutput(createResearchState(), {
      stage: 'final-plan', kind: 'plan', title: '方案预览', content: '# 方案',
    })
    const written = markResearchPlanWritten(state, ' workspace/research-plan.md ')
    expect(written.artifacts[written.nodes[written.selectedNodeId]?.artifactRefs[0] ?? '']?.source).toBe('workspace/research-plan.md')
    expect(markResearchPlanWritten(written, 'workspace/research-plan.md')).toBe(written)
  })

  it('stores at least one selected research focus in branch memory', () => {
    const state = setResearchDirectionFocuses(createResearchState(), ['method', 'application'])
    expect(state.nodes[state.selectedNodeId]?.memorySnapshot.directionFocuses).toEqual(['method', 'application'])
    expect(() => setResearchDirectionFocuses(state, [])).toThrow('at least one research direction focus')
  })

  it('rejects an idea into a new branch while preserving the original branch', () => {
    let state = createResearchState()
    state = appendResearchOutput(state, {
      stage: 'problem-summary', kind: 'problem', title: '问题', content: '问题内容',
    })
    state = appendResearchOutput(state, {
      stage: 'idea-generation', kind: 'idea', title: '方案 A', content: '创新点：A',
    })
    const oldBranch = state.activeBranchId
    state = rejectIdea(state, '缺少消融实验')
    expect(state.activeBranchId).not.toBe(oldBranch)
    expect(state.branches[state.activeBranchId]?.label).toBe('方案 B')
    expect(state.branches[oldBranch]?.nodeIds).toHaveLength(3)
    expect(state.nodes[state.selectedNodeId]?.stage).toBe('idea-generation')
    expect(state.nodes[state.selectedNodeId]?.userNote).toBe('缺少消融实验')
  })

  it('continues from history without mutating the source node', () => {
    let state = appendResearchOutput(createResearchState(), {
      stage: 'problem-summary', kind: 'problem', title: '问题', content: '问题内容',
    })
    const source = state.selectedNodeId
    state = continueFromResearchNode(state, source)
    expect(state.activeBranchId).toBe('branch-2')
    expect(state.nodes[source]?.branchId).toBe('branch-1')
    expect(state.nodes[state.selectedNodeId]?.parentNodeId).toBe(source)
  })

  it('records feedback and enforces an explicit innovation claim', () => {
    let state = appendResearchOutput(createResearchState(), {
      stage: 'idea-generation', kind: 'idea', title: '方案', content: 'innovation: gated retrieval',
    })
    state = addResearchFeedback(state, '加入基线比较')
    expect(state.nodes[state.selectedNodeId]?.memorySnapshot.feedback).toEqual(['加入基线比较'])
    expect(() => {
      assertInnovationClaim({
        artifactId: 'a', kind: 'idea', title: 'bad', content: '没有声明', createdAt: 0,
      })
    }).toThrow('innovation claim')
    expect(() => {
      assertInnovationClaim({
        artifactId: 'a', kind: 'idea', title: 'good', content: '创新点：动态检索', createdAt: 0,
      })
    }).not.toThrow()
  })

  it('preserves feedback as the decision when confirming a refinement', () => {
    let state = appendResearchOutput(createResearchState(), {
      stage: 'idea-refinement', kind: 'idea', title: '方案', content: 'innovation: gated retrieval',
    })
    state = addResearchFeedback(state, '补充消融实验')
    state = confirmResearchNode(state)
    expect(state.nodes[state.selectedNodeId]?.status).toBe('confirmed')
    expect(state.nodes[state.selectedNodeId]?.userDecision).toBe('feedback')
  })

  it('keeps the source status when continuing from history', () => {
    let state = appendResearchOutput(createResearchState(), {
      stage: 'problem-summary', kind: 'problem', title: '问题', content: '问题内容',
    })
    state = addResearchFeedback(state, '调整问题范围')
    state = confirmResearchNode(state)
    state = continueFromResearchNode(state, state.selectedNodeId)
    expect(state.nodes[state.selectedNodeId]?.status).toBe('confirmed')
    expect(state.nodes[state.selectedNodeId]?.userDecision).toBe('feedback')
  })

  it('continues any selected node without rewriting the source branch', () => {
    let state = createResearchState()
    state = appendResearchOutput(state, {
      stage: 'problem-summary', kind: 'problem', title: '问题', content: '问题内容',
    })
    const awaiting = state.selectedNodeId
    const sourceBranch = state.branches['branch-1']
    if (sourceBranch === undefined) throw new Error('source research branch is missing')
    const sourceSnapshot = { ...state.nodes[awaiting] }

    const continuedAwaiting = continueFromResearchNode(state, awaiting)
    expect(continuedAwaiting.nodes[awaiting]).toEqual(sourceSnapshot)
    expect(continuedAwaiting.nodes[continuedAwaiting.selectedNodeId]?.status).toBe('awaiting-confirmation')
    expect(continuedAwaiting.activeBranchId).toBe('branch-2')
    expect(continuedAwaiting.branches['branch-1']?.nodeIds).toEqual(sourceBranch.nodeIds)

    state = confirmResearchNode(continuedAwaiting)
    const confirmed = state.selectedNodeId
    state = appendResearchOutput(state, {
      stage: 'final-plan', kind: 'plan', title: '方案', content: '# 方案', status: 'completed',
    })
    const completed = state.selectedNodeId
    expect(state.nodes[confirmed]?.status).toBe('confirmed')

    const continuedCompleted = continueFromResearchNode(state, completed)
    expect(continuedCompleted.nodes[completed]?.status).toBe('completed')
    expect(continuedCompleted.nodes[continuedCompleted.selectedNodeId]?.parentNodeId).toBe(completed)
    expect(continuedCompleted.activeBranchId).toBe('branch-3')
    expect(continuedCompleted.branches['branch-2']?.nodeIds).toContain(continuedAwaiting.selectedNodeId)
  })

  it('selects a historical node without changing the active branch', () => {
    const state = appendResearchOutput(createResearchState(), {
      stage: 'paper-read', kind: 'summary', title: '摘要', content: '内容',
    })
    const selected = selectResearchNode(state, 'node-1')
    expect(selected.selectedNodeId).toBe('node-1')
    expect(selected.activeBranchId).toBe(state.activeBranchId)
  })

  it('copies a recorded Session boundary into a continuation branch', () => {
    let state = appendResearchOutput(createResearchState(), {
      stage: 'problem-summary', kind: 'problem', title: '问题', content: '问题内容',
    })
    state = markResearchSessionBoundary(state, 12, SessionId('source-session'))
    const source = state.selectedNodeId
    const continued = continueFromResearchNode(state, source)
    expect(state.nodes[source]?.sessionSeq).toBe(12)
    expect(state.nodes[source]?.sourceSessionId).toBe(SessionId('source-session'))
    expect(continued.nodes[continued.selectedNodeId]?.sessionSeq).toBe(12)
    expect(continued.nodes[continued.selectedNodeId]?.sourceSessionId).toBe(SessionId('source-session'))
    expect(() => markResearchSessionBoundary(state, -1)).toThrow('Session boundary')
  })

  it('keeps a copied future node bound to its source Session', () => {
    const sourceSessionId = SessionId('source-session')
    const childSessionId = SessionId('restored-session')
    let state = appendResearchOutput(createResearchState(), {
      stage: 'problem-summary', kind: 'problem', title: '问题', content: '问题内容',
    })
    state = markResearchSessionBoundary(state, 7, sourceSessionId)
    state = appendResearchOutput(state, {
      stage: 'idea-generation', kind: 'idea', title: '未来方案', content: '创新点：方案',
    })
    state = markResearchSessionBoundary(state, 13, sourceSessionId)
    const futureNode = state.nodes[state.selectedNodeId]
    if (futureNode === undefined) throw new Error('future research node is missing')
    const childState = continueFromResearchNode(state, futureNode.nodeId)
    const copiedNode = childState.nodes[childState.selectedNodeId]
    if (copiedNode === undefined) throw new Error('copied research node is missing')
    expect(copiedNode.sourceSessionId).toBe(sourceSessionId)
    expect(researchSourceSessionId(copiedNode, childSessionId)).toBe(sourceSessionId)
    expect(researchSourceSessionId({}, childSessionId)).toBe(childSessionId)
  })

})

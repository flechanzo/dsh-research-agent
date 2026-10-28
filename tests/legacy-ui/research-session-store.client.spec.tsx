// @vitest-environment jsdom
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { SessionSeq } from '@deepseek-ai/dsh-session/types'
import type { ResearchRemote } from 'dsh-research-agent/client'
import { appendResearchOutput, createResearchState } from '../../packages/research-agent/src/workflows/research.ts'
import type { TurnLocation } from '@deepseek-ai/dsh-client-ui-conversation/client'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '../support/translate.ts'
import { zh } from '../../packages/research-agent/src/client/locales.ts'
import { ResearchTranscriptMain } from '../../packages/research-agent/src/client/ResearchTranscriptMain.tsx'
import { ResearchBranchAction } from '../../packages/research-agent/src/client/ResearchBranchAction.tsx'
import {
  loadResearchSession,
  publishResearchSession,
  researchSessionSnapshot,
  subscribeResearchSession,
} from '../../packages/research-agent/src/client/research-session-store.ts'

afterEach(cleanup)

function state(content: string) {
  return appendResearchOutput(createResearchState(), {
    stage: 'paper-read', kind: 'summary', title: '摘要', content,
  })
}

const turn: TurnLocation = {
  turn: 1, status: 'closed', steps: [], end: undefined,
  start: { type: 'turn/start', seq: SessionSeq(1), time: 1, data: { turn: 1 } },
  data: { get: () => undefined, source: () => ({ getSnapshot: () => undefined, subscribe: () => () => {} }) },
}

describe('research session store', () => {
  it('keeps the newest revision when an older read completes later', () => {
    const sessionId = SessionId('research-store-revision')
    const listener = vi.fn()
    const dispose = subscribeResearchSession(sessionId, listener)

    publishResearchSession(sessionId, { sessionId, revision: 2, state: state('new') })
    publishResearchSession(sessionId, { sessionId, revision: 1, state: state('old') })

    expect(researchSessionSnapshot(sessionId)?.revision).toBe(2)
    expect(researchSessionSnapshot(sessionId)?.state.artifacts['artifact-1']?.content).toBe('new')
    expect(listener).toHaveBeenCalledOnce()
    dispose()
  })

  it('does not replace a snapshot with a different state at the same revision', () => {
    const sessionId = SessionId('research-store-equal-revision')
    const listener = vi.fn()
    const dispose = subscribeResearchSession(sessionId, listener)

    publishResearchSession(sessionId, { sessionId, revision: 2, state: state('first') })
    publishResearchSession(sessionId, { sessionId, revision: 2, state: state('second') })

    expect(researchSessionSnapshot(sessionId)?.state.artifacts['artifact-1']?.content).toBe('first')
    expect(listener).toHaveBeenCalledOnce()
    dispose()
  })

  it('publishes a remote read to every projection and returns the shared snapshot', async () => {
    const sessionId = SessionId('research-store-load')
    const listener = vi.fn()
    const dispose = subscribeResearchSession(sessionId, listener)
    const remote: Pick<ResearchRemote, 'read'> = {
      read: async () => ({ ok: true, value: { sessionId, revision: 3, state: state('loaded') } }),
    }

    const result = await loadResearchSession(remote, sessionId)

    expect(result).toEqual({ ok: true, value: researchSessionSnapshot(sessionId) })
    expect(researchSessionSnapshot(sessionId)?.state.artifacts['artifact-1']?.content).toBe('loaded')
    expect(listener).toHaveBeenCalledOnce()
    dispose()
  })

  it('keeps completed ancestors visible while viewing a historical node', async () => {
    const sessionId = SessionId('research-store-history-view')
    let historical = appendResearchOutput(createResearchState(), {
      stage: 'paper-read', kind: 'summary', title: '第一阶段', content: 'first',
    })
    historical = appendResearchOutput(historical, {
      stage: 'problem-summary', kind: 'problem', title: '第二阶段', content: 'second',
    })
    historical = appendResearchOutput(historical, {
      stage: 'literature-search', kind: 'literature', title: '第三阶段', content: 'third',
    })
    historical = { ...historical, selectedNodeId: 'node-2' }
    const remote: Pick<ResearchRemote, 'read' | 'selectNode'> = {
      read: async () => ({ ok: true, value: { sessionId, revision: 3, state: historical } }),
      selectNode: vi.fn(async () => ({
        ok: true as const,
        value: { snapshot: { sessionId, revision: 3, state: historical } },
      })),
    }

    const view = render(<ResearchTranscriptMain sessionId={sessionId} research={remote} t={makeTranslate(zh)} />)
    await waitFor(() => {
      expect(view.container.querySelectorAll('[data-research-main-node]')).toHaveLength(2)
    })
    expect(view.container.querySelector('[data-research-main-node="node-1"]')).toBeTruthy()
    expect(view.container.querySelector('[data-research-main-node="node-2"]')).toBeTruthy()
    expect(view.container.querySelector('[data-research-main-node="node-3"]')).toBeNull()

    const firstNode = view.container.querySelector('[data-research-main-node="node-1"]')
    expect(firstNode?.getAttribute('aria-expanded')).toBe('false')
    expect(firstNode?.getAttribute('data-expanded')).toBe('false')
    const contentNode = view.container.querySelector('[data-research-main-node="node-2"]')
    const content = contentNode?.querySelector('[data-research-main-content]')
    expect(content).toBeTruthy()
    expect(contentNode?.getAttribute('aria-expanded')).toBe('true')
    fireEvent.click(content as HTMLElement)
    expect(contentNode?.getAttribute('aria-expanded')).toBe('false')
    expect(contentNode?.getAttribute('data-expanded')).toBe('false')
    fireEvent.click(content as HTMLElement)
    expect(contentNode?.getAttribute('aria-expanded')).toBe('true')
    expect(contentNode?.getAttribute('data-expanded')).toBe('true')
  })

  it('keeps every completed stage visible after the final plan is selected', async () => {
    let completed = createResearchState()
    completed = appendResearchOutput(completed, {
      stage: 'paper-read', kind: 'summary', title: '读取', content: 'paper summary',
    })
    completed = appendResearchOutput(completed, {
      stage: 'problem-summary', kind: 'problem', title: '问题', content: 'research problem',
    })
    completed = appendResearchOutput(completed, {
      stage: 'final-plan', kind: 'plan', title: '方案', content: 'final plan',
    })
    const remote: Pick<ResearchRemote, 'read' | 'selectNode'> = {
      read: async () => ({ ok: true, value: { sessionId: SessionId('research-final-history'), revision: 3, state: completed } }),
      selectNode: vi.fn(),
    }

    const view = render(<ResearchTranscriptMain sessionId={SessionId('research-final-history')} research={remote} t={makeTranslate(zh)} />)
    await waitFor(() => {
      expect(view.container.querySelectorAll('[data-research-main-node]')).toHaveLength(4)
    })
    expect(view.getByText('paper summary')).toBeTruthy()
    expect(view.getByText('research problem')).toBeTruthy()
    expect(view.getByText('final plan')).toBeTruthy()
  })

  it('uses the research DAG branch action without opening a Conversation fork', async () => {
    const sessionId = SessionId('research-same-session-branch')
    let branchState = state('branch source')
    const source = branchState.nodes['node-2']
    if (source === undefined) throw new Error('expected research source node')
    branchState = {
      ...branchState,
      nodes: { ...branchState.nodes, [source.nodeId]: { ...source, sessionSeq: 10, sourceSessionId: sessionId } },
    }
    const continueFromNode = vi.fn(async () => ({
      ok: true as const,
      value: { snapshot: { sessionId, revision: 2, state: branchState } },
    }))
    const remote: Pick<ResearchRemote, 'read' | 'continueFromNode'> = {
      read: async () => ({ ok: true, value: { sessionId, revision: 1, state: branchState } }),
      continueFromNode,
    }

    const view = render(<ResearchBranchAction
      sessionId={sessionId}
      turn={turn}
      seq={12}
      branchUnavailable={false}
      research={remote}
      t={makeTranslate(zh)}
    />)
    const action = await view.findByRole('button', { name: zh['research.continue'] })
    fireEvent.click(action)
    await waitFor(() => {
      expect(continueFromNode).toHaveBeenCalledWith({ sessionId, expectedRevision: 1, nodeId: source.nodeId })
    })
  })
})

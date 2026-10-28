// @vitest-environment jsdom
import { brandString } from '@deepseek-ai/dsh-brand'
import type {
  SessionProjectionMap,
  SessionSnapshot,
} from '@deepseek-ai/dsh-api-session-controller/client'
import type { ResearchRemote } from 'dsh-research-agent/client'
import type { FileUploadService } from '@deepseek-ai/dsh-client-file-upload/client'
import type { UseSidebarRightTabInfo } from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type { GlobalStandardProps, SessionStandardProps } from '@deepseek-ai/dsh-client-ui-slots'
import type { PaneId, TabId } from '@deepseek-ai/dsh-client-ui-dockkit'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { appendResearchOutput, createResearchState } from '../../packages/research-agent/src/workflows/research.ts'
import type { ResearchCommandValue, ResearchSnapshot, ResearchState } from 'dsh-research-agent/client'
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeTranslate } from '../support/translate.ts'
import { SessionId } from '@deepseek-ai/dsh-session/types'
import { ResearchPanel } from '../../packages/research-agent/src/client/ResearchPanel.tsx'
import type { ResearchPanelProps } from '../../packages/research-agent/src/client/ResearchPanel.tsx'
import { zh } from '../../packages/research-agent/src/client/locales.ts'
import { publishResearchSession } from '../../packages/research-agent/src/client/research-session-store.ts'

declare module '@deepseek-ai/dsh-typert-protocol' {
  interface RemoteErrorDetailsMap {
    'research/stale': { readonly expected: number; readonly actual: number }
  }
}

afterEach(cleanup)

const paneId = brandString<PaneId>('research-pane')
const tabId = brandString<TabId>('research-tab')

const tabInfo: ReturnType<UseSidebarRightTabInfo> = {
  sidebar: { expanded: true, fullscreen: false },
  panel: { id: paneId },
  tab: {
    id: tabId,
    kind: 'research-workflow',
    contentId: 'research-workflow',
    title: 'Research',
    visible: true,
    navigation: { address: 'research-workflow', params: undefined, revision: 0 },
    signal: new AbortController().signal,
    actions: {
      bindCommands: () => () => {},
      openResource: () => {},
      openTab: () => {},
      close: () => {},
    },
  },
}

const useTabInfo: UseSidebarRightTabInfo = () => tabInfo

const sessionSnapshot: SessionSnapshot = {
  sessionId: SessionId('research-panel-session'),
  pendingSubmissions: [],
  running: false,
  subagent: null,
  removed: false,
  openState: 'open',
  openError: null,
  hasMore: false,
  loadingOlder: false,
  promptError: null,
  blank: false,
  lastAgentError: null,
  promptAttempted: false,
  awaitingFirstTurn: false,
}

const useSession: ResearchPanelProps['useSession'] = selector => selector(sessionSnapshot)

type ProjectionKey = Extract<keyof SessionProjectionMap, string>
function useProjection<K extends ProjectionKey>(key: K): SessionProjectionMap[K] | undefined
function useProjection<K extends ProjectionKey, Selected>(
  _key: K,
  selector: (value: SessionProjectionMap[K] | undefined) => Selected,
  equal?: (left: Selected, right: Selected) => boolean,
): Selected
function useProjection<K extends ProjectionKey, Selected>(
  _key: K,
  selector?: (value: SessionProjectionMap[K] | undefined) => Selected,
): SessionProjectionMap[K] | Selected | undefined {
  if (selector === undefined) return undefined
  return selector(undefined)
}

const unused = (): never => { throw new Error('This isolated component does not consume framework hooks') }
const standard: GlobalStandardProps & SessionStandardProps = {
  sessionId: SessionId('research-panel-standard'),
  useSession: unused,
  useProjection: unused,
  useConversation: unused,
  useInput: unused,
  useChat: unused,
  useTrajectory: unused,
  usePanelInfo: unused,
  useSessions: unused,
  useSessionStatus: unused,
  useSessionRetainInfo: unused,
  useResource: unused,
  useWorkspaces: unused,
  inputActions: {
    captureInsertion: unused,
    insertText: unused,
    setDraft: unused,
    addAttachments: unused,
    removeAttachment: unused,
    pruneAttachments: unused,
    submit: unused,
  },
}

function panelState(stage: 'paper-read' | 'simulation-or-final-plan' | 'final-plan' = 'paper-read'): ResearchState {
  let state = appendResearchOutput(createResearchState(), {
    stage,
    kind: stage === 'final-plan' ? 'plan' : 'summary',
    title: stage === 'final-plan' ? '最终方案' : stage === 'simulation-or-final-plan' ? '执行选择' : '论文摘要',
    content: stage === 'final-plan' ? '# final plan' : 'paper summary',
    status: stage === 'final-plan' ? 'completed' : 'confirmed',
  })
  if (stage === 'paper-read') {
    state = appendResearchOutput(state, {
      stage: 'problem-summary',
      kind: 'problem',
      title: '研究问题',
      content: 'research problem',
      status: 'confirmed',
    })
  }
  return state
}

function commandResult(sessionId: SessionId, revision: number, state: ResearchState): RemoteResult<ResearchCommandValue> {
  return { ok: true, value: { snapshot: { sessionId, revision, state } } }
}

function researchRemote(
  sessionId: SessionId,
  state: ResearchState,
  continueFromNode: ResearchRemote['continueFromNode'],
): ResearchRemote {
  const snapshot: ResearchSnapshot = { sessionId, revision: 1, state }
  const command = async (): Promise<RemoteResult<ResearchCommandValue>> => commandResult(sessionId, 2, state)
  return {
    read: async () => ({ ok: true, value: snapshot }),
    confirm: command,
    continueFromNode,
    feedback: command,
    reject: command,
    restore: command,
    selectBranch: command,
    selectNode: command,
    upload: command,
  }
}

const fileUpload: FileUploadService = { upload: vi.fn() }


function renderPanel(
  sessionId: SessionId,
  state: ResearchState,
  continueFromNode: ResearchRemote['continueFromNode'],
) {
  const remote = researchRemote(sessionId, state, continueFromNode)
  publishResearchSession(sessionId, { sessionId, revision: 1, state })
  const view = render(
    <ResearchPanel
      {...standard}
      sessionId={sessionId}
      useTabInfo={useTabInfo}
      research={remote}
      fileUpload={fileUpload}
      useSession={useSession}
      useProjection={useProjection}
      t={makeTranslate(zh)}
    />,
  )
  return { view, remote }
}

describe('ResearchPanel branch action', () => {
  it('shows and calls continueFromNode for the current branch tail', async () => {
    const sessionId = SessionId('research-panel-tail')
    const state = panelState()
    const continueFromNode = vi.fn(async () => commandResult(sessionId, 2, state))
    const { view } = renderPanel(sessionId, state, continueFromNode)

    const action = await view.findByRole('button', { name: zh['research.continue'] })
    expect(action.hasAttribute('disabled')).toBe(false)
    fireEvent.click(action)
    await waitFor(() => {
      expect(continueFromNode).toHaveBeenCalledWith({
        sessionId,
        expectedRevision: 1,
        nodeId: state.selectedNodeId,
      })
    })
  })

  it('shows and calls continueFromNode for historical and final-plan nodes', async () => {
    const historicalSession = SessionId('research-panel-history')
    const historical = panelState()
    const historicalNodeId = 'node-2'
    const historicalState = { ...historical, selectedNodeId: historicalNodeId }
    const continueFromHistorical = vi.fn(async () => commandResult(historicalSession, 2, historicalState))
    const historicalView = renderPanel(historicalSession, historicalState, continueFromHistorical).view
    const historicalAction = await historicalView.findByRole('button', { name: zh['research.continue'] })
    fireEvent.click(historicalAction)
    await waitFor(() => {
      expect(continueFromHistorical).toHaveBeenCalledWith({
        sessionId: historicalSession,
        expectedRevision: 1,
        nodeId: historicalNodeId,
      })
    })

    cleanup()
    const finalSession = SessionId('research-panel-final')
    const finalState = panelState('final-plan')
    const continueFromFinal = vi.fn(async () => commandResult(finalSession, 2, finalState))
    const finalView = renderPanel(finalSession, finalState, continueFromFinal).view
    const finalAction = await finalView.findByRole('button', { name: zh['research.continue'] })
    expect(finalAction.hasAttribute('disabled')).toBe(false)
    fireEvent.click(finalAction)
    await waitFor(() => {
      expect(continueFromFinal).toHaveBeenCalledWith({
        sessionId: finalSession,
        expectedRevision: 1,
        nodeId: finalState.selectedNodeId,
      })
    })
  })

  it('keeps the action after a continue request fails', async () => {
    const sessionId = SessionId('research-panel-failure')
    const state = panelState()
    const failure = new RemoteError('research/stale', 'stale research state', { expected: 1, actual: 2 })
    const continueFromNode = vi.fn(async (): Promise<RemoteResult<ResearchCommandValue>> => ({ ok: false, error: failure }))
    const { view } = renderPanel(sessionId, state, continueFromNode)
    const action = await view.findByRole('button', { name: zh['research.continue'] })
    fireEvent.click(action)
    await waitFor(() => {
      expect(view.getByRole('alert').textContent).toContain(zh['research.error.stale'])
    })
    expect(view.getByRole('button', { name: zh['research.continue'] }).hasAttribute('disabled')).toBe(false)
    expect(continueFromNode).toHaveBeenCalledOnce()
  })

  it('disables simulation when the Host does not advertise an adapter', async () => {
    const sessionId = SessionId('research-panel-no-simulation')
    const state = panelState('simulation-or-final-plan')
    const continueFromNode = vi.fn(async () => commandResult(sessionId, 2, state))
    const { view } = renderPanel(sessionId, state, continueFromNode)

    const simulation = await view.findByRole('button', { name: zh['research.simulate'] })
    expect(simulation.hasAttribute('disabled')).toBe(true)
    expect(view.getByText(zh['research.simulationUnavailable'])).toBeTruthy()
    expect(view.getByRole('button', { name: zh['research.plan'] }).hasAttribute('disabled')).toBe(false)
  })
})

it('F01 refreshes the committed revision after export failure and permits the next command',async()=>{
 const sessionId=SessionId('F01-panel');const state=panelState();let revision=1
 const command=vi.fn(async()=>{revision++;return {ok:false as const,error:new RemoteError('research/stale','disk full after commit',{expected:revision-1,actual:revision})}})
 publishResearchSession(sessionId,{sessionId,revision:1,state})
 const remote=researchRemote(sessionId,state,command)
 remote.read=vi.fn(async()=>({ok:true as const,value:{sessionId,revision,state}}))
 const view=render(<ResearchPanel {...standard} sessionId={sessionId} useTabInfo={useTabInfo} research={remote} fileUpload={fileUpload} t={makeTranslate(zh)}/> )
 const button=await view.findByRole('button',{name:zh['research.continue']})
 fireEvent.click(button)
 await view.findByRole('alert')
 await waitFor(()=>expect(button.hasAttribute('disabled')).toBe(false))
 fireEvent.click(button)
 await waitFor(()=>expect(command).toHaveBeenLastCalledWith({sessionId,expectedRevision:2,nodeId:state.selectedNodeId}))
})

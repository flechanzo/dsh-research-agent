// @vitest-environment jsdom
import {cleanup,fireEvent,render,waitFor} from '@testing-library/react'
import {afterEach,it,expect,vi} from 'vitest'
import {SessionId} from '@deepseek-ai/dsh-session'
import {appendResearchOutput,createResearchState,continueFromResearchNode} from '../packages/research-agent/src/workflows/research.ts'
import {ResearchFlowCanvas} from '../packages/research-agent/src/client/ResearchFlowCanvas.tsx'
import {ResearchTranscriptMain} from '../packages/research-agent/src/client/ResearchTranscriptMain.tsx'
import {ResearchBranchSelector} from '../packages/research-agent/src/client/ResearchBranchSelector.tsx'
import {makeTranslate} from './support/translate.ts'
import {useResearchSession} from '../packages/research-agent/src/client/research-session-store.ts'
import {zh} from '../packages/research-agent/src/client/locales.ts'
afterEach(cleanup)
const state=()=>continueFromResearchNode(appendResearchOutput(createResearchState(),{stage:'paper-read',kind:'summary',title:'Source',content:'UNIQUE_ARTIFACT_TEXT'}),'node-2')
it('F04 gives the owned branch root a badge and keeps it when collapsed',()=>{
 let s=state();const root=s.selectedNodeId;s=appendResearchOutput(s,{stage:'problem-summary',kind:'problem',title:'Child',content:'child'})
 const props={state:s,selectedNodeId:s.selectedNodeId,activeBranchId:s.activeBranchId,stageText:(x:string)=>x,statusText:(x:string)=>x,emptyArtifact:'empty',currentLabel:'current',nodeCountLabel:(n:number)=>String(n),branchViewLabel:'tree',expandLabel:'expand',collapseLabel:'collapse',zoomInLabel:'in',zoomOutLabel:'out',fitViewLabel:'fit',restoreLayoutLabel:'restore',layoutScope:'F04',onToggleBranch:vi.fn(),onSelectNode:vi.fn(),onSelectBranch:vi.fn(),onExpandAll:vi.fn(),onCollapseAll:vi.fn()}
 const view=render(<ResearchFlowCanvas {...props} collapsedBranchIds={new Set()}/> )
 const node=view.container.querySelector(`[data-research-node="${root}"]`)
 expect(node?.textContent).toContain('回溯 1')
 expect(node?.querySelector('[aria-label="collapse"]')).toBeTruthy()
 view.rerender(<ResearchFlowCanvas {...props} collapsedBranchIds={new Set(['branch-2'])}/> )
 expect(view.container.querySelector(`[data-research-node="${root}"]`)).toBeTruthy()
 expect(view.container.querySelector(`[data-research-node="${s.selectedNodeId}"]`)).toBeNull()
})
it('F06 renders inherited artifact text only once while keeping the continuation node',async()=>{
 const s=state();const sessionId=SessionId('F06');const remote={read:async()=>({ok:true as const,value:{sessionId,revision:1,state:s}}),selectNode:vi.fn()}
 const view=render(<ResearchTranscriptMain sessionId={sessionId} research={remote} t={makeTranslate(zh)}/> )
 await waitFor(()=>expect(view.container.querySelectorAll('[data-research-main-node]')).toHaveLength(3))
 expect(view.getAllByText('UNIQUE_ARTIFACT_TEXT')).toHaveLength(1)
})
it('F08 shows branch selection failure without hiding existing branches',async()=>{
 const s=state();const sessionId=SessionId('F08');const remote={read:async()=>({ok:true as const,value:{sessionId,revision:1,state:s}}),selectBranch:vi.fn(async()=>({ok:false as const,error:{code:'research/stale',message:'conflict',details:{expected:1,actual:2}}}))}
 const view=render(<ResearchBranchSelector sessionId={sessionId} viewId="chat" research={remote} t={makeTranslate(zh)}/> )
 fireEvent.change(await view.findByRole('combobox'),{target:{value:'branch-1'}})
 expect(await view.findByRole('alert')).toBeTruthy()
 expect(view.getByRole('combobox')).toBeTruthy()
})

it('F08 reloads the authoritative revision on remount and window focus', async () => {
  const sessionId = SessionId('F08-remount-focus')
  let revision = 1
  const remote = { read: vi.fn(async () => ({ ok: true as const, value: { sessionId, revision, state: createResearchState() } })) }
  function Projection() {
    const snapshot = useResearchSession(remote, sessionId)
    return <span data-testid="revision">{snapshot?.revision}</span>
  }
  const first = render(<Projection />)
  await waitFor(() => expect(first.getByTestId('revision').textContent).toBe('1'))
  first.unmount()
  revision = 2
  const second = render(<Projection />)
  await waitFor(() => expect(second.getByTestId('revision').textContent).toBe('2'))
  revision = 3
  fireEvent.focus(window)
  await waitFor(() => expect(second.getByTestId('revision').textContent).toBe('3'))
  expect(remote.read).toHaveBeenCalledTimes(3)
})

it('F19 keeps a corrupt cyclic graph renderable without recursive layout', () => {
  const cyclic = createResearchState()
  const root = cyclic.nodes['node-1']
  if (root === undefined) throw new Error('expected initial research node')
  const state = {
    ...cyclic,
    selectedNodeId: root.nodeId,
    nodes: { ...cyclic.nodes, [root.nodeId]: { ...root, parentNodeId: root.nodeId } },
  }
  const view = render(
    <ResearchFlowCanvas
      state={state}
      selectedNodeId={state.selectedNodeId}
      activeBranchId={state.activeBranchId}
      stageText={stage => stage}
      statusText={status => status}
      emptyArtifact="empty"
      currentLabel="current"
      nodeCountLabel={count => `${count} nodes`}
      branchViewLabel="tree"
      expandLabel="expand"
      collapseLabel="collapse"
      zoomInLabel="zoom in"
      zoomOutLabel="zoom out"
      fitViewLabel="fit"
      restoreLayoutLabel="restore"
      collapsedBranchIds={new Set()}
      onToggleBranch={vi.fn()}
      onSelectNode={vi.fn()}
      onSelectBranch={vi.fn()}
      onExpandAll={vi.fn()}
      onCollapseAll={vi.fn()}
    />,
  )
  expect(view.container.querySelector('[data-flow-canvas]')).toBeTruthy()
})

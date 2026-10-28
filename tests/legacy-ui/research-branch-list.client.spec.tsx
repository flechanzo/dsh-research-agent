// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import { appendResearchOutput, createResearchState, rejectIdea } from '../../packages/research-agent/src/workflows/research.ts'
import { zh, type WorkflowRunKey } from '../../packages/research-agent/src/client/locales.ts'
import { ResearchBranchList } from '../../packages/research-agent/src/client/ResearchBranchList.tsx'

afterEach(cleanup)

const t: TranslateNS<'workflowRun'> = ((key: WorkflowRunKey, values?: Readonly<Record<string, string | number>>) => {
  const text = zh[key]
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? `{${name}}`))
}) as TranslateNS<'workflowRun'>

function graphWithBranch() {
  let state = appendResearchOutput(createResearchState(), {
    stage: 'paper-read', kind: 'summary', title: '读取', content: 'paper summary', status: 'confirmed',
  })
  state = appendResearchOutput(state, {
    stage: 'problem-summary', kind: 'problem', title: '问题', content: 'research problem', status: 'confirmed',
  })
  state = appendResearchOutput(state, {
    stage: 'idea-generation', kind: 'idea', title: '想法', content: 'candidate idea', status: 'awaiting-confirmation',
  })
  return rejectIdea(state, 'try another direction')
}

function renderList(selectedNodeId?: string) {
  const state = graphWithBranch()
  const onSelectNode = vi.fn()
  const onLocateNode = vi.fn()
  const view = render(
    <ResearchBranchList
      state={state}
      selectedNodeId={selectedNodeId ?? state.selectedNodeId}
      stageText={stage => stage}
      statusText={status => status}
      emptyArtifact="empty"
      t={t}
      onSelectNode={onSelectNode}
      onLocateNode={onLocateNode}
    />,
  )
  return { state, view, onSelectNode, onLocateNode }
}

describe('ResearchBranchList', () => {
  it('renders parent-child rows from node relationships and keeps shared ancestors', () => {
    const { view } = renderList()
    expect(view.container.querySelectorAll('[data-research-node]')).toHaveLength(5)
    expect(view.container.querySelector('[data-research-node="node-3"]')?.textContent).toContain('1.1.1')
    expect(view.container.querySelector('[data-research-node="node-5"]')?.textContent).toContain('1.1.1.2')
  })

  it('supports independent collapse, search, status filtering, and node actions', () => {
    const { state, view, onSelectNode, onLocateNode } = renderList('node-1')
    const problemRow = view.container.querySelector('[data-research-node="node-3"]') as HTMLElement
    fireEvent.click(problemRow.querySelector('button') as HTMLElement)
    expect(view.container.querySelector('[data-research-node="node-4"]')).toBeNull()
    expect(view.container.querySelector('[data-research-node="node-5"]')).toBeNull()

    const search = view.getByRole('textbox')
    fireEvent.change(search, { target: { value: 'candidate' } })
    expect(view.container.querySelector('[data-research-node="node-3"]')).toBeTruthy()
    expect(view.container.querySelector('[data-research-node="node-4"]')).toBeTruthy()
    expect(view.container.querySelector('[data-research-node="node-5"]')).toBeNull()

    fireEvent.click(view.container.querySelector('[data-research-node="node-4"]') as HTMLElement)
    expect(onSelectNode).toHaveBeenCalledWith('node-4')
    fireEvent.change(search, { target: { value: '' } })
    fireEvent.click(view.container.querySelector('[data-research-node="node-3"] button') as HTMLElement)
    const node5 = view.container.querySelector('[data-research-node="node-5"]') as HTMLElement
    fireEvent.click(node5.querySelectorAll('button')[node5.querySelectorAll('button').length - 1] as HTMLElement)
    expect(onLocateNode).toHaveBeenCalledWith('node-5')
    expect(state.nodes['node-5']?.status).toBe('active')
  })
})

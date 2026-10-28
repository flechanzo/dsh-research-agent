// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  appendResearchOutput,
  createResearchState,
  rejectIdea,
} from '../../packages/research-agent/src/workflows/research.ts'
import { ResearchFlowCanvas } from '../../packages/research-agent/src/client/ResearchFlowCanvas.tsx'

afterEach(cleanup)

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

describe('ResearchFlowCanvas', () => {
  it('lays out shared ancestors once and connects every dynamic branch', () => {
    const state = graphWithBranch()
    const onSelectNode = vi.fn()
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
        fitViewLabel="fit view"
        restoreLayoutLabel="restore automatic layout"
        layoutScope="test-session"
        collapsedBranchIds={new Set()}
        onToggleBranch={vi.fn()}
        onSelectNode={onSelectNode}
        onSelectBranch={vi.fn()}
        onExpandAll={vi.fn()}
        onCollapseAll={vi.fn()}
      />,
    )

    expect(view.container.querySelectorAll('[data-research-node]')).toHaveLength(5)
    expect(view.container.querySelectorAll('path')).toHaveLength(4)
    fireEvent.click(view.container.querySelector('[data-research-node="node-2"] button') as HTMLElement)
    expect(onSelectNode).toHaveBeenCalledWith('node-2')
  })

  it('keeps the branch root and hides descendants when a branch is collapsed', () => {
    const state = graphWithBranch()
    const collapsed = new Set(['branch-1'])
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
        fitViewLabel="fit view"
        restoreLayoutLabel="restore automatic layout"
        layoutScope="test-session-collapsed"
        collapsedBranchIds={collapsed}
        onToggleBranch={vi.fn()}
        onSelectNode={vi.fn()}
        onSelectBranch={vi.fn()}
        onExpandAll={vi.fn()}
        onCollapseAll={vi.fn()}
      />,
    )

    expect(view.container.querySelector('[data-research-node="node-1"]')).toBeTruthy()
    expect(view.container.querySelector('[data-research-node="node-2"]')).toBeNull()
    expect(view.container.querySelector('[data-research-node="node-5"]')).toBeNull()
  })

  it('pans the canvas without selecting a node', () => {
    const state = graphWithBranch()
    const onSelectNode = vi.fn()
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
        fitViewLabel="fit view"
        restoreLayoutLabel="restore automatic layout"
        layoutScope="test-pan"
        collapsedBranchIds={new Set()}
        onToggleBranch={vi.fn()}
        onSelectNode={onSelectNode}
        onSelectBranch={vi.fn()}
        onExpandAll={vi.fn()}
        onCollapseAll={vi.fn()}
      />,
    )
    const canvas = view.container.querySelector('[role="tree"]') as HTMLElement
    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 20, clientY: 20 })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 70, clientY: 45 })
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 70, clientY: 45 })
    expect(view.container.querySelector('[data-research-node="node-2"]')).toBeTruthy()
    expect(onSelectNode).not.toHaveBeenCalled()
    expect(view.container.querySelector('[data-flow-canvas]')?.getAttribute('data-dragging')).toBe('false')
  })

  it('keeps a node click intact until the drag threshold is crossed', () => {
    const state = graphWithBranch()
    const onSelectNode = vi.fn()
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
        fitViewLabel="fit view"
        restoreLayoutLabel="restore automatic layout"
        layoutScope="test-node-click"
        collapsedBranchIds={new Set()}
        onToggleBranch={vi.fn()}
        onSelectNode={onSelectNode}
        onSelectBranch={vi.fn()}
        onExpandAll={vi.fn()}
        onCollapseAll={vi.fn()}
      />,
    )
    const canvas = view.container.querySelector('[role="tree"]') as HTMLElement
    const node = view.container.querySelector('[data-research-node="node-2"]') as HTMLElement
    const title = node.querySelector('button > span:nth-child(2)') as HTMLElement
    const setPointerCapture = vi.fn()
    Object.defineProperty(canvas, 'setPointerCapture', { configurable: true, value: setPointerCapture })
    fireEvent.pointerDown(title, { button: 0, pointerId: 4, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(canvas, { pointerId: 4, clientX: 103, clientY: 102 })
    fireEvent.pointerUp(title, { pointerId: 4, clientX: 103, clientY: 102 })
    fireEvent.click(title)
    expect(setPointerCapture).not.toHaveBeenCalled()
    expect(onSelectNode).toHaveBeenCalledWith('node-2')
    onSelectNode.mockClear()
    fireEvent.click(node.querySelector('[data-status]') as HTMLElement)
    expect(onSelectNode).toHaveBeenCalledWith('node-2')
  })

  it('moves a node and suppresses selection for a drag while keeping clicks selectable', () => {
    const state = graphWithBranch()
    const onSelectNode = vi.fn()
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
        fitViewLabel="fit view"
        restoreLayoutLabel="restore automatic layout"
        layoutScope="test-node-drag"
        collapsedBranchIds={new Set()}
        onToggleBranch={vi.fn()}
        onSelectNode={onSelectNode}
        onSelectBranch={vi.fn()}
        onExpandAll={vi.fn()}
        onCollapseAll={vi.fn()}
      />,
    )
    const node = view.container.querySelector('[data-research-node="node-2"]') as HTMLElement
    const button = node.querySelector('button') as HTMLElement
    const originalLeft = node.style.left
    fireEvent.pointerDown(button, { button: 0, pointerId: 2, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(view.container.querySelector('[role="tree"]') as HTMLElement, { pointerId: 2, clientX: 140, clientY: 125 })
    fireEvent.pointerUp(view.container.querySelector('[role="tree"]') as HTMLElement, { pointerId: 2, clientX: 140, clientY: 125 })
    fireEvent.click(button)
    expect(node.style.left).not.toBe(originalLeft)
    expect(onSelectNode).not.toHaveBeenCalled()
    expect(window.localStorage.getItem('dsh:research-flow-layout:v1:test-node-drag')).toContain('node-2')
    fireEvent.click(button)
    expect(onSelectNode).toHaveBeenCalledWith('node-2')
  })

  it('restores automatic positions after a manual node move', () => {
    const state = graphWithBranch()
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
        fitViewLabel="fit view"
        restoreLayoutLabel="restore automatic layout"
        layoutScope="test-restore"
        collapsedBranchIds={new Set()}
        onToggleBranch={vi.fn()}
        onSelectNode={vi.fn()}
        onSelectBranch={vi.fn()}
        onExpandAll={vi.fn()}
        onCollapseAll={vi.fn()}
      />,
    )
    const canvas = view.container.querySelector('[role="tree"]') as HTMLElement
    const node = view.container.querySelector('[data-research-node="node-2"]') as HTMLElement
    const originalLeft = node.style.left
    fireEvent.pointerDown(node.querySelector('button') as HTMLElement, { button: 0, pointerId: 3, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(canvas, { pointerId: 3, clientX: 180, clientY: 100 })
    fireEvent.pointerUp(canvas, { pointerId: 3, clientX: 180, clientY: 100 })
    const restore = view.getByRole('button', { name: 'restore automatic layout' })
    fireEvent.click(restore)
    expect((view.container.querySelector('[data-research-node="node-2"]') as HTMLElement).style.left).toBe(originalLeft)
  })
})

import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent, type ReactNode, type WheelEvent } from 'react'
import type {
  ResearchNode,
  ResearchNodeStatus,
  ResearchStage,
  ResearchState,
} from 'dsh-research-agent/client'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './ResearchFlowCanvas.module.css'

const NODE_WIDTH = 224
const NODE_HEIGHT = 100
const HORIZONTAL_GAP = 84
const VERTICAL_GAP = 32
const MIN_ZOOM = 0.55
const MAX_ZOOM = 1.45
const DRAG_THRESHOLD = 5
const DEFAULT_PAN = { x: 26, y: 26 }
const DEFAULT_PAN_WITH_ZOOM = { ...DEFAULT_PAN, zoom: 1 }
const LAYOUT_STORAGE_PREFIX = 'dsh:research-flow-layout:v1:'

const BRANCH_COLORS = [
  '#4f9cff',
  '#36c98f',
  '#f3a847',
  '#a77bff',
  '#e978a8',
] as const

/** Props for the data-driven research DAG canvas. */
export interface ResearchFlowCanvasProps {
  /** Current durable research graph. */
  readonly state: ResearchState
  /** Node selected by the surrounding panel. */
  readonly selectedNodeId: string
  /** Branch receiving new workflow output. */
  readonly activeBranchId: string
  /** Localized stage label renderer. */
  readonly stageText: (stage: ResearchStage) => string
  /** Localized status label renderer. */
  readonly statusText: (status: ResearchNodeStatus) => string
  /** Localized empty artifact copy. */
  readonly emptyArtifact: string
  /** Localized current branch label. */
  readonly currentLabel: string
  /** Localized node count renderer. */
  readonly nodeCountLabel: (count: number) => string
  /** Accessible label for the flow view. */
  readonly branchViewLabel: string
  /** Localized expand copy. */
  readonly expandLabel: string
  /** Localized collapse copy. */
  readonly collapseLabel: string
  /** Localized zoom-in action label. */
  readonly zoomInLabel: string
  /** Localized zoom-out action label. */
  readonly zoomOutLabel: string
  /** Localized fit-to-view action label. */
  readonly fitViewLabel: string
  /** Localized automatic-layout reset action label. */
  readonly restoreLayoutLabel: string
  /** Stable Session/project scope for visual layout persistence. */
  readonly layoutScope?: string
  /** Branches currently collapsed by the parent panel. */
  readonly collapsedBranchIds: ReadonlySet<string>
  /** Toggle one branch's descendants. */
  readonly onToggleBranch: (branchId: string) => void
  /** Select one node in the shared research state. */
  readonly onSelectNode: (nodeId: string) => void
  /** Select one branch in the shared research state. */
  readonly onSelectBranch: (branchId: string) => void
  /** Expand every branch. */
  readonly onExpandAll: () => void
  /** Collapse every branch. */
  readonly onCollapseAll: () => void
  /** Disable mutations while a Remote command is running. */
  readonly disabled?: boolean
}

interface Point {
  readonly x: number
  readonly y: number
}

interface Viewport {
  readonly x: number
  readonly y: number
  readonly zoom: number
}

interface SavedLayout {
  readonly positions: Readonly<Record<string, Point>>
  readonly viewport?: Viewport
}

interface FlowLayout {
  readonly nodes: readonly ResearchNode[]
  readonly children: ReadonlyMap<string, readonly ResearchNode[]>
  readonly positions: ReadonlyMap<string, Point>
  readonly width: number
  readonly height: number
}

function branchColor(branchId: string): string {
  let hash = 0
  for (const character of branchId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return BRANCH_COLORS[hash % BRANCH_COLORS.length] ?? BRANCH_COLORS[0]
}

function layoutStorageKey(scope: string): string {
  return `${LAYOUT_STORAGE_PREFIX}${encodeURIComponent(scope)}`
}

function readSavedLayout(scope: string): SavedLayout {
  if (typeof window === 'undefined') return { positions: {} }
  try {
    const raw = window.localStorage.getItem(layoutStorageKey(scope))
    if (raw === null) return { positions: {} }
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') return { positions: {} }
    const record = parsed as { positions?: unknown; viewport?: unknown }
    const positions: Record<string, Point> = {}
    if (record.positions !== null && typeof record.positions === 'object') {
      for (const [nodeId, value] of Object.entries(record.positions)) {
        if (value === null || typeof value !== 'object') continue
        const point = value as { x?: unknown; y?: unknown }
        if (typeof point.x !== 'number' || !Number.isFinite(point.x) || typeof point.y !== 'number' || !Number.isFinite(point.y)) continue
        positions[nodeId] = { x: point.x, y: point.y }
      }
    }
    const viewport = record.viewport
    if (viewport !== null && typeof viewport === 'object') {
      const value = viewport as { x?: unknown; y?: unknown; zoom?: unknown }
      if (typeof value.x === 'number' && Number.isFinite(value.x) && typeof value.y === 'number' && Number.isFinite(value.y) && typeof value.zoom === 'number' && Number.isFinite(value.zoom)) {
        return { positions, viewport: { x: value.x, y: value.y, zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value.zoom)) } }
      }
    }
    return { positions }
  } catch (error) {
    void error
    return { positions: {} }
  }
}

function writeSavedLayout(scope: string, positions: Readonly<Record<string, Point>>, viewport: Viewport): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(layoutStorageKey(scope), JSON.stringify({ positions, viewport } satisfies SavedLayout))
  } catch (error) {
    void error
  }
}

function artifactTitle(state: ResearchState, node: ResearchNode, emptyArtifact: string): string {
  const artifactId = node.artifactRefs.at(-1)
  return artifactId === undefined ? emptyArtifact : (state.artifacts[artifactId]?.title ?? emptyArtifact)
}

function nodeNumber(nodes: readonly ResearchNode[], nodeId: string): number {
  const index = nodes.findIndex(node => node.nodeId === nodeId)
  return index < 0 ? 0 : index + 1
}

function nodeDepth(state: ResearchState, node: ResearchNode): number {
  let depth = 1
  let parentId = node.parentNodeId
  const visited = new Set<string>([node.nodeId])
  while (parentId !== undefined && !visited.has(parentId)) {
    visited.add(parentId)
    depth += 1
    parentId = state.nodes[parentId]?.parentNodeId
  }
  return depth
}

function isHiddenByCollapse(
  state: ResearchState,
  node: ResearchNode,
  collapsed: ReadonlySet<string>,
): boolean {
  const ownBranch = state.branches[node.branchId]
  const ownFirstNode = ownBranch?.nodeIds.find(id => state.nodes[id]?.branchId === node.branchId)
  if (collapsed.has(node.branchId) && ownFirstNode !== undefined && node.nodeId !== ownFirstNode) return true
  let ancestor = node.parentNodeId === undefined ? undefined : state.nodes[node.parentNodeId]
  const visited = new Set<string>([node.nodeId])
  while (ancestor !== undefined && !visited.has(ancestor.nodeId)) {
    visited.add(ancestor.nodeId)
    const branch = state.branches[ancestor.branchId]
    const firstNode = branch?.nodeIds.find(id => state.nodes[id]?.branchId === ancestor?.branchId)
    if (collapsed.has(ancestor.branchId) && firstNode === ancestor.nodeId) return true
    ancestor = ancestor.parentNodeId === undefined ? undefined : state.nodes[ancestor.parentNodeId]
  }
  return false
}

function calculateLayout(state: ResearchState, collapsed: ReadonlySet<string>): FlowLayout {
  const allNodes = Object.values(state.nodes)
  const nodes = allNodes.filter(node => !isHiddenByCollapse(state, node, collapsed))
  const visibleIds = new Set(nodes.map(node => node.nodeId))
  const children = new Map<string, ResearchNode[]>()
  for (const node of nodes) {
    if (node.parentNodeId === undefined || !visibleIds.has(node.parentNodeId)) continue
    const siblings = children.get(node.parentNodeId) ?? []
    siblings.push(node)
    children.set(node.parentNodeId, siblings)
  }
  const roots = nodes.filter(node => node.parentNodeId === undefined || !visibleIds.has(node.parentNodeId))
  const positions = new Map<string, Point>()
  let leafIndex = 0
  const place = (node: ResearchNode, depth: number, ancestors: ReadonlySet<string> = new Set()): number => {
    if (ancestors.has(node.nodeId)) {
      const y = leafIndex++ * (NODE_HEIGHT + VERTICAL_GAP)
      positions.set(node.nodeId, { x: depth * (NODE_WIDTH + HORIZONTAL_GAP), y })
      return y
    }
    const nextAncestors = new Set(ancestors)
    nextAncestors.add(node.nodeId)
    const descendants = children.get(node.nodeId) ?? []
    const childYs = descendants.map(child => place(child, depth + 1, nextAncestors))
    const y = childYs.length === 0
      ? leafIndex++ * (NODE_HEIGHT + VERTICAL_GAP)
      : childYs.reduce((total, value) => total + value, 0) / childYs.length
    positions.set(node.nodeId, { x: depth * (NODE_WIDTH + HORIZONTAL_GAP), y })
    return y
  }
  for (const root of roots) place(root, 0)
  const maxX = Math.max(0, ...[...positions.values()].map(point => point.x))
  const maxY = Math.max(0, ...[...positions.values()].map(point => point.y))
  return {
    nodes,
    children,
    positions,
    width: maxX + NODE_WIDTH + 64,
    height: Math.max(360, maxY + NODE_HEIGHT + 64),
  }
}

function pathBetween(parent: Point, child: Point): string {
  const startX = parent.x + NODE_WIDTH
  const startY = parent.y + NODE_HEIGHT / 2
  const endX = child.x
  const endY = child.y + NODE_HEIGHT / 2
  const curve = Math.max(36, (endX - startX) * 0.46)
  return [
    String.fromCharCode(77), startX, startY,
    String.fromCharCode(67), startX + curve, startY,
    endX - curve, endY, endX, endY,
  ].join(' ')
}

function isOnSelectedPath(state: ResearchState, nodeId: string, selectedNodeId: string): boolean {
  let current = state.nodes[selectedNodeId]
  const visited = new Set<string>()
  while (current !== undefined && !visited.has(current.nodeId)) {
    visited.add(current.nodeId)
    if (current.nodeId === nodeId) return true
    current = current.parentNodeId === undefined ? undefined : state.nodes[current.parentNodeId]
  }
  return false
}

type CanvasInteraction =
  | { readonly kind: 'pan'; readonly pointerId: number; readonly startX: number; readonly startY: number; readonly startViewport: Viewport; moved: boolean }
  | { readonly kind: 'node'; readonly pointerId: number; readonly nodeId: string; readonly startX: number; readonly startY: number; readonly startPoint: Point; moved: boolean }

function clampZoom(value: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Number(value.toFixed(2))))
}

/** Render the research DAG with a compact, pannable, zoomable horizontal layout. */
export function ResearchFlowCanvas({
  state,
  selectedNodeId,
  activeBranchId,
  stageText,
  statusText,
  emptyArtifact,
  currentLabel,
  nodeCountLabel,
  branchViewLabel,
  expandLabel,
  collapseLabel,
  zoomInLabel,
  zoomOutLabel,
  fitViewLabel,
  restoreLayoutLabel,
  layoutScope,
  collapsedBranchIds,
  onToggleBranch,
  onSelectNode,
  onSelectBranch,
  onExpandAll,
  onCollapseAll,
  disabled = false,
}: ResearchFlowCanvasProps): ReactNode {
  const scope = layoutScope ?? 'default'
  const autoLayout = useMemo(() => calculateLayout(state, collapsedBranchIds), [state, collapsedBranchIds])
  const [manualPositions, setManualPositions] = useState<Record<string, Point>>(
    () => ({ ...readSavedLayout(scope).positions }),
  )
  const [viewport, setViewport] = useState<Viewport>(
    () => readSavedLayout(scope).viewport ?? DEFAULT_PAN_WITH_ZOOM,
  )
  const [dragging, setDragging] = useState(false)
  const [draggingNodeId, setDraggingNodeId] = useState<string | undefined>()
  const interactionRef = useRef<CanvasInteraction | undefined>()
  const manualPositionsRef = useRef<Record<string, Point>>(manualPositions)
  const viewportRef = useRef<Viewport>(viewport)
  const suppressClickRef = useRef<string | undefined>()
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>()
  const canvasRef = useRef<HTMLDivElement>(null)
  const layout = useMemo<FlowLayout>(() => {
    const positions = new Map(autoLayout.positions)
    for (const [nodeId, point] of Object.entries(manualPositions)) {
      if (positions.has(nodeId)) positions.set(nodeId, point)
    }
    const maxX = Math.max(0, ...[...positions.values()].map(point => point.x))
    const maxY = Math.max(0, ...[...positions.values()].map(point => point.y))
    return {
      ...autoLayout,
      positions,
      width: Math.max(autoLayout.width, maxX + NODE_WIDTH + 64),
      height: Math.max(autoLayout.height, maxY + NODE_HEIGHT + 64),
    }
  }, [autoLayout, manualPositions])
  const visibleNodes = layout.nodes
  const minimapScale = Math.min(0.28, 156 / Math.max(layout.width, 1), 92 / Math.max(layout.height, 1))

  const persist = (positions = manualPositionsRef.current, nextViewport = viewportRef.current): void => {
    writeSavedLayout(scope, positions, nextViewport)
  }

  const schedulePersist = (): void => {
    if (persistTimerRef.current !== undefined) clearTimeout(persistTimerRef.current)
    persistTimerRef.current = setTimeout(() => {
      persistTimerRef.current = undefined
      persist()
    }, 160)
  }

  useEffect(() => () => {
    if (persistTimerRef.current !== undefined) clearTimeout(persistTimerRef.current)
  }, [])

  useEffect(() => {
    const saved = readSavedLayout(scope)
    const positions = { ...saved.positions }
    manualPositionsRef.current = positions
    viewportRef.current = saved.viewport ?? DEFAULT_PAN_WITH_ZOOM
    setManualPositions(positions)
    setViewport(viewportRef.current)
  }, [scope])

  useEffect(() => {
    setManualPositions((previous) => {
      const knownIds = new Set(Object.keys(state.nodes))
      const next = Object.fromEntries(Object.entries(previous).filter(([nodeId]) => knownIds.has(nodeId)))
      manualPositionsRef.current = next
      return next
    })
  }, [state.nodes])

  useEffect(() => {
    manualPositionsRef.current = manualPositions
  }, [manualPositions])

  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  const updateViewport = (next: Viewport): void => {
    const normalized = { ...next, zoom: clampZoom(next.zoom) }
    viewportRef.current = normalized
    setViewport(normalized)
  }

  const fitToView = (targetLayout = layout): void => {
    const canvas = canvasRef.current
    if (canvas === null) return
    const availableWidth = Math.max(1, canvas.clientWidth - 52)
    const availableHeight = Math.max(1, canvas.clientHeight - 52)
    const nextZoom = clampZoom(Math.min(1, availableWidth / targetLayout.width, availableHeight / targetLayout.height))
    const nextViewport = {
      x: Math.max(26, (canvas.clientWidth - targetLayout.width * nextZoom) / 2),
      y: Math.max(26, (canvas.clientHeight - targetLayout.height * nextZoom) / 2),
      zoom: nextZoom,
    }
    updateViewport(nextViewport)
    persist(manualPositionsRef.current, nextViewport)
  }

  const zoomAt = (nextZoomValue: number, clientX: number, clientY: number): void => {
    const canvas = canvasRef.current
    if (canvas === null) return
    const rect = canvas.getBoundingClientRect()
    const pointerX = clientX - rect.left
    const pointerY = clientY - rect.top
    const current = viewportRef.current
    const nextZoom = clampZoom(nextZoomValue)
    const worldX = (pointerX - current.x) / current.zoom
    const worldY = (pointerY - current.y) / current.zoom
    const nextViewport = { x: pointerX - worldX * nextZoom, y: pointerY - worldY * nextZoom, zoom: nextZoom }
    updateViewport(nextViewport)
    schedulePersist()
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (disabled || event.button !== 0) return
    const target = event.target
    if (target instanceof Element && (target.closest('[data-research-node]') !== null || target.closest('[data-research-minimap]') !== null)) return
    const canvas = canvasRef.current
    if (canvas === null) return
    interactionRef.current = {
      kind: 'pan', pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
      startViewport: viewportRef.current, moved: false,
    }
    if (typeof canvas.setPointerCapture === 'function') canvas.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const interaction = interactionRef.current
    if (interaction === undefined || interaction.pointerId !== event.pointerId) return
    const distance = Math.hypot(event.clientX - interaction.startX, event.clientY - interaction.startY)
    if (distance < DRAG_THRESHOLD && !interaction.moved) return
    const startedDragging = distance >= DRAG_THRESHOLD && !interaction.moved
    if (distance >= DRAG_THRESHOLD) interaction.moved = true
    if (interaction.kind === 'pan') {
      updateViewport({
        x: interaction.startViewport.x + event.clientX - interaction.startX,
        y: interaction.startViewport.y + event.clientY - interaction.startY,
        zoom: interaction.startViewport.zoom,
      })
      return
    }
    if (startedDragging) {
      const canvas = canvasRef.current
      if (canvas !== null && typeof canvas.setPointerCapture === 'function') canvas.setPointerCapture(event.pointerId)
      setDragging(true)
      setDraggingNodeId(interaction.nodeId)
    }
    const nextPoint = {
      x: interaction.startPoint.x + (event.clientX - interaction.startX) / viewportRef.current.zoom,
      y: interaction.startPoint.y + (event.clientY - interaction.startY) / viewportRef.current.zoom,
    }
    const nextPositions = { ...manualPositionsRef.current, [interaction.nodeId]: nextPoint }
    manualPositionsRef.current = nextPositions
    setManualPositions(nextPositions)
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>): void => {
    const interaction = interactionRef.current
    if (interaction === undefined || interaction.pointerId !== event.pointerId) return
    if (interaction.moved && interaction.kind === 'node') suppressClickRef.current = interaction.nodeId
    if (interaction.moved) persist()
    interactionRef.current = undefined
    setDragging(false)
    setDraggingNodeId(undefined)
    const canvas = canvasRef.current
    if (canvas !== null && typeof canvas.releasePointerCapture === 'function' && (typeof canvas.hasPointerCapture !== 'function' || canvas.hasPointerCapture(event.pointerId))) {
      canvas.releasePointerCapture(event.pointerId)
    }
  }

  const onNodePointerDown = (event: PointerEvent<HTMLDivElement>, nodeId: string): void => {
    if (disabled || event.button !== 0) return
    event.stopPropagation()
    suppressClickRef.current = undefined
    const target = event.target
    if (target instanceof Element && target.closest('[data-node-action]') !== null) return
    const point = layout.positions.get(nodeId)
    if (point === undefined) return
    interactionRef.current = {
      kind: 'node', pointerId: event.pointerId, nodeId, startX: event.clientX, startY: event.clientY,
      startPoint: point, moved: false,
    }
    setDragging(false)
    setDraggingNodeId(undefined)
  }

  const restoreAutomaticLayout = (): void => {
    manualPositionsRef.current = {}
    setManualPositions({})
    const nextViewport = { ...DEFAULT_PAN_WITH_ZOOM }
    updateViewport(nextViewport)
    persist({}, nextViewport)
    fitToView(autoLayout)
  }

  const onCanvasDoubleClick = (event: MouseEvent<HTMLDivElement>): void => {
    const target = event.target
    if (!(target instanceof Element)) {
      fitToView()
      return
    }
    if (target.closest('[data-research-node]') === null && target.closest('[data-research-minimap]') === null) fitToView()
  }

  const onCanvasWheel = (event: WheelEvent<HTMLDivElement>): void => {
    event.preventDefault()
    const delta = event.deltaY < 0 ? 0.05 : -0.05
    zoomAt(viewportRef.current.zoom + delta, event.clientX, event.clientY)
  }

  return (
    <div className={css.root} data-flow-canvas data-dragging={dragging ? 'true' : 'false'}>
      <div className={css.toolbar} role="toolbar" aria-label={branchViewLabel}>
        <div className={css.toolbarGroup}>
          <Tooltip label={zoomInLabel} side="bottom"><button type="button" className={css.toolButton} onClick={() => { const canvas = canvasRef.current; zoomAt(viewportRef.current.zoom + 0.1, canvas ? canvas.getBoundingClientRect().left + canvas.clientWidth / 2 : 0, canvas ? canvas.getBoundingClientRect().top + canvas.clientHeight / 2 : 0) }} aria-label={zoomInLabel}>＋</button></Tooltip>
          <span className={css.zoomLabel}>{Math.round(viewport.zoom * 100)}%</span>
          <Tooltip label={zoomOutLabel} side="bottom"><button type="button" className={css.toolButton} onClick={() => { const canvas = canvasRef.current; zoomAt(viewportRef.current.zoom - 0.1, canvas ? canvas.getBoundingClientRect().left + canvas.clientWidth / 2 : 0, canvas ? canvas.getBoundingClientRect().top + canvas.clientHeight / 2 : 0) }} aria-label={zoomOutLabel}>−</button></Tooltip>
          <Tooltip label={fitViewLabel} side="bottom"><button type="button" className={css.toolButton} onClick={() => { fitToView() }} aria-label={fitViewLabel}>⌖</button></Tooltip>
          <Tooltip label={restoreLayoutLabel} side="bottom"><button type="button" className={css.toolButton} onClick={restoreAutomaticLayout} aria-label={restoreLayoutLabel}>↺</button></Tooltip>
        </div>
        <div className={css.toolbarGroup}>
          <Tooltip label={expandLabel} side="bottom"><button type="button" className={css.toolButton} onClick={onExpandAll} disabled={disabled} aria-label={expandLabel}>↗</button></Tooltip>
          <Tooltip label={collapseLabel} side="bottom"><button type="button" className={css.toolButton} onClick={onCollapseAll} disabled={disabled} aria-label={collapseLabel}>↘</button></Tooltip>
          <span className={css.canvasHint}>{nodeCountLabel(visibleNodes.length)}</span>
        </div>
      </div>
      <div
        ref={canvasRef}
        className={css.canvas}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onCanvasDoubleClick}
        onWheel={onCanvasWheel}
        aria-label={branchViewLabel}
        role="tree"
      >
        <div className={css.canvasStage} style={{ width: layout.width, height: layout.height, transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`, transformOrigin: 'top left' }}>
          <svg className={css.edges} width={layout.width} height={layout.height} aria-hidden="true">
            <defs>
              <filter id="research-flow-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            {[...layout.children.entries()].flatMap(([parentId, children]) => children.map((child) => {
              const parent = layout.positions.get(parentId)
              const childPoint = layout.positions.get(child.nodeId)
              if (parent === undefined || childPoint === undefined) return null
              const active = isOnSelectedPath(state, child.nodeId, selectedNodeId)
              return (
                <path
                  key={`${parentId}-${child.nodeId}`}
                  className={active ? css.edgeActive : css.edge}
                  d={pathBetween(parent, childPoint)}
                  stroke={branchColor(child.branchId)}
                  data-active={active ? 'true' : 'false'}
                />
              )
            }))}
          </svg>
          {visibleNodes.map((node) => {
            const point = layout.positions.get(node.nodeId)
            if (point === undefined) return null
            const branch = state.branches[node.branchId]
            if (branch === undefined) return null
            const branchFirst = branch.nodeIds.find(id => state.nodes[id]?.branchId === node.branchId) === node.nodeId
            const childCount = Object.values(state.nodes).filter(candidate => candidate.parentNodeId === node.nodeId).length
            const selectedNode = node.nodeId === selectedNodeId
            const selectedPath = isOnSelectedPath(state, node.nodeId, selectedNodeId)
            return (
              <div
                key={node.nodeId}
                className={[css.node, selectedNode ? css.nodeSelected : undefined, selectedPath ? css.nodeOnPath : undefined, draggingNodeId === node.nodeId ? css.nodeDragging : undefined].filter(Boolean).join(' ')}
                style={{ left: point.x, top: point.y, '--branch-color': branchColor(node.branchId) } as CSSProperties}
                onPointerDown={(event) => { onNodePointerDown(event, node.nodeId) }}
                data-research-node={node.nodeId}
                data-research-branch={node.branchId}
                data-status={node.status}
                role="treeitem"
                aria-current={selectedNode ? 'step' : undefined}
                aria-level={nodeDepth(state, node)}
              >
                <button type="button" className={css.nodeButton} onClick={() => { if (suppressClickRef.current === node.nodeId) { suppressClickRef.current = undefined; return }; onSelectNode(node.nodeId) }} disabled={disabled}>
                  <span className={css.nodeTopline}>
                    <span className={css.nodeNumber}>{nodeNumber(Object.values(state.nodes), node.nodeId)}</span>
                    <span className={css.stageLabel}>{stageText(node.stage)}</span>
                    <span className={css.status} data-status={node.status}>{statusText(node.status)}</span>
                  </span>
                  <span className={css.nodeTitle}>{artifactTitle(state, node, emptyArtifact)}</span>
                  <span className={css.nodeSummary}>{stageText(node.stage)}</span>
                </button>
                {branchFirst && (
                  <button
                    type="button"
                    className={css.branchBadge}
                    data-node-action="true"
                    onPointerDown={(event) => { event.stopPropagation() }}
                    onClick={() => { onSelectBranch(node.branchId) }}
                    disabled={disabled}
                    style={{ '--branch-color': branchColor(node.branchId) } as CSSProperties}
                    aria-current={node.branchId === activeBranchId ? 'true' : undefined}
                  >
                    <span className={css.branchDot} aria-hidden="true" />
                    <span>{branch.label}</span>
                    {node.branchId === activeBranchId && <span className={css.current}>{currentLabel}</span>}
                  </button>
                )}
                {branchFirst && childCount > 0 && (
                  <button
                    type="button"
                    className={css.collapseButton}
                    data-node-action="true"
                    onPointerDown={(event) => { event.stopPropagation() }}
                    onClick={() => { onToggleBranch(node.branchId) }}
                    disabled={disabled}
                    aria-label={collapsedBranchIds.has(node.branchId) ? expandLabel : collapseLabel}
                  >
                    {collapsedBranchIds.has(node.branchId) ? '+' : '−'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <div className={css.minimap} data-research-minimap="true" aria-label={branchViewLabel} role="group">
          <div className={css.minimapViewport} style={{ width: layout.width * minimapScale, height: layout.height * minimapScale }}>
            {visibleNodes.map((node) => {
              const point = layout.positions.get(node.nodeId)
              if (point === undefined) return null
              return <button key={node.nodeId} type="button" className={css.minimapNode} style={{ left: point.x * minimapScale, top: point.y * minimapScale, background: branchColor(node.branchId) }} onClick={() => { onSelectNode(node.nodeId) }} aria-label={stageText(node.stage)} />
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

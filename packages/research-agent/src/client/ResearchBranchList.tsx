import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  IconChevronDownOutlineRegular,
  IconChevronRightOutlineRegular,
  IconInspectOutlineRegular,
  IconSearchOutlineRegular,
  IconSlidersTwoOutlineRegular,
  IconWorkspaceTreeOutlineRegular,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  ResearchBranch,
  ResearchNode,
  ResearchNodeStatus,
  ResearchStage,
  ResearchState,
} from 'dsh-research-agent/client'
import css from './ResearchBranchList.module.css'

/** Props for the compact hierarchy table used by the list view. */
export interface ResearchBranchListProps {
  /** Current durable research DAG. */
  readonly state: ResearchState
  /** Node selected by the surrounding research panel. */
  readonly selectedNodeId: string
  /** Localized stage renderer. */
  readonly stageText: (stage: ResearchStage) => string
  /** Localized status renderer. */
  readonly statusText: (status: ResearchNodeStatus) => string
  /** Text used when a node has no artifact yet. */
  readonly emptyArtifact: string
  /** Translations owned by the workflow-run client. */
  readonly t: TranslateNS<'researchAgent'>
  /** Select a node in the shared research state. */
  readonly onSelectNode: (nodeId: string) => void
  /** Switch to the existing canvas and focus the selected node. */
  readonly onLocateNode: (nodeId: string) => void
  /** Disable commands while a Host operation is running. */
  readonly disabled?: boolean
  /** Expanded state retained by the parent while the user switches views. */
  readonly collapsedNodeIds?: ReadonlySet<string>
  /** Persist expanded state in the parent panel when supplied. */
  readonly onCollapsedNodeIdsChange?: (ids: ReadonlySet<string>) => void
}

type StatusFilter = 'all' | ResearchNodeStatus

interface TreeRow {
  readonly node: ResearchNode
  readonly depth: number
  readonly path: string
  readonly childCount: number
  readonly hasChildren: boolean
  readonly branch: ResearchBranch | undefined
  readonly contextOnly: boolean
}

const STATUS_FILTERS: readonly StatusFilter[] = [
  'all', 'active', 'confirmed', 'awaiting-confirmation', 'pending', 'rejected', 'completed',
]

function nodeArtifact(
  state: ResearchState,
  node: ResearchNode,
): { readonly title: string; readonly summary: string; readonly kind?: string } {
  const artifactId = node.artifactRefs.at(-1)
  const artifact = artifactId === undefined ? undefined : state.artifacts[artifactId]
  if (artifact === undefined) return { title: '', summary: '' }
  return {
    title: artifact.title,
    summary: artifact.content.replace(/\s+/g, ' ').trim(),
    kind: artifact.kind,
  }
}

function nodeOrder(state: ResearchState): ReadonlyMap<string, number> {
  const order = new Map<string, number>()
  let next = 0
  for (const branch of Object.values(state.branches)) {
    for (const nodeId of branch.nodeIds) {
      if (!order.has(nodeId)) order.set(nodeId, next++)
    }
  }
  for (const node of Object.values(state.nodes)) {
    if (!order.has(node.nodeId)) order.set(node.nodeId, next++)
  }
  return order
}

function parentIds(state: ResearchState, nodeId: string): readonly string[] {
  const result: string[] = []
  const visited = new Set<string>()
  let current = state.nodes[nodeId]
  while (current?.parentNodeId !== undefined && !visited.has(current.nodeId)) {
    visited.add(current.nodeId)
    const parentId = current.parentNodeId
    result.push(parentId)
    current = state.nodes[parentId]
  }
  return result
}

function branchColor(branchId: string): string {
  let hash = 0
  for (const character of branchId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  return ['var(--dsw-alias-state-business-primary)', 'var(--dsw-alias-state-success-primary)', 'var(--dsw-alias-state-warn-label)', 'var(--dsw-alias-state-error-primary)'][hash % 4] ?? 'var(--dsw-alias-state-business-primary)'
}

function highlight(text: string, query: string): ReactNode {
  if (query.trim() === '') return text
  const normalized = query.trim().toLocaleLowerCase()
  const result: ReactNode[] = []
  let cursor = 0
  const source = text.toLocaleLowerCase()
  while (cursor < text.length) {
    const match = source.indexOf(normalized, cursor)
    if (match < 0) {
      result.push(text.slice(cursor))
      break
    }
    if (match > cursor) result.push(text.slice(cursor, match))
    result.push(<mark key={`${match}-${match + normalized.length}`}>{text.slice(match, match + normalized.length)}</mark>)
    cursor = match + normalized.length
  }
  return result
}

function buildRows(
  state: ResearchState,
  stageText: (stage: ResearchStage) => string,
  query: string,
  statusFilter: StatusFilter,
  branchFilter: string,
): readonly TreeRow[] {
  const order = nodeOrder(state)
  const children = new Map<string, ResearchNode[]>()
  const roots: ResearchNode[] = []
  for (const node of Object.values(state.nodes)) {
    const parentId = node.parentNodeId
    if (parentId === undefined || state.nodes[parentId] === undefined) roots.push(node)
    else children.set(parentId, [...(children.get(parentId) ?? []), node])
  }
  const byOrder = (left: ResearchNode, right: ResearchNode): number => (order.get(left.nodeId) ?? 0) - (order.get(right.nodeId) ?? 0)
  roots.sort(byOrder)
  for (const siblings of children.values()) siblings.sort(byOrder)

  const matches = new Set<string>()
  const queryText = query.trim().toLocaleLowerCase()
  for (const node of Object.values(state.nodes)) {
    const artifact = nodeArtifact(state, node)
    const branch = state.branches[node.branchId]
    const searchable = [
      stageText(node.stage), artifact.title, artifact.summary, artifact.kind ?? '', branch?.label ?? '', node.nodeId,
    ].join(' ').toLocaleLowerCase()
    if ((queryText === '' || searchable.includes(queryText))
      && (statusFilter === 'all' || node.status === statusFilter)
      && (branchFilter === 'all' || node.branchId === branchFilter)) matches.add(node.nodeId)
  }
  const constrained = queryText !== '' || statusFilter !== 'all' || branchFilter !== 'all'
  const included = new Set<string>(matches)
  for (const nodeId of matches) for (const ancestorId of parentIds(state, nodeId)) included.add(ancestorId)

  const result: TreeRow[] = []
  const walk = (node: ResearchNode, depth: number, path: string, ancestors: ReadonlySet<string>): void => {
    if (ancestors.has(node.nodeId)) return
    if (!constrained || included.has(node.nodeId)) {
      const childNodes = children.get(node.nodeId) ?? []
      result.push({
        node,
        depth,
        path,
        childCount: childNodes.length,
        hasChildren: childNodes.length > 0,
        branch: state.branches[node.branchId],
        contextOnly: constrained && !matches.has(node.nodeId),
      })
      const nextAncestors = new Set(ancestors)
      nextAncestors.add(node.nodeId)
      childNodes.forEach((child, index) => { walk(child, depth + 1, `${path}.${index + 1}`, nextAncestors) })
    }
  }
  roots.forEach((root, index) => { walk(root, 0, String(index + 1), new Set()) })
  // A corrupt or future DAG may contain a cycle or an orphan that was not a root.
  // Keep the row visible without inventing a parent relationship.
  for (const node of Object.values(state.nodes)) {
    if (result.some(row => row.node.nodeId === node.nodeId)) continue
    if (!constrained || included.has(node.nodeId)) walk(node, 0, '·', new Set())
  }
  return result
}

/** Render the real research node DAG as a searchable, expandable table. */
export function ResearchBranchList({
  state,
  selectedNodeId,
  stageText,
  statusText,
  emptyArtifact,
  t,
  onSelectNode,
  onLocateNode,
  disabled = false,
  collapsedNodeIds,
  onCollapsedNodeIdsChange,
}: ResearchBranchListProps): ReactNode {
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [branchFilter, setBranchFilter] = useState('all')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [localCollapsedIds, setLocalCollapsedIds] = useState<ReadonlySet<string>>(new Set())
  const tableRef = useRef<HTMLDivElement>(null)
  const branches = useMemo(
    () => Object.values(state.branches).sort((left, right) => left.branchId.localeCompare(right.branchId, undefined, { numeric: true })),
    [state.branches],
  )
  const rows = useMemo(
    () => buildRows(state, stageText, query, statusFilter, branchFilter),
    [branchFilter, query, stageText, state, statusFilter],
  )
  const filtered = query.trim() !== '' || statusFilter !== 'all' || branchFilter !== 'all'
  const collapsedIds = collapsedNodeIds ?? localCollapsedIds
  const expandableIds = useMemo(
    () => new Set(
      Object.values(state.nodes)
        .filter(node => Object.values(state.nodes).some(child => child.parentNodeId === node.nodeId))
        .map(node => node.nodeId),
    ),
    [state.nodes],
  )

  useEffect(() => {
    const next = new Set(collapsedIds)
    for (const ancestorId of parentIds(state, selectedNodeId)) {
      next.delete(ancestorId)
    }
    if (next.size !== collapsedIds.size) {
      if (onCollapsedNodeIdsChange !== undefined) onCollapsedNodeIdsChange(next)
      else setLocalCollapsedIds(next)
    }
    const target = [...(tableRef.current?.querySelectorAll<HTMLElement>('[data-research-node]') ?? [])]
      .find(element => element.dataset.researchNode === selectedNodeId)
    if (target !== undefined && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [collapsedIds, onCollapsedNodeIdsChange, selectedNodeId, state])

  const visibleRows = rows.filter((row) => {
    if (filtered) return true
    let parent = row.node.parentNodeId
    while (parent !== undefined) {
      if (collapsedIds.has(parent)) return false
      parent = state.nodes[parent]?.parentNodeId
    }
    return true
  })
  const setCollapsed = (nodeId: string): void => {
    const next = new Set(collapsedIds)
    if (next.has(nodeId)) next.delete(nodeId)
    else next.add(nodeId)
    if (onCollapsedNodeIdsChange !== undefined) onCollapsedNodeIdsChange(next)
    else setLocalCollapsedIds(next)
  }

  return (
    <div className={css.root} data-research-branch-list>
      <div className={css.toolbar}>
        <label className={css.search}>
          <IconSearchOutlineRegular size={14} aria-hidden="true" />
          <input value={query} onChange={(event) => { setQuery(event.target.value) }} placeholder={t('research.searchPlaceholder')} aria-label={t('research.search')} />
        </label>
        <button type="button" className={filtersOpen ? `${css.filterButton} ${css.filterButtonActive}` : css.filterButton} onClick={() => { setFiltersOpen(value => !value) }} aria-expanded={filtersOpen} aria-label={t('research.filter')}>
          <IconSlidersTwoOutlineRegular size={14} />
          <span>{t('research.filter')}</span>
        </button>
        <div className={css.expandControls} role="group" aria-label={t('research.branchList')}>
          <button type="button" className={css.smallButton} onClick={() => { if (onCollapsedNodeIdsChange !== undefined) onCollapsedNodeIdsChange(new Set()); else setLocalCollapsedIds(new Set()) }} disabled={disabled} aria-label={t('research.expand')} title={t('research.expand')}>↗</button>
          <button type="button" className={css.smallButton} onClick={() => { const next = new Set(expandableIds); if (onCollapsedNodeIdsChange !== undefined) onCollapsedNodeIdsChange(next); else setLocalCollapsedIds(next) }} disabled={disabled} aria-label={t('research.collapse')} title={t('research.collapse')}>↘</button>
        </div>
      </div>
      {filtersOpen && (
        <div className={css.filterPanel} role="group" aria-label={t('research.filter')}>
          <label>{t('research.filterStatus')}
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as StatusFilter) }}>
              {STATUS_FILTERS.map(value => <option key={value} value={value}>{value === 'all' ? t('research.filterAll') : statusText(value)}</option>)}
            </select>
          </label>
          <label>{t('research.filterBranch')}
            <select value={branchFilter} onChange={(event) => { setBranchFilter(event.target.value) }}>
              <option value="all">{t('research.filterAll')}</option>
              {branches.map(branch => <option key={branch.branchId} value={branch.branchId}>{branch.label}</option>)}
            </select>
          </label>
        </div>
      )}
      <div className={css.table} ref={tableRef} role="tree" aria-label={t('research.branchList')}>
        <div className={css.tableHeader} role="row">
          <span role="columnheader">{t('research.tableNumber')}</span>
          <span role="columnheader">{t('research.tableNode')}</span>
          <span role="columnheader">{t('research.tableSummary')}</span>
          <span role="columnheader">{t('research.tableStatus')}</span>
          <span role="columnheader">{t('research.tableChildren')}</span>
          <span role="columnheader">{t('research.tableActions')}</span>
        </div>
        {visibleRows.length === 0 ? (
          <div className={css.empty} role="status">{t('research.noResults')}</div>
        ) : visibleRows.map((row) => {
          const artifactId = row.node.artifactRefs.at(-1)
          const artifact = artifactId === undefined ? undefined : state.artifacts[artifactId]
          const title = artifact?.title ?? stageText(row.node.stage)
          const summary = artifact?.content.replace(/\s+/g, ' ').trim() ?? emptyArtifact
          const collapsed = collapsedIds.has(row.node.nodeId)
          const selected = row.node.nodeId === selectedNodeId
          return (
            <div
              key={row.node.nodeId}
              className={[css.row, selected ? css.rowSelected : undefined, row.contextOnly ? css.rowContext : undefined].filter(Boolean).join(' ')}
              style={{ '--depth': row.depth, '--branch-color': branchColor(row.node.branchId) } as CSSProperties}
              data-research-node={row.node.nodeId}
              data-research-branch={row.node.branchId}
              data-status={row.node.status}
              role="treeitem"
              aria-level={row.depth + 1}
              aria-expanded={row.hasChildren ? !collapsed : undefined}
              aria-current={selected ? 'true' : undefined}
              tabIndex={disabled ? -1 : 0}
              onClick={() => { if (!disabled) onSelectNode(row.node.nodeId) }}
              onKeyDown={(event) => {
                if ((event.key === 'Enter' || event.key === ' ') && !disabled) {
                  event.preventDefault()
                  onSelectNode(row.node.nodeId)
                }
              }}
            >
              <span className={css.number}>{row.path}</span>
              <span className={css.nodeCell}>
                {row.hasChildren ? (
                  <button type="button" className={css.disclosure} onClick={(event) => { event.stopPropagation(); if (!disabled) setCollapsed(row.node.nodeId) }} disabled={disabled} aria-label={collapsed ? t('research.expand') : t('research.collapse')}>
                    {collapsed ? <IconChevronRightOutlineRegular size={12} /> : <IconChevronDownOutlineRegular size={12} />}
                  </button>
                ) : <span className={css.disclosurePlaceholder} aria-hidden="true" />}
                <span className={css.nodeIcon} aria-hidden="true"><IconWorkspaceTreeOutlineRegular size={14} /></span>
                <span className={css.nodeCopy}>
                  <span className={css.nodeTitle}>{highlight(title, query)}</span>
                  <span className={css.nodeStage}>{highlight(stageText(row.node.stage), query)}{row.branch !== undefined ? ` · ${row.branch.label}` : ''}</span>
                </span>
              </span>
              <span className={css.summary} title={summary}>{highlight(summary, query)}</span>
              <span className={css.status} data-status={row.node.status}>{statusText(row.node.status)}</span>
              <span className={css.children}>{row.childCount}</span>
              <span className={css.actions}>
                <Tooltip label={t('research.viewNode')} side="top">
                  <button type="button" className={css.actionButton} onClick={(event) => { event.stopPropagation(); if (!disabled) onSelectNode(row.node.nodeId) }} disabled={disabled} aria-label={t('research.viewNode')}><IconInspectOutlineRegular size={13} /></button>
                </Tooltip>
                <Tooltip label={t('research.locateNode')} side="top">
                  <button type="button" className={css.actionButton} onClick={(event) => { event.stopPropagation(); if (!disabled) onLocateNode(row.node.nodeId) }} disabled={disabled} aria-label={t('research.locateNode')}><IconWorkspaceTreeOutlineRegular size={13} /></button>
                </Tooltip>
              </span>
            </div>
          )
        })}
      </div>
      <div className={css.footer}>{t(visibleRows.length === 1 ? 'research.node.one' : 'research.node.other', { count: visibleRows.length })}</div>
    </div>
  )
}

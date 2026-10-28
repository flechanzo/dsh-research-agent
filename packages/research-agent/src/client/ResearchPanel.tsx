import { ResearchTranscriptMain } from './ResearchTranscriptMain.tsx'
import { ResearchBranchSelector } from './ResearchBranchSelector.tsx'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  IconBranchOutlineRegular,
  IconCheckOutlineRegular,
  IconFlatListOutlineRegular,
  IconPlayOutlineRegular,
  IconWorkspaceTreeOutlineRegular,
  Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  ResearchArtifact,
  ResearchCommandValue,
  ResearchDirectionWeights,
  ResearchDirectionFocusId,
  ResearchLiteratureSourceId,
  ResearchNode,
  ResearchRemote,
  ResearchStage,
  ResearchState,
} from 'dsh-research-agent/client'
import type { FileUploadService } from '@deepseek-ai/dsh-client-file-upload/client'
import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'
import type { WorkflowRunKey } from './locales.ts'
import {
  publishResearchSession,
  loadResearchSession,
  useResearchSessionFailure,
  useResearchSession,
} from './research-session-store.ts'
import css from './ResearchPanel.module.css'
import { ResearchBranchList } from './ResearchBranchList.tsx'
import { ResearchFlowCanvas } from './ResearchFlowCanvas.tsx'

/** Props for the session-scoped right-sidebar page. */
export type ResearchPanelProps = PropsRuntime<'sidebar.right.pane.tab'> & PropsLocale<'researchAgent'> & ResearchPanelInjected

/** Host-backed services used by the research panel. */
export interface ResearchPanelInjected {
  /** Session-scoped automatic research Remote namespace. */
  readonly research: ResearchRemote
  /** Browser file upload service that returns an attachment reference. */
  readonly fileUpload: FileUploadService
}

const REVIEWER_ROLES = [
  { key: 'research.reviewer.method', role: 'method' },
  { key: 'research.reviewer.novelty', role: 'novelty' },
  { key: 'research.reviewer.repro', role: 'reproducibility' },
] as const satisfies readonly { key: WorkflowRunKey; role: string }[]

const DEFAULT_DIRECTION_WEIGHTS: ResearchDirectionWeights = {
  novelty: 30, impact: 25, feasibility: 25, reproducibility: 20,
}

const STAGE_KEYS = {
  'paper-upload': 'research.paper-upload',
  'paper-read': 'research.paper-read',
  'problem-summary': 'research.problem-summary',
  'literature-search': 'research.literature-search',
  'idea-generation': 'research.idea-generation',
  'idea-refinement': 'research.idea-refinement',
  'targeted-literature-search': 'research.targeted-literature-search',
  'multi-agent-review': 'research.multi-agent-review',
  'simulation-or-final-plan': 'research.simulation-or-final-plan',
  'final-plan': 'research.final-plan',
} as const satisfies Record<ResearchStage, WorkflowRunKey>

function stageText(stage: ResearchStage, t: ResearchPanelProps['t']): string {
  return t(STAGE_KEYS[stage])
}

function statusText(status: ReturnType<typeof selectedResearchNode>['status'], t: ResearchPanelProps['t']): string {
  switch (status) {
    case 'active': return t('research.active')
    case 'awaiting-confirmation': return t('research.awaiting')
    case 'confirmed': return t('research.confirmed')
    case 'completed': return t('research.completed')
    case 'rejected': return t('research.rejected')
    case 'pending': return t('research.active')
    default: return status satisfies never
  }
}

function decisionText(decision: NonNullable<ResearchNode['userDecision']>, t: ResearchPanelProps['t']): string {
  switch (decision) {
    case 'confirm': return t('research.decision.confirm')
    case 'reject': return t('research.decision.reject')
    case 'feedback': return t('research.decision.feedback')
    default: return decision satisfies never
  }
}

function initialResearchState(label: string): ResearchState {
  const node: ResearchNode = {
    nodeId: 'node-1', branchId: 'branch-1', stage: 'paper-upload', status: 'active', artifactRefs: [],
    memorySnapshot: {
      artifactIds: [], feedback: [], reviewerRoles: [],
      directionWeights: { ...DEFAULT_DIRECTION_WEIGHTS }, literatureSources: ['arxiv', 'openreview', 'semantic-scholar', 'acl-anthology', 'openalex'],
      directionFocuses: ['method', 'data', 'theory', 'efficiency', 'application'],
    },
  }
  return {
    nodes: { [node.nodeId]: node },
    branches: { 'branch-1': { branchId: 'branch-1', label, nodeIds: [node.nodeId] } },
    artifacts: {}, selectedNodeId: node.nodeId, activeBranchId: 'branch-1',
    nextNodeNumber: 2, nextBranchNumber: 2, nextArtifactNumber: 1,
  }
}

function selectedResearchNode(state: ResearchState): ResearchNode {
  const node = state.nodes[state.selectedNodeId]
  if (node === undefined) throw new Error(`research node "${state.selectedNodeId}" is missing`)
  return node
}

function latestArtifact(state: ResearchState, node: ResearchNode): ResearchArtifact | undefined {
  const artifactId = node.artifactRefs[node.artifactRefs.length - 1]
  return artifactId === undefined ? undefined : state.artifacts[artifactId]
}

/** Return the selected node's immutable ancestor path in display order. */
function nodeLineage(state: ResearchState, nodeId: string): readonly ResearchNode[] {
  const path: ResearchNode[] = []
  const visited = new Set<string>()
  let current = state.nodes[nodeId]
  while (current !== undefined && !visited.has(current.nodeId)) {
    visited.add(current.nodeId)
    path.push(current)
    current = current.parentNodeId === undefined ? undefined : state.nodes[current.parentNodeId]
  }
  return path.reverse()
}

/** Combine the selected branch's recorded nodes with its ancestor path once. */
function selectedBranchNodes(state: ResearchState, node: ResearchNode): readonly ResearchNode[] {
  const branch = state.branches[node.branchId]
  const ids = [
    ...nodeLineage(state, node.nodeId).map(item => item.nodeId),
    ...(branch?.nodeIds ?? []),
  ]
  const seen = new Set<string>()
  const result: ResearchNode[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    const item = state.nodes[id]
    if (item !== undefined) result.push(item)
  }
  return result
}

function innovationClaimPasses(artifact: ResearchArtifact | undefined): boolean {
  if (artifact === undefined || artifact.kind !== 'idea') return false
  const text = artifact.content.toLowerCase()
  return text.includes('创新') || text.includes('novel') || text.includes('innovation')
}

function failureText(failure: { readonly message: string; readonly code: string }, t: ResearchPanelProps['t']): string {
  return failure.code === 'research/stale' ? t('research.error.stale') : t('research.error.operation', { message: failure.message })
}

function summaryText(content: string, limit = 240): string {
  const summary = content.replace(/\s+/g, ' ').trim()
  return summary.length > limit ? `${summary.slice(0, limit - 1)}…` : summary
}

/** Render the staged research workflow, its branches, artifacts, and checkpoints. */
export function ResearchPanel({ useTabInfo, sessionId, research, fileUpload, t }: ResearchPanelProps): ReactNode {
  const { tab } = useTabInfo()
  const workflowSessionId = sessionId
  const snapshot = useResearchSession(research, workflowSessionId, tab.signal)
  const loadFailure = useResearchSessionFailure(workflowSessionId)
  const state = snapshot?.state
  const revision = snapshot?.revision ?? 0
  const loading = snapshot === undefined && loadFailure === undefined
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>()
  const [feedback, setFeedback] = useState('')
  const [branchView, setBranchView] = useState<'list' | 'map'>('map')
  const [treeCollapsed, setTreeCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [listCollapsed, setListCollapsed] = useState<ReadonlySet<string>>(new Set())
  const [choice, setChoice] = useState<'simulation' | 'plan'>('plan')
  const [directionWeights, setDirectionWeights] = useState<ResearchDirectionWeights>(DEFAULT_DIRECTION_WEIGHTS)
  const [literatureSources, setLiteratureSources] = useState<readonly ResearchLiteratureSourceId[]>(['arxiv', 'openreview', 'semantic-scholar', 'acl-anthology', 'openalex'])
  const [directionFocuses, setDirectionFocuses] = useState<readonly ResearchDirectionFocusId[]>(['method', 'data', 'theory', 'efficiency', 'application'])
  const [reviewers, setReviewers] = useState<readonly string[]>(REVIEWER_ROLES.map(item => item.role))
  const simulationAvailable = snapshot?.simulationAvailable === true
  const inputRef = useRef<HTMLInputElement>(null)
  const defaultBranch = t('research.defaultBranch')
  const initialState = useMemo(() => initialResearchState(defaultBranch), [defaultBranch])
  const displayState = state ?? initialState
  const selected = selectedResearchNode(displayState)
  const branch = displayState.branches[displayState.activeBranchId]
  const selectedBranch = displayState.branches[selected.branchId] ?? branch
  const branchNodes = useMemo(
    () => selectedBranchNodes(displayState, selected),
    [selected, selectedBranch, displayState],
  )
  const allBranches = useMemo(
    () => Object.values(displayState.branches).sort((left, right) => left.branchId.localeCompare(
      right.branchId,
      undefined,
      { numeric: true },
    )),
    [displayState.branches],
  )
  const isHistorical = selected.nodeId !== branch?.nodeIds.at(-1)
  const sessionMismatch = selected.sourceSessionId !== undefined && selected.sourceSessionId !== workflowSessionId
  const canMutate = !isHistorical && !sessionMismatch
  const artifact = latestArtifact(displayState, selected)
  const ideaNeedsReview = selected.stage === 'idea-generation' || selected.stage === 'idea-refinement'
  const parentNode = selected.parentNodeId === undefined ? undefined : displayState.nodes[selected.parentNodeId]
  const childCount = Object.values(displayState.nodes).filter(node => node.parentNodeId === selected.nodeId).length
  const contentSummary = artifact === undefined || artifact.content.trim() === ''
    ? t('research.emptyArtifact')
    : summaryText(artifact.content)

  const focusResearchContent = (): void => {
    if (typeof document === 'undefined') return
    const target = [...document.querySelectorAll<HTMLElement>('[data-research-main-node]')]
      .find(element => element.dataset.researchMainNode === selected.nodeId)
    if (target !== undefined && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const focusSection = (selector: string): void => {
    if (typeof document === 'undefined') return
    const target = document.querySelector<HTMLElement>(selector)
    if (target !== null && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const toggleTreeBranch = (branchId: string): void => {
    setTreeCollapsed((previous) => {
      const next = new Set(previous)
      if (next.has(branchId)) next.delete(branchId)
      else next.add(branchId)
      return next
    })
  }

  useEffect(() => {
    if (loadFailure !== undefined) setError(failureText(loadFailure, t))
  }, [loadFailure, t])

  useEffect(() => {
    setReviewers(selected.memorySnapshot.reviewerRoles.length > 0
      ? selected.memorySnapshot.reviewerRoles
      : REVIEWER_ROLES.map(item => item.role))
  }, [selected.nodeId, selected.memorySnapshot.reviewerRoles])

  useEffect(() => {
    setDirectionWeights(selected.memorySnapshot.directionWeights)
    setLiteratureSources(selected.memorySnapshot.literatureSources)
    setDirectionFocuses(selected.memorySnapshot.directionFocuses)
  }, [
    selected.nodeId,
    selected.memorySnapshot.directionWeights,
    selected.memorySnapshot.literatureSources,
    selected.memorySnapshot.directionFocuses,
  ])

  const execute = async (operation: () => Promise<RemoteResult<ResearchCommandValue>>): Promise<ResearchCommandValue | undefined> => {
    if (busy) return undefined
    setBusy(true)
    setError(undefined)
    try {
      const result = await operation()
      if (!result.ok) {
        setError(failureText(result.error, t))
        await loadResearchSession(research, workflowSessionId)
        return undefined
      }
      // A historical continuation stays in this Session so the panel can keep
      // the branch tree and all later nodes visible while editing the fork.
      if (result.value.snapshot.sessionId === workflowSessionId) {
        publishResearchSession(workflowSessionId, result.value.snapshot)
      }
      return result.value
    } catch {
      setError(t('research.error.request'))
      await loadResearchSession(research, workflowSessionId)
      return undefined
    } finally {
      setBusy(false)
    }
  }

  const upload = (event: ChangeEvent<HTMLInputElement>): void => {
    const files = [...(event.target.files ?? [])]
    if (files.length === 0) return
    event.target.value = ''
    void execute(async () => {
      const papers = []
      for (const file of files) {
        const uploaded = await fileUpload.upload(workflowSessionId, file, file.name, tab.signal)
        if (!uploaded.ok) return uploaded
        papers.push(uploaded.value.file)
      }
      return research.upload({
        sessionId: workflowSessionId,
        expectedRevision: revision,
        papers,
        ...(selected.stage === 'literature-search' || selected.stage === 'targeted-literature-search' ? { supplemental: true } : {}),
      }, tab.signal)
    })
  }

  const confirm = (): void => {
    void execute(() => research.confirm({
      sessionId: workflowSessionId, expectedRevision: revision,
      ...(selected.stage === 'targeted-literature-search' ? { reviewerRoles: reviewers } : {}),
      ...(selected.stage === 'problem-summary' ? { directionWeights, literatureSources } : {}),
      ...(selected.stage === 'problem-summary' ? { directionFocuses } : {}),
      ...(selected.stage === 'simulation-or-final-plan' ? { finalChoice: choice } : {}),
    }, tab.signal))
  }

  const submitFeedback = (): void => {
    if (feedback.trim() === '') return
    void execute(() => research.feedback({ sessionId: workflowSessionId, expectedRevision: revision, feedback })).then((success) => {
      if (success !== undefined) setFeedback('')
    })
  }

  const reject = (): void => {
    void execute(() => research.reject({
      sessionId: workflowSessionId, expectedRevision: revision,
      ...(feedback.trim() === '' ? {} : { reason: feedback }),
    }, tab.signal))
  }

  const selectBranch = (branchId: string): void => {
    void execute(() => research.selectBranch({ sessionId: workflowSessionId, expectedRevision: revision, branchId }))
  }

  const selectNode = (nodeId: string): void => {
    void execute(() => research.selectNode({ sessionId: workflowSessionId, expectedRevision: revision, nodeId }))
  }

  const continueFromNode = (nodeId: string): void => {
    void execute(() => research.continueFromNode({ sessionId: workflowSessionId, expectedRevision: revision, nodeId }))
  }

  const needsConfirm = canMutate && ((selected.status === 'awaiting-confirmation' || selected.status === 'confirmed')
    || (selected.status === 'active' && selected.stage !== 'paper-upload'))
  const isUploadStage = selected.stage === 'paper-upload' || selected.stage === 'literature-search' || selected.stage === 'targeted-literature-search'
  const actionLabel = selected.stage === 'final-plan' && artifact?.kind === 'plan' && artifact.source === undefined
    ? t('research.writePlan')
    : t('research.confirm')

  return (
    <div
      className={css.root}
      data-research-panel
      data-tab-id={tab.id}
      data-research-selected-node={selected.nodeId}
      data-research-active-branch={displayState.activeBranchId}
      data-research-branch-view={branchView}
      aria-busy={loading || busy}
    >
      <header className={css.header}>
        <div className={css.headerIdentity}>
          <span className={css.headerIcon} aria-hidden="true"><IconBranchOutlineRegular size={16} /></span>
          <div className={css.headerCopy}>
            <span className={css.title}>{t('research.title')}</span>
            <span className={css.headerStage}>{stageText(selected.stage, t)}</span>
          </div>
        </div>
        <div className={css.headerMeta}>
          <span className={css.statusPill} data-status={selected.status}>{statusText(selected.status, t)}</span>
          <span className={css.branchMeta}>{selectedBranch?.label ?? branch?.label ?? selected.branchId}</span>
          <span className={css.workspace}>{t('research.workspace', { path: `research-projects/${String(workflowSessionId)}` })}</span>
        </div>
      </header>
      <div className={css.statusBanner} role="status" aria-live="polite">
        <span className={css.statusBannerLabel}>{loading ? t('research.loading') : busy ? t('research.working') : stageText(selected.stage, t)}</span>
        <span className={css.statusBannerText}>{loading ? t('research.loadingHint') : t('research.currentPath', { path: nodeLineage(displayState, selected.nodeId).map(node => stageText(node.stage, t)).join(' › ') })}</span>
      </div>
      {error !== undefined && <div className={css.statusError} role="alert">{error}</div>}
      <nav className={css.workspaceNav} aria-label={t('research.workspaceNav')}>
        <button type="button" className={css.workspaceNavButton} onClick={() => { focusResearchContent() }}>{t('research.navContent')}</button>
        <button type="button" className={css.workspaceNavButton} onClick={() => { focusSection('[data-research-branch-section]') }}>{t('research.navBranches')}</button>
        <button type="button" className={css.workspaceNavButton} onClick={() => { focusSection(`[data-research-node-detail="${selected.nodeId}"]`) }}>{t('research.navDetails')}</button>
      </nav>
      <div className={css.stagePath} aria-label={t('research.currentPath', { path: '' })}>
        {nodeLineage(displayState, selected.nodeId).map((node, index, path) => (
          <span key={node.nodeId} className={css.stagePathItem}>
            <button
              type="button"
              className={node.nodeId === selected.nodeId ? `${css.stagePathButton} ${css.stagePathButtonActive}` : css.stagePathButton}
              onClick={() => { selectNode(node.nodeId) }}
              disabled={busy || node.nodeId === selected.nodeId}
              aria-current={node.nodeId === selected.nodeId ? 'step' : undefined}
            >
              {index + 1}. {stageText(node.stage, t)}
            </button>
            {index < path.length - 1 && <span className={css.stagePathSeparator} aria-hidden="true">›</span>}
          </span>
        ))}
      </div>
      <div className={css.actionDock} data-research-action-dock aria-label={t('research.currentAction')}>
        <div className={css.actionDockCopy}>
          <span className={css.actionDockTitle}>{t('research.currentAction')}</span>
          <span className={css.actionDockHint}>{busy ? t('research.workingHint') : stageText(selected.stage, t)}</span>
        </div>
        <div className={css.actionDockButtons}>
          {isUploadStage && (
            <button type="button" className={css.primaryButton} disabled={busy || loading} onClick={() => { inputRef.current?.click() }}>
              {selected.stage === 'paper-upload' ? t('research.upload') : t('research.uploadSupplemental')}
            </button>
          )}
          {needsConfirm && (
            <button type="button" className={css.primaryButton} disabled={busy || loading} onClick={confirm}>
              <IconCheckOutlineRegular size={14} /> {actionLabel}
            </button>
          )}
          {canMutate && ideaNeedsReview && (
            <>
              <button type="button" className={css.button} disabled={busy || loading || feedback.trim() === ''} onClick={submitFeedback}>{t('research.feedback')}</button>
              <button type="button" className={css.dangerButton} disabled={busy || loading} onClick={reject}>{t('research.reject')}</button>
            </>
          )}
          {!isUploadStage && !needsConfirm && !(canMutate && ideaNeedsReview) && (
            <button type="button" className={css.button} disabled={busy} onClick={() => { focusSection(`[data-research-node-detail="${selected.nodeId}"]`) }}>{t('research.viewNode')}</button>
          )}
        </div>
      </div>
      <ResearchBranchSelector sessionId={sessionId} viewId="chat" research={research} t={t} />
      <ResearchTranscriptMain sessionId={sessionId} research={research} t={t} />

      <section data-research-branch-section className={branchView === 'list' ? `${css.section} ${css.branchTreeSection}` : css.section}>
        <div className={css.sectionHeader}>
          <div>
            <div className={css.sectionTitle}>{t('research.branch')}</div>
            <div className={css.sectionHint}>{t('research.history')}</div>
          </div>
          <div className={css.sectionTools}>
            <div className={css.viewToggle} role="group" aria-label={t('research.branchView')}>
              <Tooltip label={t('research.branchMap')} side="bottom" delayMs={400}>
                <button
                  type="button"
                  className={branchView === 'map' ? `${css.viewToggleButton} ${css.viewToggleButtonActive}` : css.viewToggleButton}
                  onClick={() => { setBranchView('map') }}
                  aria-label={t('research.branchMap')}
                  aria-pressed={branchView === 'map'}
                >
                  <IconWorkspaceTreeOutlineRegular size={13} />
                  <span className={css.viewToggleLabel}>{t('research.branchMap')}</span>
                </button>
              </Tooltip>
              <Tooltip label={t('research.branchList')} side="bottom" delayMs={400}>
                <button
                  type="button"
                  className={branchView === 'list' ? `${css.viewToggleButton} ${css.viewToggleButtonActive}` : css.viewToggleButton}
                  onClick={() => { setBranchView('list') }}
                  aria-label={t('research.branchList')}
                  aria-pressed={branchView === 'list'}
                >
                  <IconFlatListOutlineRegular size={13} />
                  <span className={css.viewToggleLabel}>{t('research.branchList')}</span>
                </button>
              </Tooltip>
            </div>
            <span className={css.sectionBadge}>{allBranches.length}</span>
          </div>
        </div>
        {branchView === 'map' ? (
          <ResearchFlowCanvas
            state={displayState}
            selectedNodeId={displayState.selectedNodeId}
            activeBranchId={displayState.activeBranchId}
            stageText={stage => stageText(stage, t)}
            statusText={status => statusText(status, t)}
            emptyArtifact={t('research.emptyArtifact')}
            currentLabel={t('research.current')}
            nodeCountLabel={count => t(count === 1 ? 'research.node.one' : 'research.node.other', { count })}
            branchViewLabel={t('research.branchMap')}
            expandLabel={t('research.expand')}
            collapseLabel={t('research.collapse')}
            zoomInLabel={t('research.zoomIn')}
            zoomOutLabel={t('research.zoomOut')}
            fitViewLabel={t('research.fitView')}
            restoreLayoutLabel={t('research.restoreLayout')}
            layoutScope={String(workflowSessionId)}
            collapsedBranchIds={treeCollapsed}
            onToggleBranch={toggleTreeBranch}
            onSelectNode={selectNode}
            onSelectBranch={selectBranch}
            onExpandAll={() => { setTreeCollapsed(new Set()) }}
            onCollapseAll={() => { setTreeCollapsed(new Set(allBranches.map(item => item.branchId))) }}
            disabled={busy}
          />
        ) : (
          <ResearchBranchList
            state={displayState}
            selectedNodeId={displayState.selectedNodeId}
            stageText={stage => stageText(stage, t)}
            statusText={status => statusText(status, t)}
            emptyArtifact={t('research.emptyArtifact')}
            t={t}
            onSelectNode={selectNode}
            onLocateNode={(nodeId) => {
              selectNode(nodeId)
              setBranchView('map')
            }}
            collapsedNodeIds={listCollapsed}
            onCollapsedNodeIdsChange={setListCollapsed}
            disabled={busy}
          />
        )}
      </section>

      <section className={css.section}>
        <div className={css.sectionHeader}>
          <div className={css.sectionTitle}>{t('research.history')}</div>
          <span className={css.sectionHint}>{stageText(selected.stage, t)}</span>
        </div>
        <div className={css.timeline} aria-label={t('research.history')}>
          {branchNodes.map(node => (
            <button
              key={node.nodeId}
              type="button"
              className={node.nodeId === displayState.selectedNodeId ? `${css.node} ${css.nodeSelected}` : css.node}
              onClick={() => { selectNode(node.nodeId) }}
              disabled={busy || node.nodeId === displayState.selectedNodeId}
              data-research-node={node.nodeId}
            >
              <span className={css.nodeStage}>{stageText(node.stage, t)}</span>
              <span className={css.nodeStatus}>{statusText(node.status, t)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={css.card} data-research-node-detail={selected.nodeId}>
        <div className={css.cardHeader}>
          <div className={css.cardIdentity}>
            <div className={css.cardKicker}>{t('research.nodeDetails')}</div>
            <div className={css.cardTitle}>{artifact?.title ?? stageText(selected.stage, t)}</div>
          </div>
          <span className={css.statusPill} data-status={selected.status}>{statusText(selected.status, t)}</span>
        </div>
        <div className={css.detailActions}>
          <button type="button" className={css.button} disabled={busy} onClick={focusResearchContent}>
            {t('research.viewFullContent')}
          </button>
          <button
            type="button"
            className={css.button}
            disabled={busy || loading || loadFailure !== undefined}
            onClick={() => { continueFromNode(selected.nodeId) }}
          >
            {t('research.continue')}
          </button>
        </div>
        <section className={css.detailGroup} aria-label={t('research.nodeInfo')}>
          <div className={css.subtle}>{t('research.nodeInfo')}</div>
          <dl className={css.detailGrid}>
            <div className={css.detailItem}><dt>{t('research.nodeId')}</dt><dd>{selected.nodeId}</dd></div>
            <div className={css.detailItem}><dt>{t('research.planLabel')}</dt><dd>{displayState.branches[selected.branchId]?.label ?? selected.branchId}</dd></div>
            <div className={css.detailItem}><dt>{t('research.stageType')}</dt><dd>{stageText(selected.stage, t)}</dd></div>
            <div className={css.detailItem}><dt>{t('research.parentNode')}</dt><dd>{parentNode === undefined ? '—' : parentNode.nodeId}</dd></div>
            <div className={css.detailItem}><dt>{t('research.childNodes')}</dt><dd>{childCount}</dd></div>
            <div className={css.detailItem}><dt>{t('research.artifactCount')}</dt><dd>{selected.artifactRefs.length}</dd></div>
          </dl>
        </section>
        <section className={css.detailGroup} aria-label={t('research.contentSummary')}>
          <div className={css.subtle}>{t('research.contentSummary')}</div>
          <p className={css.detailSummary}>{contentSummary}</p>
          {artifact?.source !== undefined && <div className={css.detailMeta}>{t('research.source')}: {artifact.source}</div>}
          {artifact !== undefined && <div className={css.detailMeta}>{t('research.createdAt')}: {new Date(artifact.createdAt).toLocaleString()}</div>}
        </section>
        {(selected.userDecision !== undefined || selected.userNote !== undefined) && (
          <section className={css.detailGroup} aria-label={t('research.executionInfo')}>
            <div className={css.subtle}>{t('research.executionInfo')}</div>
            {selected.userDecision !== undefined && <div className={css.detailMeta}>{t('research.decision')}: {decisionText(selected.userDecision, t)}</div>}
            {selected.userNote !== undefined && <p className={css.detailSummary}>{selected.userNote}</p>}
          </section>
        )}
        {artifact?.evaluation !== undefined && (
          <section className={css.detailGroup} aria-label={t('research.evaluationSummary')}>
            <div className={css.subtle}>{t('research.evaluationSummary')}</div>
            <div className={artifact.evaluation.overlap || artifact.evaluation.score < artifact.evaluation.threshold
              ? css.notice
              : css.successNotice}>
              {t('research.evaluation', { score: artifact.evaluation.score, threshold: artifact.evaluation.threshold })}
              {' '}{artifact.evaluation.overlap ? t('research.overlap') : t('research.noOverlap')}
              <div>{summaryText(artifact.evaluation.rationale, 180)}</div>
            </div>
          </section>
        )}
        {artifact?.kind === 'plan' && artifact.source !== undefined && (
          <div className={css.successNotice}>{t('research.planWritten', { path: artifact.source })}</div>
        )}
        {artifact?.kind === 'plan' && artifact.source === undefined && (
          <div className={css.notice}>{t('research.planPreview')}</div>
        )}
        {canMutate && selected.stage === 'problem-summary' && (
          <div className={css.directionControls}>
            <div className={css.subtle}>{t('research.directionTitle')}</div>
            {([
              ['novelty', 'research.direction.novelty'],
              ['impact', 'research.direction.impact'],
              ['feasibility', 'research.direction.feasibility'],
              ['reproducibility', 'research.direction.reproducibility'],
            ] as const).map(([key, labelKey]) => (
              <label key={key} className={css.weightRow}>
                <span>{t(labelKey)}</span>
                <input type="range" min="0" max="100" step="1" value={directionWeights[key]} aria-label={t(labelKey)} onChange={(event) => { setDirectionWeights(current => ({ ...current, [key]: Number(event.target.value) })) }} />
                <output>{directionWeights[key]}</output>
              </label>
            ))}
            <div className={css.subtle}>{t('research.directionFocuses')}</div>
            <div className={css.reviewerRow}>
              {([
                ['method', 'research.focus.method'],
                ['data', 'research.focus.data'],
                ['theory', 'research.focus.theory'],
                ['efficiency', 'research.focus.efficiency'],
                ['application', 'research.focus.application'],
              ] as const).map(([focus, labelKey]) => (
                <label key={focus} className={css.reviewer}>
                  <input
                    type="checkbox"
                    checked={directionFocuses.includes(focus)}
                    onChange={(event) => {
                      setDirectionFocuses(current => event.target.checked
                        ? [...new Set([...current, focus])]
                        : current.filter(item => item !== focus))
                    }}
                  />
                  {t(labelKey)}
                </label>
              ))}
            </div>
            <div className={css.subtle}>{t('research.literatureSources')}</div>
            <div className={css.reviewerRow}>
              {([
                ['arxiv', 'research.source.arxiv'],
                ['openreview', 'research.source.openreview'],
                ['semantic-scholar', 'research.source.semanticScholar'],
                ['acl-anthology', 'research.source.aclAnthology'],
                ['openalex', 'research.source.openAlex'],
              ] as const).map(([source, labelKey]) => (
                <label key={source} className={css.reviewer}>
                  <input type="checkbox" checked={literatureSources.includes(source)} onChange={(event) => { setLiteratureSources(current => event.target.checked ? [...new Set([...current, source])] : current.filter(item => item !== source)) }} />
                  {t(labelKey)}
                </label>
              ))}
            </div>
          </div>
        )}
        {(selected.stage === 'paper-upload' || selected.stage === 'literature-search' || selected.stage === 'targeted-literature-search') && (
          <>
            <div className={css.uploadPanel}>
              <div className={css.uploadCopy}>
                <span className={css.uploadTitle}>{selected.stage === 'paper-upload' ? t('research.upload') : t('research.uploadSupplemental')}</span>
                <span className={css.subtle}>{selected.stage === 'paper-upload' ? t('research.uploadHint') : t('research.uploadSupplementalHint')}</span>
              </div>
              <input ref={inputRef} className={css.fileInput} type="file" multiple accept=".pdf,.txt,application/pdf,text/plain" onChange={upload} />
            </div>
          </>
        )}
        {canMutate && ideaNeedsReview && (
          <>
            <div className={css.subtle}>{t('research.innovation')}</div>
            <textarea className={css.feedback} value={feedback} placeholder={t('research.feedbackPlaceholder')} onChange={(event) => { setFeedback(event.target.value) }} />
            {selected.stage === 'idea-generation' && (
              <span className={css.subtle}>{t('research.innovationCheck')}{innovationClaimPasses(artifact) ? t('research.pass') : t('research.needsWork')}</span>
            )}
          </>
        )}
        {canMutate && selected.stage === 'targeted-literature-search' && (
          <>
            <div className={css.subtle}>{t('research.roles')}</div>
            <div className={css.reviewerRow}>
              {REVIEWER_ROLES.map(({ key, role }) => {
                const label = t(key)
                return <label key={key} className={css.reviewer}><input type="checkbox" disabled={busy || loading} checked={reviewers.includes(role)} onChange={(event) => { setReviewers(current => event.target.checked ? [...current, role] : current.filter(item => item !== role)) }} />{label}</label>
              })}
            </div>
          </>
        )}
        {canMutate && selected.stage === 'simulation-or-final-plan' && (
          <div className={css.choiceRow}>
            <button type="button" disabled={busy || loading || !simulationAvailable} className={choice === 'simulation' ? `${css.button} ${css.branchActive}` : css.button} onClick={() => { setChoice('simulation') }}><IconPlayOutlineRegular size={13} /> {t('research.simulate')}</button>
            <button type="button" disabled={busy || loading} className={choice === 'plan' ? `${css.button} ${css.branchActive}` : css.button} onClick={() => { setChoice('plan') }}>{t('research.plan')}</button>
            {!simulationAvailable && <span className={css.subtle}>{t('research.simulationUnavailable')}</span>}
          </div>
        )}
      </section>
    </div>
  )
}

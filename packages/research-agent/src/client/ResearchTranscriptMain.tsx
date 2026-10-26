import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  ResearchArtifact,
  ResearchNode,
  ResearchNodeStatus,
  ResearchRemote,
  ResearchStage,
  ResearchState,
} from 'dsh-research-agent/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { MarkdownText, type MarkdownLabels } from '@deepseek-ai/dsh-client-ui-primitives'
import type { WorkflowRunKey } from './locales.ts'
import {
  publishResearchSession,
  useResearchSession,
} from './research-session-store.ts'
import css from './ResearchPanel.module.css'

/** Services supplied to the main conversation's research projection. */
export interface ResearchTranscriptMainInjected {
  readonly research: Pick<ResearchRemote, 'read' | 'selectNode'>
}

type ResearchTranscriptMainProps = { readonly sessionId: SessionId }
  & PropsLocale<'researchAgent'>
  & ResearchTranscriptMainInjected

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

function stageText(stage: ResearchStage, t: ResearchTranscriptMainProps['t']): string {
  return t(STAGE_KEYS[stage])
}

function statusText(status: ResearchNodeStatus, t: ResearchTranscriptMainProps['t']): string {
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

function latestArtifacts(state: ResearchState, node: ResearchNode): readonly ResearchArtifact[] {
  return node.artifactRefs.flatMap((id) => {
    const artifact = state.artifacts[id]
    return artifact === undefined ? [] : [artifact]
  })
}

function lineage(state: ResearchState, nodeId: string): readonly ResearchNode[] {
  const result: ResearchNode[] = []
  const visited = new Set<string>()
  let current = state.nodes[nodeId]
  while (current !== undefined && !visited.has(current.nodeId)) {
    visited.add(current.nodeId)
    result.push(current)
    current = current.parentNodeId === undefined ? undefined : state.nodes[current.parentNodeId]
  }
  return result.reverse()
}

/** Return all messages on the selected branch, including immutable ancestors. */
function visibleNodes(state: ResearchState): readonly ResearchNode[] {
  const selected = state.nodes[state.selectedNodeId]
  if (selected === undefined) return []
  // A historical selection is a point-in-time view. Keep later nodes in the
  // branch graph (the right panel owns that archive), but do not project them
  // into the main conversation where they could be mistaken for descendants
  // of the selected memory state.
  return lineage(state, selected.nodeId)
}

function publishCommand(
  sessionId: SessionId,
  result: Awaited<ReturnType<ResearchRemote['selectNode']>>,
): void {
  if (result.ok) publishResearchSession(sessionId, result.value.snapshot)
}

/** Render every completed research task in the active Chat view. */
export function ResearchTranscriptMain({ sessionId, research, t }: ResearchTranscriptMainProps): ReactNode {
  const snapshot = useResearchSession(research, sessionId)
  const [expandedNodes, setExpandedNodes] = useState<ReadonlySet<string>>(() => new Set())
  const transcriptRef = useRef<HTMLElement>(null)
  const markdownLabels = useMemo<MarkdownLabels>(() => ({
    code: {
      copyLabel: t('research.copy'),
      copiedLabel: t('research.copied'),
      toolbarLabels: {
        codeLabel: t('research.codeBlockTitle'),
        wrapLabel: t('research.codeWrap'),
        unwrapLabel: t('research.codeUnwrap'),
      },
    },
    footnotes: t('research.footnotes'),
  }), [t])

  useEffect(() => {
    const selectedId = snapshot?.state.selectedNodeId
    if (selectedId === undefined) return
    setExpandedNodes(current => current.has(selectedId) ? current : new Set([...current, selectedId]))
    const target = [...(transcriptRef.current?.querySelectorAll<HTMLElement>('[data-research-main-node]') ?? [])]
      .find(element => element.dataset.researchMainNode === selectedId)
    if (target !== undefined && typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [snapshot?.state.selectedNodeId])
  if (snapshot === undefined) return null
  // `read` returns an in-memory upload root for sessions that have never
  // started research. Keep the main Chat surface unchanged until a paper has
  // produced the first durable artifact; the right panel remains the explicit
  // place to start a new research workflow.
  if (snapshot.revision === 0 && Object.keys(snapshot.state.artifacts).length === 0) return null
  const nodes = visibleNodes(snapshot.state)
  if (nodes.length === 0) return null
  const selectedId = snapshot.state.selectedNodeId
  const selectedNode = snapshot.state.nodes[selectedId]
  const viewedBranch = selectedNode === undefined ? undefined : snapshot.state.branches[selectedNode.branchId]
  const selectNode = (nodeId: string): void => {
    if (nodeId === selectedId) return
    void research.selectNode({ sessionId, expectedRevision: snapshot.revision, nodeId })
      .then((result) => { publishCommand(sessionId, result) })
  }
  const toggleNode = (nodeId: string): void => {
    setExpandedNodes((current) => {
      const next = new Set(current)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }
  const activateNode = (nodeId: string): void => {
    selectNode(nodeId)
    toggleNode(nodeId)
  }
  return (
    <section ref={transcriptRef} className={css.mainTranscript} data-research-main-transcript data-research-selected-node={selectedId}>
      <div className={css.mainTranscriptHeader}>
        <span className={css.cardTitle}>{t('research.contentTitle')}</span>
        <span className={css.subtle}>{t('research.branch')}: {viewedBranch?.label}</span>
      </div>
      <div className={css.mainTranscriptMessages}>
        {nodes.map((node) => {
          const artifacts = latestArtifacts(snapshot.state, node)
          const selected = node.nodeId === selectedId
          const expanded = expandedNodes.has(node.nodeId)
          return (
            <article
              key={node.nodeId}
              className={[
                css.mainTranscriptMessage,
                selected ? css.mainTranscriptMessageSelected : undefined,
                expanded ? css.mainTranscriptMessageExpanded : undefined,
              ].filter(Boolean).join(' ')}
              data-research-main-node={node.nodeId}
              data-expanded={expanded ? 'true' : 'false'}
              role="button"
              tabIndex={0}
              aria-current={selected ? 'step' : undefined}
              aria-expanded={expanded}
              onClick={() => { activateNode(node.nodeId) }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  activateNode(node.nodeId)
                }
              }}
            >
              <div className={css.mainTranscriptMessageHeader}>
                <span className={css.cardTitle}>{stageText(node.stage, t)}</span>
                <span className={css.mainTranscriptMessageMeta}>
                  <span className={css.subtle}>{statusText(node.status, t)}</span>
                  <span className={css.mainTranscriptToggle}>{expanded ? t('research.collapse') : t('research.expand')}</span>
                </span>
              </div>
              {artifacts.length === 0
                ? <p className={css.mainTranscriptEmpty}>{t('research.emptyArtifact')}</p>
                : artifacts.map(artifact => (
                  <div key={artifact.artifactId} className={css.mainTranscriptArtifact}>
                    <div className={css.mainTranscriptArtifactTitle}>{artifact.title}</div>
                    <div
                      className={css.mainTranscriptContent}
                      data-research-main-content
                      onClick={(event) => {
                        event.stopPropagation()
                        if (event.target instanceof Element && event.target.closest('a,button') !== null) return
                        toggleNode(node.nodeId)
                      }}
                    >
                      <MarkdownText text={artifact.content} labels={markdownLabels} />
                    </div>
                  </div>
                ))}
            </article>
          )
        })}
      </div>
    </section>
  )
}

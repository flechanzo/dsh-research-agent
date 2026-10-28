import type { ReactNode } from 'react'
import { IconBranchOutlineRegular, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type {
  ResearchNode,
  ResearchRemote,
  ResearchState,
} from 'dsh-research-agent/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { publishResearchSession, useResearchSession } from './research-session-store.ts'
import css from './ResearchBranchAction.module.css'

/** Host capability supplied to the same-Session research branch action. */
export interface ResearchBranchActionInjected {
  readonly research: Pick<ResearchRemote, 'read' | 'continueFromNode'>
}

type ResearchBranchActionProps = { readonly sessionId: SessionId; readonly seq: number; readonly branchUnavailable: boolean }
  & PropsLocale<'researchAgent'>
  & ResearchBranchActionInjected

function branchNodeAtSequence(state: ResearchState, sessionId: SessionId, seq: number): ResearchNode | undefined {
  const branch = state.branches[state.activeBranchId]
  if (branch === undefined) return undefined
  return branch.nodeIds
    .map(nodeId => state.nodes[nodeId])
    .filter((node): node is ResearchNode => node !== undefined
      && (node.sourceSessionId === undefined || node.sourceSessionId === sessionId)
      && node.sessionSeq !== undefined
      && node.sessionSeq <= seq)
    .at(-1)
}

/** Render a research-only branch control without opening a new Conversation. */
export function ResearchBranchAction({ sessionId, seq, branchUnavailable, research, t }: ResearchBranchActionProps): ReactNode {
  const snapshot = useResearchSession(research, sessionId)
  if (snapshot === undefined) return null
  const node = branchNodeAtSequence(snapshot.state, sessionId, seq)
  if (node === undefined) return null
  const continueFromNode = (): void => {
    if (branchUnavailable) return
    void research.continueFromNode({
      sessionId,
      expectedRevision: snapshot.revision,
      nodeId: node.nodeId,
    }).then((result) => {
      if (result.ok) publishResearchSession(sessionId, result.value.snapshot)
    })
  }
  return (
    <Tooltip label={t('research.continue')} side="bottom">
      <button
        type="button"
        className={css.action}
        aria-label={t('research.continue')}
        aria-disabled={branchUnavailable || undefined}
        data-unavailable={branchUnavailable || undefined}
        onClick={continueFromNode}
      >
        <IconBranchOutlineRegular />
      </button>
    </Tooltip>
  )
}

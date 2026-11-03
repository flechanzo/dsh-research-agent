import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { SessionId, ResearchRemote, ResearchTargetTaskProposal, TargetTaskFields } from 'dsh-research-agent/client'
import css from './Rubric.module.css'
const LABELS: Record<keyof TargetTaskFields, string> = {
  domain: '研究领域', problem: '具体任务或问题', input: '输入', output: '输出', constraints: '约束',
  conditions: '适用条件', subtaskBoundary: '必要子任务边界', comparisonPoint: '比较时点（YYYY-MM-DD）',
}
export interface ConfirmableTarget {
  readonly proposal: ResearchTargetTaskProposal
  readonly confirmed: boolean
}
/** The extractor only drafts; the explicit checkbox and stage confirmation bind the input. */
export function TargetTaskEditor({ research, sessionId, revision, signal, onChange }: {
  readonly research: ResearchRemote
  readonly sessionId: SessionId
  readonly revision: number
  readonly signal: AbortSignal
  readonly onChange: (value: ConfirmableTarget | undefined) => void
}): ReactNode {
  const [proposal, setProposal] = useState<ResearchTargetTaskProposal>()
  const [confirmed, setConfirmed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>()
  const change = useRef(onChange)
  change.current = onChange
  const load = async (): Promise<void> => {
    setLoading(true)
    setError(undefined)
    setConfirmed(false)
    change.current(undefined)
    try {
      const result = await research.proposeTargetTask({ sessionId, expectedRevision: revision }, signal)
      if (signal.aborted)
        return
      if (!result.ok) {
        setError(result.error.message)
        return
      }
      setProposal(result.value)
      change.current({ proposal: result.value, confirmed: false })
    }
    catch {
      if (!signal.aborted)
        setError('目标任务提取失败；请重新提取。')
    }
    finally {
      if (!signal.aborted)
        setLoading(false)
    }
  }
  useEffect(() => { void load() }, [sessionId, revision])
  return <section className={css.card} data-target-task-editor aria-busy={loading}>
    <h3>确认评估范围</h3>
    <p className={css.description}>草稿来自已确认摘要、研究问题和分支记忆。请核对任务范围、邻近等价问题及比较时点；确认后，本次评估固定使用此输入。</p>
    {loading && <p role="status">正在提取目标任务草稿…</p>}
    {error !== undefined && <p role="alert">{error}</p>}
    {!loading && <button type="button" onClick={() => { void load() }}>重新提取目标任务</button>}
    <div className={css.fieldGrid}>{proposal !== undefined && Object.entries(LABELS).map(([name, label]) => {
      const key = name as keyof TargetTaskFields
      return <label className={css.field} key={key}>{label}
        <textarea aria-label={label} value={proposal.fields[key]} rows={key === 'problem' || key === 'subtaskBoundary' ? 3 : 2} onChange={(event) => {
          const next = { ...proposal, fields: { ...proposal.fields, [key]: event.target.value } }
          setProposal(next)
          setConfirmed(false)
          change.current({ proposal: next, confirmed: false })
        }}/>
      </label>
    })}</div>
    {proposal !== undefined && <label className={css.confirmation}>
      <input type="checkbox" checked={confirmed} onChange={(event) => {
        setConfirmed(event.target.checked)
        change.current({ proposal, confirmed: event.target.checked })
      }}/><span>我已核对并确认目标任务及比较范围</span></label>}
  </section>
}

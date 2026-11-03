import { useEffect, useState, type ReactNode } from 'react'
import type { ResearchRemote, ShadowAudit, SessionId } from 'dsh-research-agent/client'
import css from './Rubric.module.css'
import { RubricAssessmentView } from './RubricAssessmentView.tsx'
/** An audit survives a failed legacy transaction; revision is only a refresh trigger. */
export function ShadowAuditView({
  research,
  sessionId,
  busy,
  revision,
}: {
  readonly research: ResearchRemote
  readonly sessionId: SessionId
  readonly busy: boolean
  readonly revision: number
}): ReactNode {
  const [audits, setAudits] = useState<readonly ShadowAudit[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    const read = async (): Promise<void> => {
      try {
        const r = await research.readShadowAudits({ sessionId })
        if (active) {
          if (r.ok) {
            setAudits(r.value)
            setError('')
          } else setError(r.error.message)
        }
      } catch (e) {
        if (active) setError(String(e))
      }
    }
    if (typeof research.readShadowAudits !== 'function') return
    void read()
    const timer = busy
      ? setInterval(() => {
        void read()
      }, 2000)
      : undefined
    return () => {
      active = false
      if (timer) clearInterval(timer)
    }
  }, [research, sessionId, busy, revision])
  return (
    <details className={[css.card, css.audit].filter(Boolean).join(' ')} data-shadow-audits>
      <summary>Shadow 候选对照（{audits.length}，含旧拒绝）</summary>
      {error && <p role="alert">审计读取失败：{error}</p>}
      {audits.map(a => (
        <details
          key={a.id}
          data-shadow-id={a.id}
          data-shadow-legacy={a.legacy.status}
          data-shadow-lifecycle={a.lifecycle}
        >
          <summary>
            候选 {a.attempt} · 旧流程 {a.legacy.status} · Shadow {a.lifecycle} · S={a.assessment?.score.S ?? 'null'}
          </summary>
          <p>{a.reason}</p>
          <p>
            旧评分：{a.legacy.evaluation?.score ?? '未完成'}；{a.legacy.reason}
          </p>
          {a.disagreements.map((d, i) => (
            <p key={i}>
              {d.kind}：{d.reason}
            </p>
          ))}
          <details>
            <summary>候选、资源与完整审计</summary>
            <pre data-shadow-json>{JSON.stringify(a, null, 2)}</pre>
          </details>
          {a.assessment && <RubricAssessmentView assessment={a.assessment} />}
        </details>
      ))}
    </details>
  )
}

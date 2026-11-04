import { useEffect, useState, type ReactNode } from 'react'
import type { ResearchRemote, ShadowAudit, SessionId } from 'dsh-research-agent/client'
import css from './Rubric.module.css'
import { RubricAssessmentView } from './RubricAssessmentView.tsx'
import { consumeResearchStream } from './research-stream.ts'
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
  const [resuming, setResuming] = useState(false)
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
    const timer = busy || resuming
      ? setInterval(() => {
        void read()
      }, 2000)
      : undefined
    return () => {
      active = false
      if (timer) clearInterval(timer)
    }
  }, [research, sessionId, busy, resuming, revision])
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
          {a.assessmentId && ['budget-exhausted','interrupted','cancelled','insufficient'].includes(a.lifecycle) &&
            <RubricResume audit={a} busy={busy || resuming} onResume={async (budget) => {
              setResuming(true)
              try {
                const request = { sessionId, expectedRevision: revision, assessmentId: a.assessmentId ?? '', auditId: a.id, budget }
                const result = typeof research.resumeRubricStream === 'function'
                  ? await consumeResearchStream(research.resumeRubricStream(request)) : await research.resumeRubric(request)
                if (result.ok) { setAudits(rows => rows.some(row => row.id === result.value.id)
                  ? rows.map(row => row.id === result.value.id ? result.value : row) : [...rows, result.value]); setError('') }
                else setError(result.error.message)
              } catch (e) { setError(String(e)) } finally { setResuming(false) }
            }} />}
        </details>
      ))}
    </details>
  )
}

type ResumeBudget = {
  maxMilliseconds: number
  maxStageMilliseconds: number
  maxModelCalls: number
  maxNetworkOperations: number
  maxPromptCharacters: number
  maxPdfPages: number
  maxOcrPages: number
}
function RubricResume({ audit, busy, onResume }: {
  readonly audit: ShadowAudit
  readonly busy: boolean
  readonly onResume: (budget: ResumeBudget) => Promise<void>
}): ReactNode {
  const [confirmed,setConfirmed]=useState(false)
  const [budget,setBudget]=useState({
    maxMilliseconds: Math.max(audit.policy.maxMilliseconds, 600000),
    maxStageMilliseconds: Math.max(audit.policy.maxStageMilliseconds, 120000),
    maxModelCalls: audit.policy.maxModelCalls,
    maxNetworkOperations: audit.policy.maxNetworkOperations,
    maxPromptCharacters: audit.policy.maxPromptCharacters,
    maxPdfPages: audit.policy.maxPdfPages,
    maxOcrPages: audit.policy.maxOcrPages,
  })
  const fields=[['maxMilliseconds','总时间（毫秒）'],['maxStageMilliseconds','每阶段时间（毫秒）'],['maxModelCalls','最多模型请求'],['maxNetworkOperations','最多网络操作'],['maxPromptCharacters','最多提示字符'],['maxPdfPages','最多 PDF 页数'],['maxOcrPages','最多 OCR 页数']] as const
  return <details data-rubric-resume><summary>配置新预算并恢复 Rubric</summary>
    <p>任务、源码及模型一致时复用有效阶段；版本不可确认或已变化时，保留旧记录并重新评估同一候选。崩溃前已计费但未保存的请求可能重复计费。</p>
    {fields.map(([key,label])=><label key={key}>{label}<input aria-label={label} type="number" min="0" value={budget[key]} disabled={busy} onChange={(e)=>{ setBudget(previous=>({ ...previous,[key]:Number(e.target.value) })) }}/></label>)}
    <label><input type="checkbox" checked={confirmed} disabled={busy} onChange={(e)=>{ setConfirmed(e.target.checked) }}/>我已核对当前模型路由并授权上述本次预算</label>
    <button disabled={busy || !confirmed} onClick={()=>{setConfirmed(false);void onResume(budget)}}>按新预算恢复 Rubric</button>
  </details>
}

import type { ReactNode } from 'react'
import type { RubricAssessment } from 'dsh-research-agent/client'
import css from './Rubric.module.css'
/** Evidence remains available even when the numerical score is null. */
export function RubricAssessmentView({ assessment: a }: { readonly assessment: RubricAssessment }): ReactNode {
  return (
    <section
      className={css.card}
      data-rubric-assessment
      data-rubric-status={a.assessmentStatus}
      data-rubric-score={a.score.S === null ? 'null' : String(a.score.S)}
    >
      <h3>Rubric v1.7.0 创新评估（验证模式）</h3>
      <div className={css.scoreRow}>
        <strong className={css.score}>{a.score.S === null ? '—' : a.score.S}<small> / 10</small></strong>
        <span className={css.badge}>{a.score.S === null ? '证据不足，暂不评分' : '创新性评分'}</span>
        <span className={css.description}>{{ complete: '评估完成', provisional: '暂定结论', insufficient: '证据不足' }[a.assessmentStatus]}</span>
      </div>
      {a.legacyComparison !== undefined && (
        <p>
          旧评分 {a.legacyComparison.score} / 100，门槛 {a.legacyComparison.threshold}，
          {a.legacyComparison.pass ? '通过' : '未通过'}。{a.legacyComparison.disagreement}
        </p>
      )}
      <p>{a.synthesis}</p>
      <p>
        置信度：{a.confidence.level} — {a.confidence.reason}
      </p>
      {a.uncertainties.length > 0 && (
        <ul>
          {a.uncertainties.map((u, i) => (
            <li key={i}>{u}</li>
          ))}
        </ul>
      )}
      <details>
        <summary>固定目标任务与比较范围</summary>
        <pre>
          {JSON.stringify(
            {
              targetTask: a.targetTask,
              comparisonScope: a.comparisonScope,
            },
            null,
            2,
          )}
        </pre>
      </details>
      <details data-rubric-audit>
        <summary>查新审计（{a.searchAudit.length} 个贡献轮次）</summary>
        {a.searchAudit.map((r, i) => (
          <details key={i} data-rubric-round={r.round}>
            <summary>
              {r.contributionId} · Round {r.round} · {r.purpose}
            </summary>
            <p>时间：{r.startedAt}</p>
            <p>前轮驱动：{r.adjustmentFromPrevious}</p>
            <ul>
              {r.queries.map(q => (
                <li key={q}>{q}</li>
              ))}
            </ul>
            <p>判断变化：{r.review.changeFromPrevious}</p>
            <p>最近先例：{r.review.nearestPrecedents.join('；')}</p>
            <p>支持依据：{r.review.support.join('；') || '未确认新增'}</p>
            <p>潜在反例：{r.review.counterexamples.join('；') || '在本轮范围未发现'}</p>
            <p>排除理由：{r.review.exclusions.join('；') || '没有排除已命中的先例'}</p>
            {r.sources.map(s => (
              <div key={s.sourceId}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
                <p>
                  {s.publicationDate} · HTTP {s.acquisition.status} · {s.acquisition.transport} · SHA256{' '}
                  {s.acquisition.sha256}
                </p>
                {s.provenance && (
                  <p>
                    正文：{s.provenance.coverage} · 版本：{s.provenance.version} · 文本 SHA256 {s.provenance.textSha256}{' '}
                    · 截断：{String(s.provenance.truncated)} · 页数 {s.provenance.processedPageCount ?? '—'}/
                    {s.provenance.pageCount ?? '—'}
                  </p>
                )}
                {s.readings.map((e, j) => (
                  <blockquote key={j}>
                    <p>{e.location}</p>
                    <p>{e.quote}</p>
                  </blockquote>
                ))}
              </div>
            ))}
            {r.errors.map((e, j) => (
              <p key={j}>{e}</p>
            ))}
          </details>
        ))}
      </details>
      <details>
        <summary>贡献、有效性与确定性计算</summary>
        <p>
          主导：{a.score.mainId ?? '未确定'}；U_main={a.score.U_main ?? 'null'}；S_main={a.score.S_main ?? 'null'}；J=
          {a.score.J}；M={a.score.M}；S={a.score.S ?? 'null'}
        </p>
        <p>{a.score.caps}</p>
        <pre>
          {JSON.stringify(
            {
              contributions: a.contributions,
              score: a.score,
              mainline: a.mainline,
              facts: a.facts,
              sameFactGroups: a.sameFactGroups,
              validityCheck: a.validityCheck,
            },
            null,
            2,
          )}
        </pre>
      </details>
      <details>
        <summary>完整审计 JSON</summary>
        <pre data-rubric-json>{JSON.stringify(a, null, 2)}</pre>
      </details>
    </section>
  )
}

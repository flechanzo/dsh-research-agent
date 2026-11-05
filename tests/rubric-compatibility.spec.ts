import { expect, it } from 'vitest'
import { researchDomain } from '../packages/research-agent/lib/index.js'
import { appendResearchOutput, createResearchState } from '../packages/research-agent/src/workflows/research.ts'

const schema = researchDomain.tables.sessions.valueSchema

it('reads old records and preserves the historical 0–100 evaluation without rerunning it', () => {
  const evaluation = { score: 83, threshold: 70, overlap: false, rationale: '历史评分不重算' }
  const state = appendResearchOutput(createResearchState(), {
    stage: 'idea-generation',
    kind: 'idea',
    title: '旧结果',
    content: '创新点：旧结果',
    evaluation,
  })
  const result = schema.parse({ revision: 12, state, updatedAt: 1 })
  expect(result.state.artifacts['artifact-1']?.evaluation).toEqual(evaluation)
  expect(result.state.artifacts['artifact-1']?.rubricAssessment).toBeUndefined()
  expect(researchDomain.version).toBe(1)
})

it('keeps a complete historical rubricAssessment readable without creating a new score', () => {
  const historical = {
    rubricVersion: '1.7.0',
    rubricSha256: 'legacy',
    mode: 'shadow',
    assessedAt: '2026-01-01T00:00:00.000Z',
    targetTask: null,
    assessmentStatus: 'insufficient',
    comparisonScope: {
      assessedObject: '历史候选',
      paperVersion: 'legacy',
      comparisonPoint: '2026-01-01',
      coverage: '历史记录',
      missingCriticalSources: [],
    },
    searchAudit: [],
    mainline: { status: 'unknown', reasoning: '历史记录未完成' },
    noveltyUnit: '历史记录',
    contributions: [],
    facts: [],
    sameFactGroups: [],
    sourceModuleAssessment: [],
    problemComparison: [],
    boundaryChecks: [],
    validityCheck: [],
    score: {
      candidates: [],
      mainId: null,
      U_main: null,
      S_main: null,
      J: 0,
      M: 4,
      S: null,
      caps: '历史结果未评分',
    },
    confidence: { level: 'low', reason: '历史记录未完成' },
    uncertainties: ['历史评估未完成'],
    stages: [],
    synthesis: '历史记录，仅供查看',
    legacyComparison: {
      score: 83,
      threshold: 70,
      pass: true,
      disagreement: '历史记录，仅供查看',
    },
  } as const
  const state = appendResearchOutput(createResearchState(), {
    stage: 'idea-generation',
    kind: 'idea',
    title: '历史 Rubric 结果',
    content: '旧会话',
    rubricAssessment: historical,
  })
  const result = schema.parse({ revision: 13, state, updatedAt: 2 })
  expect(result.state.artifacts['artifact-1']?.rubricAssessment).toEqual(historical)
})

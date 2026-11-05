import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  appendResearchOutput,
  confirmResearchNode,
  createResearchState,
  ResearchCoordinator,
  type ResearchCoordinatorAdapters,
} from '../packages/research-agent/src/workflows/index.ts'
import { validateResearchEvidenceBundle, type ResearchEvidence } from '../packages/research-agent/src/innovation/research-evidence.ts'
import type { RubricDocument } from '../packages/research-agent/src/innovation/pipeline.ts'
import type { Agent } from '@deepseek-ai/dsh-agent'

const parent = {} as Agent
const quote = 'The method allocates rank according to measured layer importance.'
const quoteSha256 = createHash('sha256').update(quote).digest('hex')

function record(): ResearchEvidence {
  return {
    evidenceId: 'evidence-1',
    sourceId: 'arxiv:2401.00001',
    sourceRef: 'https://arxiv.org/abs/2401.00001',
    sourceTitle: 'Rank Allocation',
    provider: 'arxiv',
    workId: 'arxiv:2401.00001',
    version: 'v1',
    publicationDate: '2024-01-01',
    acquiredAt: '2026-11-05T00:00:00.000Z',
    textSha256: 'a'.repeat(64),
    coverage: 'core-complete',
    extraction: 'html',
    location: { label: 'method', start: 0, end: quote.length },
    quote,
    quoteSha256,
    verification: 'exact',
  }
}

describe('structured research evidence', () => {
  it('validates exact quotes, claim references, and search provenance', () => {
    const evidence = record()
    const bundle = validateResearchEvidenceBundle({
      evidence: [evidence],
      claims: [{ claimId: 'claim-1', statement: 'The prior method uses rank allocation.', kind: 'fact', evidenceIds: [evidence.evidenceId], status: 'supported' }],
      searchRuns: [{
        searchRunId: 'search-1', query: 'rank allocation', queryStrategy: 'index then full text', providers: ['arxiv'],
        startedAt: '2026-11-05T00:00:00.000Z', endedAt: '2026-11-05T00:01:00.000Z', sourceIds: [evidence.sourceId],
        attempts: 1, deduplicatedCount: 1, status: 'found', completeness: 'sufficient', failures: [],
      }],
    })
    expect(bundle.evidence[0]?.quoteSha256).toBe(quoteSha256)
    expect(bundle.claims[0]?.evidenceIds).toEqual(['evidence-1'])
  })

  it('rejects an exact quote from partial source coverage and missing claim evidence', () => {
    expect(() => validateResearchEvidenceBundle({
      evidence: [{ ...record(), coverage: 'partial' }],
      claims: [{ claimId: 'claim-1', statement: 'Unsupported', kind: 'fact', evidenceIds: ['missing'], status: 'supported' }],
      searchRuns: [],
    })).toThrow(/exact evidence|missing evidence/u)
  })

  it('reads candidate-specific sources and passes verified excerpts to the reviewer', async () => {
    const reviewerPrompts: string[] = []
    const document: RubricDocument = {
      id: 'doc-1', title: 'Rank Allocation', text: quote, url: 'https://arxiv.org/abs/2401.00001', primary: true,
      publicationDate: '2024-01-01', workId: 'arxiv:2401.00001', acquisition: {
        url: 'https://arxiv.org/abs/2401.00001', at: '2026-11-05T00:00:00.000Z', status: 200,
        sha256: 'b'.repeat(64), transport: 'dsh-web', truncated: false,
      }, provenance: {
        originalUrl: 'https://arxiv.org/abs/2401.00001', version: 'v1', versionDate: '2024-01-01',
        textSha256: 'a'.repeat(64), coverage: 'core-complete', extraction: 'html', truncated: false,
        locations: [{ label: 'method', start: 0, end: quote.length }], links: [],
      },
    }
    const adapters: ResearchCoordinatorAdapters = {
      literature: {
        async search() { return [{ url: document.url!, provider: 'arxiv', title: document.title, publishedAt: document.publicationDate! }] },
        async read() { return document },
      },
      papers: { async read() { throw new Error('paper reader is not used') } },
      agents: {
        async run(role, prompt) {
          if (role === 'idea-generator') return '创新点：根据层重要性进行自适应秩分配。'
          if (role === 'innovation-reviewer') { reviewerPrompts.push(prompt); return JSON.stringify({ score: 88, overlap: false, rationale: '完整先例原文已核验。' }) }
          return '通过'
        },
      },
    }
    let state = appendResearchOutput(createResearchState(), { stage: 'problem-summary', kind: 'problem', title: '问题', content: '研究问题' })
    state = confirmResearchNode(state)
    state = appendResearchOutput(state, { stage: 'literature-search', kind: 'literature', title: '文献', content: '已有证据', status: 'confirmed' })
    const result = await new ResearchCoordinator(adapters).advance({ state, parent })
    expect(result.artifact?.evaluation?.score).toBe(88)
    expect(result.artifact?.evidence?.[0]?.coverage).toBe('core-complete')
    expect(result.artifact?.searchRuns?.[0]?.completeness).toBe('sufficient')
    expect(reviewerPrompts[0]).toContain(quote)
  })

  it('persists provider failures when a literature index is unavailable', async () => {
    const adapters: ResearchCoordinatorAdapters = {
      literature: {
        async search() { throw new Error('search() should not be used when diagnostics are available') },
        async searchWithDiagnostics() {
          return {
            sources: [], failures: [{ provider: 'arxiv', category: 'http-429', attempts: 2, message: 'rate limited' }], attempts: 2,
          }
        },
      },
      papers: { async read() { throw new Error('paper reader is not used') } },
      agents: { async run() { return '通过' } },
    }
    let state = appendResearchOutput(createResearchState(), {
      stage: 'problem-summary', kind: 'problem', title: '问题', content: '研究问题', status: 'confirmed',
    })
    const result = await new ResearchCoordinator(adapters).advance({ state, parent })
    const run = result.artifact?.searchRuns?.[0]
    expect(run?.status).toBe('failed')
    expect(run?.failures[0]).toMatchObject({ provider: 'arxiv', category: 'http-429', attempts: 2 })
  })
})

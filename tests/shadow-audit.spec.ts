import { expect, it, vi } from 'vitest'
import {
  ResearchCoordinator,
  appendResearchOutput,
  confirmResearchNode,
  createResearchState,
} from '../packages/research-agent/src/workflows/index.ts'
import type { ResearchCoordinatorAdapters } from '../packages/research-agent/src/workflows/research-coordinator.ts'
import type { ShadowAudit } from '../packages/research-agent/src/innovation/shadow.ts'
import { taskFields } from './support/rubric-fixture.mjs'

function fixture(scores = [20, 88]) {
  const audits: ShadowAudit[] = []
  let reviewCalls = 0
  const adapter: ResearchCoordinatorAdapters = {
    onShadowAudit: async audit => {
      const copy = structuredClone(audit)
      const index = audits.findIndex(row => row.id === audit.id)
      if (index < 0) audits.push(copy)
      else audits[index] = copy
    },
    papers: {
      read: async paper => ({
        fileName: paper.name,
        text: 'Synthetic paper text',
        byteLength: 100,
        extractionMethod: 'plain-text',
      }),
    },
    literature: { search: async () => [{ url: 'https://example.test/legacy' }] },
    agents: {
      run: async role => {
        if (role === 'idea-generator') return '创新点：工程合成局部规则候选'
        if (role === 'innovation-reviewer') {
          const score = scores[Math.min(reviewCalls++, scores.length - 1)] ?? 0
          return JSON.stringify({ score, overlap: false, rationale: '旧流程夹具' })
        }
        throw new Error(`unexpected retired Rubric role: ${role}`)
      },
    },
    innovation: { maxAttempts: 3, scoreThreshold: 70 },
  }
  let state = appendResearchOutput(createResearchState(), {
    stage: 'paper-read',
    kind: 'summary',
    title: '原文',
    content: 'Synthetic',
    paperRefs: [{ attachmentId: 'sha256:synthetic' as never, name: 'synthetic.txt', bytes: 100 }],
  })
  state = confirmResearchNode(state)
  state = appendResearchOutput(state, {
    stage: 'problem-summary', kind: 'problem', title: '问题', content: '合成任务',
  })
  state = confirmResearchNode(state)
  state = appendResearchOutput(state, {
    stage: 'literature-search', kind: 'literature', title: '证据', content: '已取得的合成来源',
  })
  state = confirmResearchNode(state)
  const node = state.nodes[state.selectedNodeId]!
  state = {
    ...state,
    nodes: {
      ...state.nodes,
      [node.nodeId]: {
        ...node,
        memorySnapshot: {
          ...node.memorySnapshot,
          targetTask: { ...taskFields, contextDigest: 'a'.repeat(64), confirmedAt: 1 },
        },
      },
    },
  }
  return {
    adapter,
    audits,
    state,
    run: (signal?: AbortSignal) => new ResearchCoordinator(adapter).advance({
      state,
      parent: {} as never,
      ...(signal ? { signal } : {}),
    }),
    calls: () => reviewCalls,
  }
}

it('keeps legacy candidate screening while producing no Rubric assessment', async () => {
  const f = fixture()
  const result = await f.run()
  expect(f.calls()).toBe(2)
  expect(f.audits.map(audit => audit.legacy.status)).toEqual(['reject', 'pass'])
  expect(f.audits.every(audit => audit.assessment === undefined)).toBe(true)
  expect(f.audits.every(audit => audit.lifecycle === 'disabled')).toBe(true)
  expect(result.artifact?.evaluation?.score).toBe(88)
})

it('preserves rejected candidate attempts without creating Rubric results', async () => {
  const f = fixture([20])
  const before = JSON.stringify(f.state)
  await expect(f.run()).rejects.toThrow('INNOVATION_SCORE_BELOW_THRESHOLD')
  expect(f.calls()).toBe(3)
  expect(f.audits).toHaveLength(3)
  expect(f.audits.every(audit => audit.legacy.status === 'reject')).toBe(true)
  expect(f.audits.every(audit => audit.assessment === undefined)).toBe(true)
  expect(JSON.stringify(f.state)).toBe(before)
})

it('does not let audit persistence failure hide a successful candidate', async () => {
  const f = fixture([88])
  f.adapter.onShadowAudit = async () => { throw new Error('audit disk unavailable') }
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    expect((await f.run()).artifact?.evaluation?.score).toBe(88)
    expect(warn).toHaveBeenCalledWith('SHADOW_AUDIT_PERSIST_FAILED', expect.any(String), expect.any(Error))
  } finally {
    warn.mockRestore()
  }
})


import { describe, expect, it } from 'vitest'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { AttachmentId } from '@deepseek-ai/dsh-attachment'
import {
  appendResearchOutput,
  confirmResearchNode,
  createAttachmentPaperReader,
  createHostResearchCoordinator,
  createNumericalResearchSimulationRunner,
  createSubagentResearchRunner,
  createWebLiteratureSearcher,
  createResearchState,
  rejectIdea,
  ResearchCoordinator,
  type ResearchCoordinatorAdapters,
} from '../packages/research-agent/src/workflows/index.ts'
import { AttachmentStore } from '@deepseek-ai/dsh-attachment'
import { FileSystem, FsTargetKey, FsVersion, type FsTarget, type FsWriteIntent } from '@deepseek-ai/dsh-fs'
import { SubagentRuntime } from '@deepseek-ai/dsh-subagent'
import { WebRuntime } from '@deepseek-ai/dsh-web'
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox'

const parent = {} as Agent

function adapters(searchQueries: string[] = [], planWriter?: ResearchCoordinatorAdapters['planWriter']): ResearchCoordinatorAdapters {
  return {
    papers: {
      async read(paper) {
        return {
          fileName: paper.name,
          text: 'A paper about retrieval under distribution shift.',
          byteLength: 48,
          extractionMethod: 'plain-text',
        }
      },
    },
    literature: {
      async search(query) {
        searchQueries.push(query)
        return [{ url: 'https://example.test/paper', title: 'Related paper', snippet: 'A useful baseline.' }]
      },
    },
    agents: {
      async run(role) {
        switch (role) {
          case 'paper-summarizer': return '问题：检索在分布偏移下退化。方法：固定检索器。限制：缺少自适应评估。'
          case 'problem-extractor': return '研究缺口：分布偏移时检索器无法识别证据失效，需可测量的自适应机制。'
          case 'idea-generator': return '创新点：引入不确定性门控检索；方法是按证据一致性选择检索深度；基线为固定深度检索。'
          case 'idea-refiner': return '创新点：引入可校准的不确定性门控检索，并以跨域校准误差作为失败标准。'
          case 'innovation-reviewer': return '{"score": 88, "overlap": false, "rationale": "候选方法与给定基线有明确机制差异。"}'
          default: return `${role}：通过；阻塞问题：补充跨域消融；修订：增加三个数据域。`
        }
      },
    },
    ...(planWriter === undefined ? {} : { planWriter }),
  }
}

function confirm(state: Parameters<typeof confirmResearchNode>[0]) {
  return confirmResearchNode(state)
}

describe('ResearchCoordinator', () => {
  it('runs the built-in numerical adapter and reports computed metrics', async () => {
    const runner = createNumericalResearchSimulationRunner()
    const content = await runner.run({
      idea: { artifactId: 'idea-1', kind: 'idea', title: '固定基准', content: '验证数值适配器', createdAt: 0 },
      researchNodeId: 'node-1',
      branchId: 'branch-1',
      task: 'numerical-linear-regression',
      seed: 7,
    })
    expect(content).toContain('- 状态：completed')
    expect(content).toContain('- 任务：numerical-linear-regression')
    expect(content).toContain('- RMSE：0.100995')
    expect(content).toContain('- R²：0.998739')
    expect(content).toContain('随机种子记录：7')
  })

  it('rejects an empty idea before computing any result', async () => {
    const runner = createNumericalResearchSimulationRunner()
    await expect(runner.run({
      idea: { artifactId: 'idea-empty', kind: 'idea', title: '空想法', content: '', createdAt: 0 },
    })).rejects.toThrow('non-empty idea artifact')
  })

  it('honors cancellation before the fixed experiment starts', async () => {
    const controller = new AbortController()
    controller.abort()
    const runner = createNumericalResearchSimulationRunner()
    await expect(runner.run({
      idea: { artifactId: 'idea-aborted', kind: 'idea', title: '已取消', content: '内容', createdAt: 0 },
    }, controller.signal)).rejects.toThrow()
  })

  it('reads several uploaded papers in one comparative stage', async () => {
    const prompts: string[] = []
    const base = adapters()
    const coordinator = new ResearchCoordinator({
      ...base,
      agents: {
        async run(role, prompt, owner, signal) {
          prompts.push(prompt)
          return base.agents.run(role, prompt, owner, signal)
        },
      },
    })
    const papers = [
      { attachmentId: AttachmentId('sha256:paper-a'), name: 'paper-a.txt', bytes: 12 },
      { attachmentId: AttachmentId('sha256:paper-b'), name: 'paper-b.txt', bytes: 13 },
    ] as const
    const result = await coordinator.advance({ state: createResearchState(), parent, papers })
    const artifact = result.artifact
    expect(artifact?.title).toBe('论文摘要（2 篇）')
    expect(artifact?.source).toContain('paper-a.txt')
    expect(artifact?.source).toContain('paper-b.txt')
    expect(prompts[0]).toContain('File: paper-a.txt')
    expect(prompts[0]).toContain('File: paper-b.txt')
  })

  it('asks the problem extractor to retain every distinct question', async () => {
    const prompts: string[] = []
    const base = adapters()
    const coordinator = new ResearchCoordinator({
      ...base,
      agents: {
        async run(role, prompt, owner, signal) {
          if (role === 'problem-extractor') prompts.push(prompt)
          return base.agents.run(role, prompt, owner, signal)
        },
      },
    })
    const paper = { attachmentId: AttachmentId('sha256:questions'), name: 'questions.txt', bytes: 48 } as const
    let state = (await coordinator.advance({ state: createResearchState(), parent, paper })).state
    state = confirm(state)
    await coordinator.advance({ state, parent })
    expect(prompts).toHaveLength(1)
    expect(prompts[0]).toContain('每一个彼此独立且可检验的研究问题')
    expect(prompts[0]).toContain('保持不同问题的答案分开')
  })

  it('executes every confirmed stage and renders a final plan', async () => {
    const searchQueries: string[] = []
    const written: string[] = []
    const coordinator = new ResearchCoordinator(adapters(searchQueries, {
      async write(file) {
        written.push(file.content)
        return { fileName: 'workspace/research-plan.md', content: file.content }
      },
    }))
    const paper = { attachmentId: AttachmentId('sha256:paper'), name: 'paper.txt', bytes: 48 } as const
    let state = createResearchState()

    state = (await coordinator.advance({ state, parent, paper })).state
    expect(state.nodes[state.selectedNodeId]?.stage).toBe('paper-read')
    state = confirm(state)
    state = (await coordinator.advance({ state, parent })).state
    state = confirm(state)
    state = (await coordinator.advance({ state, parent })).state
    expect(state.nodes[state.selectedNodeId]?.stage).toBe('literature-search')
    state = confirm(state)
    state = (await coordinator.advance({ state, parent })).state
    expect(state.artifacts[state.nodes[state.selectedNodeId]?.artifactRefs[0] ?? '']?.content).toContain('创新点')
    state = confirm(state)
    state = (await coordinator.advance({ state, parent })).state
    expect(state.nodes[state.selectedNodeId]?.stage).toBe('idea-refinement')
    state = confirm(state)
    state = (await coordinator.advance({ state, parent })).state
    expect(state.nodes[state.selectedNodeId]?.stage).toBe('targeted-literature-search')
    state = confirm(state)
    state = (await coordinator.advance({ state, parent, reviewerRoles: ['method', 'novelty', 'reproducibility'] })).state
    expect(searchQueries).toHaveLength(4)
    expect(searchQueries[1]).toContain('候选创新点专项查重检索')
    expect(searchQueries[2]).toContain('候选创新点专项查重检索')
    expect(searchQueries[3]).toContain('已确认方向：')
    expect(searchQueries[3]).toContain('可校准的不确定性门控检索')
    state = confirm(state)
    state = (await coordinator.advance({ state, parent })).state
    expect(state.nodes[state.selectedNodeId]?.stage).toBe('simulation-or-final-plan')
    state = confirm(state)
    await expect(coordinator.advance({ state, parent, finalChoice: 'simulation' }))
      .rejects.toThrow('no simulation adapter is configured')
    const preview = await coordinator.advance({ state, parent, finalChoice: 'plan' })
    expect(preview.planFile).toBeUndefined()
    expect(preview.artifact?.title).toBe('完整科研方案（待写入）')
    expect(preview.artifact?.content).toContain('# 自动科研方案')
    expect(preview.state.nodes[preview.state.selectedNodeId]?.status).toBe('awaiting-confirmation')
    expect(written).toHaveLength(0)
    const final = await coordinator.advance({ state: confirm(preview.state), parent })
    expect(final.planFile?.fileName).toBe('workspace/research-plan.md')
    expect(final.planFile?.content).toContain('# 自动科研方案')
    expect(written).toHaveLength(1)
    expect(written[0]).toBe(final.planFile?.content)
    expect(final.artifact?.source).toBe('workspace/research-plan.md')
    expect(final.state.nodes[final.state.selectedNodeId]?.stage).toBe('final-plan')
    expect(final.state.nodes[final.state.selectedNodeId]?.status).toBe('completed')
  })

  it('gives the isolated innovation reviewer all branch evidence and candidate search results', async () => {
    const reviewerPrompts: string[] = []
    const searchQueries: string[] = []
    const base = adapters(searchQueries)
    const coordinator = new ResearchCoordinator({
      ...base,
      agents: {
        async run(role, prompt, owner, signal) {
          if (role === 'innovation-reviewer') reviewerPrompts.push(prompt)
          return base.agents.run(role, prompt, owner, signal)
        },
      },
    })
    let state = createResearchState()
    state = appendResearchOutput(state, {
      stage: 'paper-read', kind: 'summary', title: '上传论文摘要', content: '上传论文提出固定深度检索。',
    })
    state = confirm(state)
    state = appendResearchOutput(state, {
      stage: 'problem-summary', kind: 'problem', title: '研究问题', content: '分布偏移会使检索证据失效。',
    })
    state = confirm(state)
    state = appendResearchOutput(state, {
      stage: 'literature-search', kind: 'literature', title: '初始相关文献', content: '初始论文：自适应检索基线。',
    })
    state = confirm(state)
    state = appendResearchOutput(state, {
      stage: 'literature-search', kind: 'literature', title: '补充相关文献', content: '补充论文：跨域校准方法。',
    })
    state = confirm(state)

    await coordinator.advance({ state, parent })

    expect(reviewerPrompts).toHaveLength(1)
    expect(reviewerPrompts[0]).toContain('上传论文摘要')
    expect(reviewerPrompts[0]).toContain('初始论文：自适应检索基线')
    expect(reviewerPrompts[0]).toContain('补充论文：跨域校准方法')
    expect(reviewerPrompts[0]).toContain('本候选点专项检索结果')
    expect(searchQueries.some(query => query.includes('候选创新点专项查重检索'))).toBe(true)
  })

  it('passes the resolved sandbox policy to the final plan writer', async () => {
    let received: SandboxExecutionPolicy | undefined
    const fs = Object.setPrototypeOf({
      async resolve(path: string) {
        return { targetKey: FsTargetKey(path), displayPath: path }
      },
      async writeText(
        _target: FsTarget,
        content: string,
        _expected?: FsWriteIntent,
        _signal?: AbortSignal,
        policy?: SandboxExecutionPolicy,
      ) {
        received = policy
        return { operation: 'create' as const, version: FsVersion('v1'), before: null, after: content }
      },
    }, FileSystem.prototype) as FileSystem
    const policy: SandboxExecutionPolicy = { mode: 'workspace-write', workspaceRoot: 'C:/research-workspace' }
    const coordinator = createHostResearchCoordinator({
      attachments: Object.setPrototypeOf({}, AttachmentStore.prototype) as AttachmentStore,
      web: Object.setPrototypeOf({}, WebRuntime.prototype) as WebRuntime,
      subagents: Object.setPrototypeOf({}, SubagentRuntime.prototype) as SubagentRuntime,
      fs,
    }, {
      subagentProvider: 'spawn', planPath: 'research-plan.md', maxPaperBytes: 1024,
      maxLiteratureResults: 4, maxPdfPages: 1, ocrScale: 1, maxOcrPixels: 100,
      sandboxPolicy: policy,
    })
    const state = appendResearchOutput(createResearchState(), {
      stage: 'final-plan', kind: 'plan', title: '完整科研方案', content: '# 方案', status: 'confirmed',
    })

    const result = await coordinator.advance({ state, parent })

    expect(received).toEqual(policy)
    expect(result.planFile?.content).toBe('# 方案')
  })

  it('mounts the fixed numerical adapter in the Host factory', async () => {
    const fs = Object.setPrototypeOf({
      async resolve(path: string) {
        return { targetKey: FsTargetKey(path), displayPath: path }
      },
    }, FileSystem.prototype) as FileSystem
    const coordinator = createHostResearchCoordinator({
      attachments: Object.setPrototypeOf({}, AttachmentStore.prototype) as AttachmentStore,
      web: Object.setPrototypeOf({}, WebRuntime.prototype) as WebRuntime,
      subagents: Object.setPrototypeOf({}, SubagentRuntime.prototype) as SubagentRuntime,
      fs,
    }, {
      subagentProvider: 'spawn', planPath: 'research-plan.md', maxPaperBytes: 1024,
      maxLiteratureResults: 4, maxPdfPages: 1, ocrScale: 1, maxOcrPixels: 100,
    })
    let state = createResearchState()
    state = appendResearchOutput(state, {
      stage: 'idea-refinement', kind: 'idea', title: '固定基准候选', content: '验证固定数值模板', status: 'confirmed',
    })
    state = appendResearchOutput(state, {
      stage: 'multi-agent-review', kind: 'review', title: '审查结果', content: '可复核', status: 'confirmed',
    })
    state = appendResearchOutput(state, {
      stage: 'simulation-or-final-plan', kind: 'decision', title: '仿真或直接输出选择', content: '选择仿真', status: 'confirmed',
    })

    const result = await coordinator.advance({ state, parent, finalChoice: 'simulation' })

    expect(result.artifact?.kind).toBe('simulation')
    expect(result.artifact?.content).toContain('- 状态：completed')
    expect(result.artifact?.content).toContain('- 候选方法：固定基准候选')
    expect(result.state.nodes[result.state.selectedNodeId]?.status).toBe('awaiting-confirmation')
  })

  it('leaves research state untouched when a simulation adapter fails', async () => {
    const failure = new Error('simulation failed')
    const coordinator = new ResearchCoordinator({
      ...adapters(),
      simulation: { async run() { throw failure } },
    })
    let state = createResearchState()
    state = appendResearchOutput(state, {
      stage: 'idea-refinement', kind: 'idea', title: '候选', content: '内容', status: 'confirmed',
    })
    state = appendResearchOutput(state, {
      stage: 'multi-agent-review', kind: 'review', title: '审查', content: '通过', status: 'confirmed',
    })
    state = appendResearchOutput(state, {
      stage: 'simulation-or-final-plan', kind: 'decision', title: '仿真或直接输出选择', content: '选择仿真', status: 'confirmed',
    })
    const before = JSON.stringify(state)

    await expect(coordinator.advance({ state, parent, finalChoice: 'simulation' })).rejects.toThrow(failure)
    expect(JSON.stringify(state)).toBe(before)
  })

  it('refuses to run a stage whose output is still awaiting confirmation', async () => {
    const coordinator = new ResearchCoordinator(adapters())
    const state = appendResearchOutput(createResearchState(), {
      stage: 'paper-read', kind: 'summary', title: '摘要', content: '内容',
    })
    await expect(coordinator.advance({ state, parent })).rejects.toThrow('requires user confirmation')
  })

  it('requires an innovation claim before multi-agent review', async () => {
    const badAdapters: ResearchCoordinatorAdapters = {
      ...adapters(),
      agents: {
        async run(role) {
          if (role === 'idea-generator') return '没有可验证的新意。'
          return '创新点：占位审查。'
        },
      },
    }
    const coordinator = new ResearchCoordinator(badAdapters)
    let state = createResearchState()
    const paper = { attachmentId: AttachmentId('sha256:paper'), name: 'paper.txt', bytes: 48 } as const
    state = (await coordinator.advance({ state, parent, paper })).state
    state = confirm(state)
    state = (await coordinator.advance({ state, parent })).state
    state = confirm(state)
    state = (await coordinator.advance({ state, parent })).state
    state = confirm(state)
    await expect(coordinator.advance({ state, parent })).rejects.toThrow('innovation claim')
  })

  it('generates a new idea from a rejected branch while retaining literature evidence', async () => {
    const coordinator = new ResearchCoordinator(adapters())
    let state = createResearchState()
    state = appendResearchOutput(state, { stage: 'problem-summary', kind: 'problem', title: '问题', content: '缺口' })
    state = confirm(state)
    state = appendResearchOutput(state, { stage: 'literature-search', kind: 'literature', title: '文献', content: '证据' })
    state = confirm(state)
    state = appendResearchOutput(state, { stage: 'idea-generation', kind: 'idea', title: '旧想法', content: '创新点：旧方案' })
    const oldBranch = state.activeBranchId
    state = rejectIdea(state, '证据不足')
    expect(state.activeBranchId).not.toBe(oldBranch)
    state = (await coordinator.advance({ state, parent })).state
    const node = state.nodes[state.selectedNodeId]
    expect(node?.stage).toBe('idea-generation')
    expect(node?.status).toBe('awaiting-confirmation')
    expect(node?.memorySnapshot.artifactIds.some(id => state.artifacts[id]?.kind === 'literature')).toBe(true)
  })

  it('appends uploaded supplemental papers to either literature checkpoint', async () => {
    const coordinator = new ResearchCoordinator(adapters())
    let state = createResearchState()
    state = appendResearchOutput(state, { stage: 'problem-summary', kind: 'problem', title: '问题', content: '缺口' })
    state = confirm(state)
    state = appendResearchOutput(state, { stage: 'literature-search', kind: 'literature', title: '文献', content: '证据' })
    const result = await coordinator.advance({
      state,
      parent,
      supplementalPapers: [{ attachmentId: AttachmentId('sha256:supplement'), name: 'supplement.txt', bytes: 10 }],
    })
    expect(result.artifact?.title).toBe('补充文献调研（1 篇）')
    expect(result.state.nodes[result.state.selectedNodeId]?.stage).toBe('literature-search')
    expect(result.artifact?.content).toContain('supplement.txt')
  })

  it('discards low-score or overlapping candidates before exposing a passing idea', async () => {
    let reviewCount = 0
    const base = adapters()
    const coordinator = new ResearchCoordinator({
      ...base,
      innovation: { scoreThreshold: 70, maxAttempts: 3 },
      agents: {
        async run(role, prompt, owner, signal) {
          if (role === 'innovation-reviewer') {
            reviewCount += 1
            return reviewCount === 1
              ? '{"score": 92, "overlap": true, "rationale": "与基线方法高度重合。"}'
              : '{"score": 84, "overlap": false, "rationale": "机制和验证标准均有清晰差异。"}'
          }
          return base.agents.run(role, prompt, owner, signal)
        },
      },
    })
    let state = createResearchState()
    state = appendResearchOutput(state, { stage: 'problem-summary', kind: 'problem', title: '问题', content: '缺口' })
    state = confirm(state)
    state = appendResearchOutput(state, { stage: 'literature-search', kind: 'literature', title: '文献', content: '证据' })
    state = confirm(state)
    const result = await coordinator.advance({ state, parent })
    expect(reviewCount).toBe(2)
    expect(result.artifact?.evaluation).toMatchObject({ score: 84, overlap: false, threshold: 70 })
  })

  it('reports the innovation threshold when every candidate is rejected', async () => {
    const base = adapters()
    const coordinator = new ResearchCoordinator({
      ...base,
      innovation: { scoreThreshold: 90, maxAttempts: 2 },
      agents: {
        async run(role, prompt, owner, signal) {
          if (role === 'innovation-reviewer') return '{"score": 40, "overlap": false, "rationale": "证据不足。"}'
          return base.agents.run(role, prompt, owner, signal)
        },
      },
    })
    let state = createResearchState()
    state = appendResearchOutput(state, { stage: 'problem-summary', kind: 'problem', title: '问题', content: '缺口' })
    state = confirm(state)
    state = appendResearchOutput(state, { stage: 'literature-search', kind: 'literature', title: '文献', content: '证据' })
    state = confirm(state)
    await expect(coordinator.advance({ state, parent })).rejects.toThrow('INNOVATION_SCORE_BELOW_THRESHOLD')
  })

  it('fails closed when candidate-specific literature search has no results', async () => {
    const base = adapters()
    const coordinator = new ResearchCoordinator({
      ...base,
      innovation: { scoreThreshold: 70, maxAttempts: 1 },
      literature: { async search() { return [] } },
      agents: {
        async run(role, prompt, owner, signal) {
          if (role === 'innovation-reviewer') return '{"score":99,"overlap":false,"rationale":"看起来有新意。"}'
          return base.agents.run(role, prompt, owner, signal)
        },
      },
    })
    let state = createResearchState()
    state = appendResearchOutput(state, { stage: 'problem-summary', kind: 'problem', title: '问题', content: '缺口' })
    state = confirm(state)
    state = appendResearchOutput(state, { stage: 'literature-search', kind: 'literature', title: '文献', content: '证据' })
    state = confirm(state)
    await expect(coordinator.advance({ state, parent })).rejects.toThrow('INNOVATION_SCORE_BELOW_THRESHOLD')
  })
})

describe('createWebLiteratureSearcher', () => {
  it('queries arXiv machine-learning categories and merges duplicate URLs', async () => {
    const fetchedUrls: string[] = []
    const xml = '<feed><entry><id>https://arxiv.org/abs/1234.5678</id><title> A ML paper </title><summary> A useful result </summary><published>2026-01-01T00:00:00Z</published></entry></feed>'
    const web = Object.setPrototypeOf({
      async fetch(request: { readonly url: string }) {
        fetchedUrls.push(request.url)
        return { url: request.url, statusCode: 200, truncated: false, body: { kind: 'text' as const, content: xml } }
      },
    }, WebRuntime.prototype) as WebRuntime
    const searcher = createWebLiteratureSearcher(web, 4)
    const sources = await searcher.search('transformer', undefined, { sources: ['arxiv'] })
    expect(sources).toHaveLength(1)
    expect(sources[0]).toMatchObject({ provider: 'arxiv', title: 'A ML paper', url: 'https://arxiv.org/abs/1234.5678' })
    expect(fetchedUrls[0]).toContain('cat%3Acs.LG')
  })

  it('does not call the native Web Search capability', async () => {
    let searchCalls = 0
    const web = Object.setPrototypeOf({
      async search() { searchCalls += 1; throw new Error('native search must not be used') },
      async fetch(request: { readonly url: string }) {
        return { url: request.url, statusCode: 200, truncated: false, body: { kind: 'text' as const, content: '{"data":[]}' } }
      },
    }, WebRuntime.prototype) as WebRuntime

    await expect(createWebLiteratureSearcher(web, 4).search('transformer', undefined, { sources: ['semantic-scholar'] })).resolves.toEqual([])
    expect(searchCalls).toBe(0)
  })

  it('retries transient timeouts once and keeps the successful source result', async () => {
    let calls = 0
    const xml = '<feed><entry><id>https://arxiv.org/abs/1000.0001</id><title>Recovered paper</title></entry></feed>'
    const web = Object.setPrototypeOf({
      async fetch(request: { readonly url: string }) {
        calls += 1
        if (calls === 1) throw Object.assign(new Error('web fetch timed out'), { code: 'WEB_FETCH_TIMEOUT' })
        return { url: request.url, statusCode: 200, truncated: false, body: { kind: 'text' as const, content: xml } }
      },
    }, WebRuntime.prototype) as WebRuntime

    await expect(createWebLiteratureSearcher(web, 4).search('transformer', undefined, { sources: ['arxiv'] })).resolves.toMatchObject([
      { provider: 'arxiv', title: 'Recovered paper' },
    ])
    expect(calls).toBe(2)
  })

  it('does not retry a non-public address block and reports failure categories', async () => {
    let calls = 0
    const web = Object.setPrototypeOf({
      async fetch(request: { readonly url: string }) {
        calls += 1
        if (request.url.includes('arxiv.org')) throw Object.assign(new Error('URL hostname resolves to a non-public IP address'), { code: 'WEB_BLOCKED_URL' })
        return { url: request.url, statusCode: 429, truncated: false, body: { kind: 'text' as const, content: 'rate limited' } }
      },
    }, WebRuntime.prototype) as WebRuntime

    await expect(createWebLiteratureSearcher(web, 4).search('transformer', undefined, { sources: ['arxiv', 'openalex'] })).rejects.toThrow(
      'diagnostics: arxiv=non-public-address; openalex=http-429',
    )
    expect(calls).toBe(3)
  })

  it('keeps index results when another index is unavailable', async () => {
    const web = Object.setPrototypeOf({
      async fetch(request: { readonly url: string }) {
        if (request.url.includes('openreview.net')) throw new Error('OpenReview unavailable')
        return {
          url: request.url,
          statusCode: 200,
          truncated: false,
          body: { kind: 'text' as const, content: '<feed><entry><id>https://arxiv.org/abs/9876.5432</id><title>Fallback ML paper</title><summary>Evidence</summary></entry></feed>' },
        }
      },
    }, WebRuntime.prototype) as WebRuntime

    await expect(createWebLiteratureSearcher(web, 4).search('transformer', undefined, { sources: ['openreview', 'arxiv'] })).resolves.toEqual([
      { url: 'https://arxiv.org/abs/9876.5432', provider: 'arxiv', title: 'Fallback ML paper', snippet: 'Evidence' },
    ])
  })

  it('reports the selected indexes when every fetch fails', async () => {
    const web = Object.setPrototypeOf({
      async fetch(request: { readonly url: string }) {
        return {
          url: request.url,
          statusCode: 503,
          truncated: false,
          body: { kind: 'text' as const, content: '{"error":"temporarily unavailable"}' },
        }
      },
    }, WebRuntime.prototype) as WebRuntime

    await expect(createWebLiteratureSearcher(web, 4).search('transformer', undefined, {
      sources: ['arxiv', 'openalex'],
    })).rejects.toThrow('diagnostics: arxiv=http-5xx; openalex=http-5xx')
  })

  it('classifies a proxied connection failure separately from DNS and address blocks', async () => {
    const web = Object.setPrototypeOf({
      async fetch(request: { readonly url: string }) {
        throw Object.assign(new Error(`web proxy request failed for ${request.url}: connect ECONNREFUSED`), {
          code: 'WEB_PROVIDER_ERROR',
        })
      },
    }, WebRuntime.prototype) as WebRuntime

    await expect(createWebLiteratureSearcher(web, 4).search('transformer', undefined, {
      sources: ['openalex'],
    })).rejects.toThrow('diagnostics: openalex=proxy-connection')
  })

  it('bounds encoded queries so long problem summaries reach the indexes', async () => {
    const fetchedUrls: string[] = []
    const web = Object.setPrototypeOf({
      async fetch(request: { readonly url: string }) {
        fetchedUrls.push(request.url)
        return {
          url: request.url,
          statusCode: 200,
          truncated: false,
          body: { kind: 'text' as const, content: '{"results":[]}' },
        }
      },
    }, WebRuntime.prototype) as WebRuntime

    await createWebLiteratureSearcher(web, 4).search('机器学习 '.repeat(2000), undefined, {
      sources: ['openalex'],
    })
    expect(fetchedUrls).toHaveLength(1)
    expect(fetchedUrls[0]?.length).toBeLessThanOrEqual(2048)
  })

  it('parses explicit conference and citation indexes without native search', async () => {
    const web = Object.setPrototypeOf({
      async fetch(request: { readonly url: string }) {
        let content = ''
        if (request.url.includes('arxiv.org/api')) {
          content = '<feed><entry><id>https://arxiv.org/abs/1</id><title>arXiv ML</title></entry></feed>'
        } else if (request.url.includes('openreview.net')) {
          content = JSON.stringify({ notes: [{ id: 'abc', content: { title: { value: 'ICLR paper' }, abstract: { value: 'OpenReview abstract' }, venue: { value: 'ICLR 2026' } } }] })
        } else if (request.url.includes('semanticscholar.org')) {
          content = JSON.stringify({ data: [{ url: 'https://doi.org/10.1/s2', title: 'Citation paper', abstract: 'S2 abstract', publicationDate: '2026-01-01' }] })
        } else if (request.url.includes('aclanthology.org')) {
          content = '<html><a href="/2026.acl-long.1">ACL paper</a></html>'
        } else {
          content = JSON.stringify({ results: [{ id: 'https://openalex.org/W1', doi: 'https://doi.org/10.1/oa', title: 'OpenAlex paper', publication_date: '2026-01-01', abstract_inverted_index: { Open: [0], Alex: [1] } }] })
        }
        return { url: request.url, statusCode: 200, truncated: false, body: { kind: 'text' as const, content } }
      },
    }, WebRuntime.prototype) as WebRuntime

    const sources = await createWebLiteratureSearcher(web, 10).search('transformer', undefined, {
      sources: ['arxiv', 'openreview', 'semantic-scholar', 'acl-anthology', 'openalex'],
    })
    expect(new Set(sources.map(source => source.provider))).toEqual(new Set(['arxiv', 'openreview', 'semantic-scholar', 'acl-anthology', 'openalex']))
    expect(sources.find(source => source.provider === 'openreview')?.title).toBe('ICLR paper')
    expect(sources.find(source => source.provider === 'openalex')?.snippet).toBe('Open Alex')
  })
})

describe('createSubagentResearchRunner', () => {
  it('inherits the selected parent model route and Chinese output instruction', async () => {
    let seen: { readonly agentOptions?: unknown; readonly prompt?: readonly { readonly text?: string }[] } | undefined
    const subagents = Object.setPrototypeOf({
      async startActivation(spec: { request: { readonly agentOptions?: unknown; readonly prompt?: readonly { readonly text?: string }[] } }) {
        seen = spec.request
        return {
          result: Promise.resolve({ stopReason: 'completed' as const, output: [{ type: 'text' as const, text: '中文结果' }] }),
          async dispose() {},
        }
      },
    }, SubagentRuntime.prototype) as SubagentRuntime
    const runner = createSubagentResearchRunner(subagents, 'spawn')
    const owner = { session: { requestHeader: () => undefined }, options: { provider: 'selected-provider', model: 'gpt-6-astra', maxTokens: 321 } } as Agent
    await runner.run('problem-extractor', '请处理问题', owner)
    expect(seen?.agentOptions).toEqual({ provider: 'selected-provider', model: 'gpt-6-astra', maxTokens: 321 })
    expect(seen?.prompt?.[0]?.text).toContain('简体中文')
  })
})

describe('createAttachmentPaperReader', () => {
  it('extracts a PDF text layer with PDF.js', async () => {
    const bytes = testPdf('Selectable PDF text with enough words to avoid OCR fallback. This sentence keeps the embedded text layer above the OCR threshold.')
    const attachments = attachmentReader(bytes)
    const reader = createAttachmentPaperReader(attachments, bytes.byteLength)
    const document = await reader.read({ attachmentId: AttachmentId('sha256:pdf'), name: 'paper.pdf', bytes: bytes.byteLength })
    expect(document.extractionMethod).toBe('embedded-text')
    expect(document.pageCount).toBe(1)
    expect(document.text).toContain('Selectable PDF text')
  })

  it('renders a scanned PDF and delegates the pages to OCR', async () => {
    const bytes = testPdf()
    const pages: Uint8Array[] = []
    const attachments = attachmentReader(bytes)
    const reader = createAttachmentPaperReader(attachments, bytes.byteLength, {
      ocr: {
        async recognize(input) {
          pages.push(...input.pages.map(page => page.data))
          return 'Page 1\n扫描版论文内容'
        },
      },
    })
    const document = await reader.read(
      { attachmentId: AttachmentId('sha256:scan'), name: 'scan.pdf', bytes: bytes.byteLength },
      undefined,
      { parent },
    )
    expect(document.extractionMethod).toBe('ocr')
    expect(document.text).toContain('扫描版论文内容')
    expect(pages[0]?.byteLength).toBeGreaterThan(0)
  })

  it('OCRs sparse pages in a mixed PDF while retaining embedded page text order', async () => {
    const bytes = testPdfPages([
      'Selectable page with enough text to stay on the embedded text path.',
      '',
    ])
    const pages: number[] = []
    const reader = createAttachmentPaperReader(attachmentReader(bytes), bytes.byteLength, {
      ocr: {
        async recognize(input) {
          pages.push(...input.pages.map(page => page.pageNumber))
          return 'Page 2\nOCR recovered page content'
        },
      },
    })
    const document = await reader.read(
      { attachmentId: AttachmentId('sha256:mixed'), name: 'mixed.pdf', bytes: bytes.byteLength },
      undefined,
      { parent },
    )
    expect(document.extractionMethod).toBe('ocr')
    expect(pages).toEqual([2])
    expect(document.text.indexOf('Selectable page')).toBeLessThan(document.text.indexOf('OCR recovered page'))
  })

  it('reports a clear error when a scanned PDF has no OCR adapter', async () => {
    const bytes = testPdf()
    const reader = createAttachmentPaperReader(attachmentReader(bytes), bytes.byteLength)
    await expect(reader.read({ attachmentId: AttachmentId('sha256:no-ocr'), name: 'scan.pdf', bytes: bytes.byteLength }, undefined, { parent }))
      .rejects.toThrow('PDF_OCR_UNAVAILABLE')
  })
})

function attachmentReader(bytes: Uint8Array): AttachmentStore {
  return Object.setPrototypeOf({
    async *readFileStream() { yield bytes },
  }, AttachmentStore.prototype) as AttachmentStore
}

function testPdf(text = ''): Uint8Array {
  return testPdfPages([text])
}

function testPdfPages(texts: readonly string[]): Uint8Array {
  const pageObjects: string[] = []
  const contentObjects: string[] = []
  const pageRefs: string[] = []
  const firstPageObject = 3
  const firstContentObject = firstPageObject + texts.length
  texts.forEach((text, index) => {
    pageRefs.push(`${firstPageObject + index} 0 R`)
    const stream = text.length === 0 ? '0 0 0 rg 10 10 100 80 re f' : `BT /F1 8 Tf 10 50 Td (${text}) Tj ET`
    pageObjects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 120 100] /Resources << /Font << /F1 ${firstContentObject + texts.length} 0 R >> >> /Contents ${firstContentObject + index} 0 R >>`)
    contentObjects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`)
  })
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${pageRefs.join(' ')}] /Count ${texts.length} >>`,
    ...pageObjects,
    ...contentObjects,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ]
  let pdf = '%PDF-1.7\n'
  const offsets = [0]
  objects.forEach((object, index) => { offsets.push(pdf.length); pdf += `${index + 1} 0 obj\n${object}\nendobj\n` })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return new TextEncoder().encode(pdf)
}

import { expect, it, vi } from 'vitest'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { WebRuntime } from '@deepseek-ai/dsh-web'
import { createLiteratureQueryPlanner, createWebLiteratureSearcher } from '../packages/research-agent/src/workflows/research-coordinator.ts'
import { SourceCoordinator } from '../packages/research-agent/src/innovation/source-coordinator.ts'
import { targetTaskIssues } from '../packages/research-agent/src/innovation/target-task.ts'
import { taskFields } from './support/rubric-fixture.mjs'

it('blocks the actual unresolved target draft before confirmation without disallowing broad scope', () => {
  expect(targetTaskIssues({ ...taskFields, input: '预训练模型；具体模型待用户确认。' })).toEqual([
    expect.stringContaining('输入仍包含未确认内容'),
  ])
  expect(targetTaskIssues({ ...taskFields, input: '预训练模型和下游数据，不限定具体型号与数据集。' })).toEqual([])
  expect(targetTaskIssues({ ...taskFields, comparisonPoint: '2026-02-30' })).toHaveLength(1)
})

it('preserves the full research context while emitting a short academic query through the selected model', async () => {
  const stream = vi.fn(async function*() {
    yield { type: 'block-end' as const, index: 0, block: { type: 'text' as const, text: '```json\n{"query":"DoRA low rank adaptation"}\n```' } }
    yield { type: 'finish' as const, reason: { kind: 'stop' as const } }
  })
  const parent = { options: { provider: 'selected', model: 'current' }, session: { requestHeader: () => undefined }, ctx: { get: () => undefined } } as unknown as Agent
  const planner = createLiteratureQueryPlanner({ stream })
  await expect(planner('这是很长的中文说明。末尾关键方法 DoRA 低秩适配。', parent)).resolves.toBe('DoRA low rank adaptation')
  expect(JSON.stringify(stream.mock.calls)).toContain('末尾关键方法 DoRA')
  expect(JSON.stringify(stream.mock.calls)).toContain('selected')
})

it.each([true,false])('bounds invalid search-query format repair to one additional model request: %s',async(repair)=>{
  let calls=0
  const stream=vi.fn(async function*(){
    calls++
    yield {type:'block-end' as const,index:0,block:{type:'text' as const,text:JSON.stringify({query:repair&&calls===2?'LoRA gradient normalization':'LoRA AND gradient'})}}
    yield {type:'finish' as const,reason:{kind:'stop' as const}}
  })
  const parent={options:{provider:'selected',model:'current'},session:{requestHeader:()=>undefined},ctx:{get:()=>undefined}} as unknown as Agent
  const result=createLiteratureQueryPlanner({stream})('LoRA gradient normalization',parent)
  if(repair)await expect(result).resolves.toBe('LoRA gradient normalization')
  else await expect(result).rejects.toThrow('文献检索词无效')
  expect(stream).toHaveBeenCalledTimes(2)
})

it('queries OpenReview search for papers and keeps arXiv boolean syntax intact', async () => {
  const urls: string[] = []
  const web = Object.setPrototypeOf({ fetch: async ({ url }: { url: string }) => {
    urls.push(url)
    return { url, statusCode: 200, truncated: false, body: { kind: 'text' as const,
      content: url.includes('openreview') ? JSON.stringify({ notes: [
        { id: 'review', content: { summary: { value: 'Review is not a paper' } } },
        { id: 'paper', content: { title: { value: 'DoRA' } } },
      ] }) : '<feed></feed>',
    } }
  } }, WebRuntime.prototype) as WebRuntime
  const results = await createWebLiteratureSearcher(web, 8, new SourceCoordinator({ intervalMs: 0 })).search(
    'DoRA low rank adaptation', undefined, { sources: ['arxiv', 'openreview'] })
  const arxiv = new URL(urls.find(url => url.includes('arxiv'))!)
  expect(arxiv.searchParams.get('search_query')).toBe('(all:"DoRA" AND all:"low" AND all:"rank" AND all:"adaptation") AND (cat:cs.LG OR cat:cs.AI OR cat:cs.CL OR cat:stat.ML)')
  expect(arxiv.searchParams.get('sortBy')).toBe('relevance')
  const openreview = new URL(urls.find(url => url.includes('openreview'))!)
  expect(openreview.pathname).toBe('/notes/search')
  expect(openreview.searchParams.get('term')).toBe('DoRA low rank adaptation')
  expect(openreview.searchParams.get('source')).toBe('forum')
  expect(results.map(r => r.url)).toEqual(['https://openreview.net/forum?id=paper'])
})

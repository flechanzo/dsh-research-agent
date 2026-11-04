import {afterEach,describe,expect,it,vi} from 'vitest'
import type {WebRuntime} from '@deepseek-ai/dsh-web'
import {SourceCoordinator,retryAfterMilliseconds,academicSource} from '../packages/research-agent/src/innovation/source-coordinator.ts'
import {MemoryPublicPaperCache} from '../packages/research-agent/src/innovation/paper-cache.ts'
import {createRubricNetwork} from '../packages/research-agent/src/innovation/network.ts'
import {createWebLiteratureSearcher,compactAcademicQuery} from '../packages/research-agent/src/workflows/research-coordinator.ts'
const source={url:'https://arxiv.org/abs/2402.09353v2',title:'Synthetic Method Relation',publicationDate:'2024-01-01'}
const html='<article><h1>Synthetic Method Relation</h1><meta name="citation_version_date" content="2024-03-01"><h2>Methods</h2>'+('The synthetic mechanism changes one local prediction rule. Proof: the relation holds under the explicit assumptions. ').repeat(70)+'</article>'
afterEach(()=>vi.useRealTimers())
describe('shared scholarly source admission',()=>{
 it('compacts long reasoning into a bounded query and prioritizes discovered paper IDs',()=>{expect(compactAcademicQuery('创新论证 '.repeat(200)+' arXiv:2402.09353v2')).toBe('2402.09353v2');expect(compactAcademicQuery('mechanism '.repeat(100)).split(' ')).toHaveLength(18);expect(compactAcademicQuery('机制关系'.repeat(200)).length).toBeLessThanOrEqual(180)})
 it('shares a legacy source cooldown with Rubric instead of retrying 429 after 50ms',async()=>{const coordinator=new SourceCoordinator({intervalMs:0,cooldownMs:1000});const fetch=vi.fn(async({url}:{url:string})=>({url,statusCode:429,truncated:false,body:{kind:'text' as const,content:'rate limited'}}));const web={fetch} as unknown as WebRuntime;await expect(createWebLiteratureSearcher(web,4,coordinator).search('DoRA method',undefined,{sources:['openalex']})).rejects.toThrow(/http-429/);await createRubricNetwork(web,{coordinator}).search('DoRA method');expect(fetch.mock.calls.filter(([r])=>r.url.includes('api.openalex'))).toHaveLength(1)})
 it('groups arXiv HTML, API and PDF together',()=>{expect(academicSource('https://export.arxiv.org/api/query')).toBe(academicSource(source.url));expect(retryAfterMilliseconds('3',0)).toBe(3000);expect(retryAfterMilliseconds('Thu, 01 Jan 1970 00:00:05 GMT',0)).toBe(5000)})
 it('honors Retry-After across tasks and recovers after cooldown',async()=>{vi.useFakeTimers();const c=new SourceCoordinator({intervalMs:0,cooldownMs:100,maxRetries:0},()=>0);await expect(c.request(source.url,undefined,async()=>({value:0,status:429,retryAfter:'2'}))).rejects.toThrow(/rate limited/);const request=vi.fn(async()=>({value:1,status:200}));const p=c.request('https://export.arxiv.org/api/query',undefined,request);await vi.advanceTimersByTimeAsync(1999);expect(request).not.toHaveBeenCalled();await vi.advanceTimersByTimeAsync(1);expect(await p).toBe(1)})
 it('bounds retries and opens/recover circuits without calling it an empty result',async()=>{vi.useFakeTimers();const c=new SourceCoordinator({intervalMs:0,cooldownMs:10,maxRetries:1,failureThreshold:2,circuitMs:100},()=>0);const fn=vi.fn(async()=>({value:[],status:429}));const p=expect(c.request(source.url,undefined,fn)).rejects.toThrow(/rate limited/);await vi.advanceTimersByTimeAsync(20);await p;expect(fn).toHaveBeenCalledTimes(2);await expect(c.request(source.url,undefined,fn)).rejects.toThrow(/circuit/);await vi.advanceTimersByTimeAsync(100);expect(await c.request(source.url,undefined,async()=>({value:1,status:200}))).toBe(1)})
 it('holds the concurrency slot while a cancelled non-cooperative request is still active',async()=>{const c=new SourceCoordinator({intervalMs:0});const abort=new AbortController();let done:()=>void=()=>{};const p=c.request(source.url,abort.signal,()=>new Promise(resolve=>{done=()=>resolve({value:1,status:200})}));await Promise.resolve();abort.abort();await expect(p).rejects.toThrow();const next=vi.fn(async()=>({value:2,status:200}));const q=c.request(source.url,undefined,next);await new Promise(resolve=>setTimeout(resolve,10));expect(next).not.toHaveBeenCalled();done();expect(await q).toBe(2)})
})
describe('verified public originals cache',()=>{
 it('recognizes same-repository download endpoints and retains denied acquisition without trusting metadata',async()=>{
  const landing='https://scholarworks.sjsu.edu/faculty_rsca/6870/'
  const download='https://scholarworks.sjsu.edu/cgi/viewcontent.cgi?article=7870&context=faculty_rsca'
  const fetchPdf=vi.fn(async()=>new Response('Access denied',{status:403}))
  const fetch=vi.fn(async({url}:{url:string})=>({url,statusCode:200,truncated:false,body:{kind:'html',content:
   '<h1>Repository metadata</h1><a href="'+download.replace('&','&amp;')+'">Download</a><a href="https://untrusted.test/cgi/viewcontent.cgi?article=1&context=other">unrelated link</a>'}}))
  const network=createRubricNetwork({fetch} as unknown as WebRuntime,{fetch:fetchPdf,coordinator:new SourceCoordinator({intervalMs:0}),cacheStore:new MemoryPublicPaperCache()})
  const d=await network.read({...source,url:landing})
  expect(fetchPdf).toHaveBeenCalledOnce();expect(String(fetchPdf.mock.calls[0]?.[0])).toBe(download)
  expect(d.primary).toBe(false);expect(d.attempts?.some(a=>a.status===403)).toBe(true)
 })
 it('uses a publisher location returned for the same indexed work when arXiv is unavailable',async()=>{
  const publisher='https://proceedings.mlr.press/v235/example.html'
  const fetch=vi.fn(async({url}:{url:string})=>{
   if(url.includes('api.openalex'))return {url,statusCode:200,truncated:false,body:{kind:'text',content:JSON.stringify({results:[{title:source.title,publication_date:source.publicationDate,best_oa_location:{landing_page_url:source.url},locations:[{landing_page_url:source.url},{landing_page_url:publisher}]}]})}}
   if(url===publisher)return {url,statusCode:200,truncated:false,body:{kind:'html',content:html}}
   throw Error('arXiv unavailable')
  })
  const network=createRubricNetwork({fetch} as unknown as WebRuntime,{coordinator:new SourceCoordinator({intervalMs:0}),cacheStore:new MemoryPublicPaperCache(),enabled:false})
  const found=await network.search('Synthetic Method Relation');expect(found.sources[0]?.alternateUrls).toEqual([publisher])
  const paper=await network.read(found.sources[0]!)
  expect(paper.primary).toBe(true);expect(paper.url).toBe(publisher);expect(paper.provenance?.originalUrl).toBe(source.url)
  expect(fetch.mock.calls.some(([r])=>r.url.includes('/html/2402'))).toBe(false)
 })
 function setup(){const cache=new MemoryPublicPaperCache();const fetch=vi.fn(async({url}:{url:string})=>({url,statusCode:200,truncated:false,body:{kind:'html',content:html}}));const web={fetch} as unknown as WebRuntime;const options={cacheStore:cache,coordinator:new SourceCoordinator({intervalMs:0}),enabled:false,comparisonDate:'2026-11-03'};return {cache,fetch,web,options}}
 it('fetches and parses a repeated verified paper once across concurrent tasks',async()=>{const f=setup();const a=createRubricNetwork(f.web,f.options),b=createRubricNetwork(f.web,f.options);const [d,e]=await Promise.all([a.read(source),b.read(source)]);expect(d.primary).toBe(true);expect(e.provenance?.textSha256).toBe(d.provenance?.textSha256);expect(f.fetch).toHaveBeenCalledOnce();expect((await f.cache.entries('arxiv:2402.09353'))[0]?.identity.status).toBe('verified')})
 it('keeps versions and explicit HTML/PDF originals separate',async()=>{const f=setup();await createRubricNetwork(f.web,f.options).read(source);await createRubricNetwork(f.web,f.options).read({...source,url:'https://arxiv.org/html/2402.09353v1'});expect(f.fetch).toHaveBeenCalledTimes(2);expect(await f.cache.entries('arxiv:2402.09353')).toHaveLength(2)})
 it('does not reuse future revisions for historical comparisons',async()=>{const f=setup();await createRubricNetwork(f.web,f.options).read(source);await createRubricNetwork(f.web,{...f.options,comparisonDate:'2024-02-01'}).read(source);expect(f.fetch).toHaveBeenCalledTimes(2)})
 it('reverifies expired or modified bodies instead of trusting cache metadata',async()=>{const f=setup();await createRubricNetwork(f.web,f.options).read(source);const row=(await f.cache.entries('arxiv:2402.09353'))[0]!;await f.cache.put({...row,original:row.original+'tampered'});await createRubricNetwork(f.web,f.options).read(source);expect(f.fetch).toHaveBeenCalledTimes(2);await createRubricNetwork(f.web,{...f.options,cacheMaxAgeMs:0}).read(source);expect(f.fetch).toHaveBeenCalledTimes(3)})
 it('does not share a failed identity or partial extraction',async()=>{const f=setup();const bad={...source,title:'A Completely Different Unrelated Astronomy Paper'};await createRubricNetwork(f.web,f.options).read(bad);await createRubricNetwork(f.web,f.options).read(bad);expect(f.fetch).toHaveBeenCalledTimes(2);expect((await f.cache.entries('arxiv:2402.09353'))[0]?.identity.status).toBe('unverified')})
 it('exposes request, parsing and cache statistics separately',async()=>{const f=setup();const network=createRubricNetwork(f.web,f.options);await network.read(source);await network.read(source);expect(network.statistics).toMatchObject({transportRequests:1,http200:1,cache_miss:1,cache_stored:1,cache_hit:1});expect(network.statistics?.extractionProcessCpuMilliseconds).toBeGreaterThanOrEqual(0);expect(network.statistics?.cacheLookupMilliseconds).toBeGreaterThanOrEqual(0)})
})

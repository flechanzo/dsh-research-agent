import {describe,it,expect,vi} from 'vitest'
import type {WebRuntime} from '@deepseek-ai/dsh-web'
import {createRubricNetwork} from '../packages/research-agent/src/innovation/network.ts'
import {createPublicPdfTransport} from '../packages/research-agent/src/innovation/public-pdf.ts'
import {extractPaperBytes} from '../packages/research-agent/src/workflows/paper-reader.ts'
import {paperProvenance,workIdentity} from '../packages/research-agent/src/innovation/documents.ts'
const source={url:'https://aclanthology.org/N19-1423.pdf',title:'public synthetic fixture',publicationDate:'2019-01-01'}
const web=(content='abstract',truncated=false)=>({fetch:async({url}:{url:string})=>({url,statusCode:200,truncated,body:{kind:'html',content}})} as WebRuntime)
const text='A synthetic method defines a reproducible prediction rule with enough embedded text for PDF extraction.'
describe('public PDF transport (all HTTP responses mocked)',()=>{
 it('reads bounded genuine PDF bytes and records binary hash',async()=>{
  const bytes=testPdfPages([text]);const read=createPublicPdfTransport({minIntervalMs:0,fetch:vi.fn(async()=>new Response(bytes,{headers:{'content-type':'application/pdf'}})) as typeof fetch})
  const r=await read(source.url);expect(r.bytes).toEqual(bytes);expect(r.acquisition.transport).toBe('public-pdf');expect(r.acquisition.sha256).toHaveLength(64)
 })
 it.each(['http://aclanthology.org/p.pdf','https://private.example/p.pdf','https://user:pass@arxiv.org/pdf/1','https://127.0.0.1/p.pdf'])('rejects unadmitted origin %s',async url=>{const fetch=vi.fn();await expect(createPublicPdfTransport({fetch})(url)).rejects.toThrow();expect(fetch).not.toHaveBeenCalled()})
 it('blocks redirects leaving configured public origins',async()=>{
  const fetch=vi.fn(async()=>new Response(null,{status:302,headers:{location:'https://paywall.example/private.pdf'}}))
  await expect(createPublicPdfTransport({fetch,minIntervalMs:0})(source.url)).rejects.toThrow(/permitted/);expect(fetch).toHaveBeenCalledOnce()
 })
 it('rejects paid-wall HTML instead of treating it as PDF',async()=>{await expect(createPublicPdfTransport({minIntervalMs:0,fetch:async()=>new Response('<html>login required</html>')})(source.url)).rejects.toThrow(/did not return a PDF/)})
 it('enforces byte cap before and during streamed reads',async()=>{
  await expect(createPublicPdfTransport({maxBytes:10,minIntervalMs:0,fetch:async()=>new Response('%PDF-0123456789012')})(source.url)).rejects.toThrow(/byte limit/)
  await expect(createPublicPdfTransport({maxBytes:10,minIntervalMs:0,fetch:async()=>new Response('%PDF-',{headers:{'content-length':'100'}})})(source.url)).rejects.toThrow(/byte limit/)
 })
 it('can disable PDF network access independently',async()=>{const fetch=vi.fn();await expect(createPublicPdfTransport({enabled:false,fetch})(source.url)).rejects.toThrow(/disabled/);expect(fetch).not.toHaveBeenCalled()})
 it('honors cancellation before a request',async()=>{const abort=new AbortController();abort.abort();const fetch=vi.fn();await expect(createPublicPdfTransport({fetch})(source.url,abort.signal)).rejects.toThrow();expect(fetch).not.toHaveBeenCalled()})
})
describe('shared extraction and evidence coverage',()=>{
 it('extracts ACL PDF with page locations, text hash, version and fetch provenance',async()=>{
  const bytes=testPdfPages([text]);const d=await createRubricNetwork(web(),{minIntervalMs:0,fetch:async()=>new Response(bytes)}).read(source)
  expect(d.primary).toBe(true);expect(d.provenance?.coverage).toBe('core-complete');expect(d.provenance?.locations[0]?.label).toBe('page:1');expect(d.provenance?.textSha256).toHaveLength(64);expect(d.provenance?.originalUrl).toBe(source.url)
 })
 it('marks capped PDF partial and does not claim core-complete',async()=>{
  const bytes=testPdfPages([text,text]);const d=await createRubricNetwork(web(),{minIntervalMs:0,fetch:async()=>new Response(bytes),paperOptions:{maxPdfPages:1}}).read(source)
  expect(d.primary).toBe(false);expect(d.provenance?.coverage).toBe('partial');expect(d.provenance?.truncated).toBe(true);expect(d.provenance?.pageCount).toBe(2)
 })
 it('records unavailable scanned PDF when OCR is disabled',async()=>{
  const d=await createRubricNetwork(web(),{minIntervalMs:0,fetch:async()=>new Response(testPdfPages(['']))}).read(source)
  expect(d.primary).toBe(false);expect(d.provenance?.coverage).toBe('unavailable');expect(d.errors?.join()).toMatch(/OCR/)
 })
 it('does not invent missing page OCR success',async()=>{
  const p=await extractPaperBytes(testPdfPages(['',text]),'scan.pdf',{ocr:{recognize:async()=> 'unlocated OCR output'}},undefined,{parent:{} as never})
  const d=paperProvenance(p,'https://aclanthology.org/test.pdf','2026-11-02')
  expect(p.missingPages).toContain(1);expect(d.coverage).toBe('partial')
 })
 it('records metadata and refused PDFs without claiming full text',async()=>{
  const d=await createRubricNetwork(web('<article>Title and abstract</article>'),{enabled:false}).read({...source,url:'https://aclanthology.org/N19-1423/'})
  expect(d.provenance?.coverage).toBe('metadata');expect(d.primary).toBe(false);expect(d.errors?.join()).toMatch(/disabled/)
 })
 it('preserves HTML section locations and actual reference links',async()=>{
  const html='<article><h2>Methods</h2><p>'+text.repeat(60)+'</p><h2>References</h2><a href="https://arxiv.org/abs/1602.07868">earlier work</a></article>'
  const d=await createRubricNetwork(web(html)).read({...source,url:'https://arxiv.org/abs/2402.09353v2'})
  expect(d.primary).toBe(true);expect(d.provenance?.locations[0]?.label).toBe('section:Methods');expect(d.provenance?.links).toContain('https://arxiv.org/abs/1602.07868')
 })
 it('recognizes PDF/HTML versions as one scientific work',()=>{expect(workIdentity('https://arxiv.org/pdf/2402.09353v2.pdf')).toBe(workIdentity('https://arxiv.org/html/2402.09353v1'))})
 it('does not treat oversized or provider-truncated HTML as complete',async()=>{
  const html='<article><section><h2>Methods</h2>'+text.repeat(60)+'</section></article>'
  for(const d of [await createRubricNetwork(web(html,true),{enabled:false}).read({...source,url:'https://arxiv.org/abs/2402.09353v2'}),await createRubricNetwork(web(html),{enabled:false,maxCharacters:100}).read({...source,url:'https://arxiv.org/abs/2402.09353v2'})]){expect(d.primary).toBe(false);expect(d.provenance?.truncated).toBe(true)}
 })
 it('finds publisher citation_pdf_url through official HTML and honors the PDF origin allowlist',async()=>{
  const fetch=vi.fn(async()=>new Response(testPdfPages([text])))
  const d=await createRubricNetwork(web('<meta name="citation_pdf_url" content="https://aclanthology.org/N19-1423.pdf"><p>Abstract</p>'),{fetch,minIntervalMs:0}).read({...source,url:'https://doi.org/10.18653/v1/N19-1423'})
  expect(d.provenance?.coverage).toBe('core-complete');expect(fetch).toHaveBeenCalledOnce()
 })
})
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
it('retains readable pages in mixed public PDF without pretending OCR succeeded',async()=>{const paper=await extractPaperBytes(testPdfPages([text,'']),'mixed.pdf',{},undefined,{allowPartial:true,allowOcr:false});expect(paper.extractionMethod).toBe('embedded-text');expect(paper.missingPages).toEqual([2]);expect(paperProvenance(paper,source.url,'2026-11-03').coverage).toBe('partial')})

it('does not confuse repeated landing metadata with a method section and follows unquoted PDF metadata',async()=>{
 const html='<meta name=citation_pdf_url content=https://aclanthology.org/N19-1423.pdf><article><h1>A method paper</h1><h2>Abstract</h2>'+text.repeat(70)+'<h2>Export citation</h2>'+text.repeat(70)+'</article>'
 const fetch=vi.fn(async()=>new Response(testPdfPages([text])))
 const d=await createRubricNetwork(web(html),{fetch,minIntervalMs:0}).read({...source,url:'https://doi.org/10.18653/v1/N19-1423'})
 expect(fetch).toHaveBeenCalledOnce();expect(d.url).toBe(source.url);expect(d.provenance?.extraction).toBe('embedded-text');expect(d.provenance?.originalUrl).toContain('doi.org')
 const metadata=await createRubricNetwork(web(html),{enabled:false}).read({...source,url:'https://doi.org/10.18653/v1/N19-1423'})
 expect(metadata.primary).toBe(false);expect(metadata.provenance?.coverage).toBe('metadata')
})
it('recognizes method body inside nested method subsections',async()=>{
 const html='<article><h2>4 Method</h2><h3>4.1 Weight decomposition</h3>'+text.repeat(60)+'<h2>5 Experiments</h2>Results</article>'
 const d=await createRubricNetwork(web(html),{enabled:false}).read({...source,url:'https://arxiv.org/html/2402.09353v2'})
 expect(d.primary).toBe(true);expect(d.provenance?.extraction).toBe('html')
})

it('arXiv fallback fields every query term and does not silently broaden multiword queries', async () => {
 const seen: string[] = []
 const mock = { fetch: async ({ url }: { url: string }) => { seen.push(url); return { url, statusCode: url.includes('export.arxiv') ? 200 : 429, truncated: false, body: { kind: 'text', content: url.includes('export.arxiv') ? '<feed></feed>' : 'rate limit' } } } } as WebRuntime
 const result = await createRubricNetwork(mock, { minIntervalMs: 0 }).search('weight normalization')
 expect(new URL(seen.at(-1)!).searchParams.get('search_query')).toBe('all:"weight" AND all:"normalization"')
 expect(result.sources).toEqual([]); expect(result.errors).toHaveLength(2)
})

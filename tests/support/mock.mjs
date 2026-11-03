/** Offline fixtures: this module is never included in the release package. */
import fs from 'node:fs';
import {taskFields} from './rubric-fixture.mjs';
import { LlmAdapter } from '@deepseek-ai/dsh-llm';
export const inject=['llm','web'];
function countImageBlocks(value){if(Array.isArray(value))return value.reduce((n,v)=>n+countImageBlocks(v),0);if(value&&typeof value==='object')return (value.type==='image'?1:0)+Object.values(value).reduce((n,v)=>n+countImageBlocks(v),0);return 0;}
class Mock extends LlmAdapter {
 providerInfo(id){return {id,name:'本地科研验收 Mock'}}
 async listModels(provider){return [{provider,id:'research-fixture',name:'科研合成夹具 A'},{provider,id:'research-fixture-b',name:'科研合成夹具 B'}]}
 async resolveModel(provider,model){
  const info={provider,id:model,name:model==='research-fixture'?'科研合成夹具 A':'科研合成夹具 B',inputModalities:model==='research-fixture'?['text','image']:['text'],defaultMaxTokens:model==='research-fixture'?768:2048,reasoning:{efforts:[{id:'fixture-low',name:'合成低'},{id:'fixture-high',name:'合成高'}],defaultEffort:model==='research-fixture'?'fixture-low':'fixture-high'}};
  if(process.env.RESEARCH_MODEL_RESOLUTION_TRACE)fs.appendFileSync(process.env.RESEARCH_MODEL_RESOLUTION_TRACE,JSON.stringify({timestamp:new Date().toISOString(),...info})+'\n');
  return info;
 }
 async *stream(options){
  if(process.env.RESEARCH_ACCEPTANCE_TRACE)fs.appendFileSync(process.env.RESEARCH_ACCEPTANCE_TRACE,JSON.stringify({timestamp:new Date().toISOString(),sessionId:options.sessionId,model:options.model,provider:options.provider,reasoningEffort:options.reasoningEffort??null,maxTokens:options.maxTokens??null,imageBlockCount:countImageBlocks(options.messages??[]),containsSyntheticPdfText:JSON.stringify(options.messages??[]).includes('Synthetic selectable PDF'),role:JSON.stringify(options.messages??[]).includes('完全独立的创新性专家')?'innovation-reviewer':JSON.stringify(options.messages??[]).includes('请用简体中文')?'research':'chat'})+'\n');
  options.signal?.throwIfAborted();const messages=options.messages??[];const prompt=JSON.stringify(messages);
  const text=prompt.includes('[rubric-stage:target-task-extractor]')?JSON.stringify(taskFields):prompt.includes('完全独立的创新性专家')?JSON.stringify({score:88,overlap:false,rationale:'合成验收夹具：方法与基线不同，非真实科研判断。'}):'# 合成科研输出\n\n创新点：通过可复现的校准机制研究分布偏移。\n\n方法：固定五点数值样例。基线：普通最小二乘。指标：均方误差。风险：此内容仅用于离线验收，不能作为真实科研结论。';
  yield {type:'block-start',index:0,blockType:'text'};yield {type:'text-delta',index:0,text};yield {type:'block-end',index:0,block:{type:'text',text}};yield {type:'finish',reason:{kind:'stop'}};
 }
}
export function apply(ctx){
 ctx.effect(()=>ctx.llm.registerAdapter(['research-mock'],new Mock()));
 ctx.effect(()=>ctx.web.registerFetchProvider({id:'research-fixture',available:()=>true,async fetch(request){let content;if(request.url.includes('arxiv.org'))content='<feed><entry><id>https://arxiv.org/abs/2601.00001</id><title>Synthetic baseline</title><summary>Fixture only</summary></entry></feed>';else if(request.url.includes('openreview.net'))content=JSON.stringify({notes:[{id:'fixture',content:{title:{value:'Synthetic baseline'},abstract:{value:'Fixture only'}}}]});else if(request.url.includes('semanticscholar.org'))content=JSON.stringify({data:[{url:'https://example.test/baseline',title:'Synthetic baseline',abstract:'Fixture only'}]});else if(request.url.includes('aclanthology.org'))content='<a href="/2026.acl-long.1/">Synthetic baseline</a>';else content=JSON.stringify({results:[{id:'https://openalex.org/W1',title:'Synthetic baseline',abstract_inverted_index:{Fixture:[0]}}]});return{url:request.url,statusCode:200,truncated:false,body:{kind:'text',content}}}}));
}

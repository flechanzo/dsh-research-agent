import {describe,expect,it,vi} from 'vitest'
import type {Agent} from '@deepseek-ai/dsh-agent'
import {ReasoningEffortId,type GenerateOptions,type StreamChunk} from '@deepseek-ai/dsh-llm'
import {createDirectRubricModel} from '../packages/research-agent/src/workflows/research-coordinator.ts'
function parent(pending?:object):Agent{return {options:{provider:'created',model:'old',maxTokens:2048},session:{requestHeader:()=>({config:{provider:'research-mock',model:'selected',reasoningEffort:ReasoningEffortId('high')}})},ctx:{get:()=>({stateOf:()=>({pending})})}} as unknown as Agent}
describe('Official one-shot Rubric model seam',()=>{
 it('sends only the stage prompt with native route and disjoint input usage',async()=>{
  const stream=vi.fn(async function*(options:GenerateOptions):AsyncGenerator<StreamChunk>{expect(options.messages).toEqual([{role:'user',content:[{type:'text',text:'exact rubric prompt'}]}]);yield{type:'text-delta',index:0,text:'{'};yield{type:'block-end',index:0,block:{type:'text',text:'{}'}};yield{type:'usage',usage:{inputTokens:100,cacheReadTokens:30,cacheWriteTokens:20,outputTokens:5}};yield{type:'finish',reason:{kind:'stop'}}})
  const response=await createDirectRubricModel({stream},parent())('classifier','exact rubric prompt')
  expect(stream).toHaveBeenCalledTimes(1);expect(stream.mock.calls[0][0]).toMatchObject({provider:'research-mock',model:'selected',maxTokens:2048,reasoningEffort:'high'});expect(stream.mock.calls[0][0].tools).toBeUndefined();expect(response).toEqual({text:'{}',finish:'completed',inputTokens:150,outputTokens:5})
 })
 it('honors a pending native model switch and clears the previous effort',async()=>{
  const stream=vi.fn(async function*(_options:GenerateOptions):AsyncGenerator<StreamChunk>{yield{type:'finish',reason:{kind:'stop'}}})
  await createDirectRubricModel({stream},parent({provider:'new-route',model:'new-model'}))('planner','test')
  expect(stream.mock.calls[0][0]).toMatchObject({provider:'new-route',model:'new-model',maxTokens:2048});expect(stream.mock.calls[0][0].reasoningEffort).toBeUndefined()
 })
 it('does not call a missing model route',()=>{const agent=parent();Object.assign(agent,{options:{},session:{requestHeader:()=>undefined}});expect(()=>createDirectRubricModel({stream:async function*(){}},agent)).toThrow(/explicit native/)} )
 it('retains incomplete output as failed and does not invent unknown tokens',async()=>{const model=createDirectRubricModel({stream:async function*(){yield{type:'text-delta',index:0,text:'partial'};yield{type:'finish',reason:{kind:'max-tokens'}}}},parent());expect(await model('review','prompt')).toEqual({text:'partial',finish:'max-tokens',inputTokens:null,outputTokens:null})})
 it('preserves adapter-owned output defaults when the parent has no explicit limit',async()=>{const agent=parent();Object.assign(agent,{options:{provider:'research-mock',model:'selected'}});const stream=vi.fn(async function*(_options:GenerateOptions):AsyncGenerator<StreamChunk>{yield{type:'finish',reason:{kind:'stop'}}});await createDirectRubricModel({stream},agent)('planner','prompt');expect(stream.mock.calls[0][0].maxTokens).toBeUndefined()})
})

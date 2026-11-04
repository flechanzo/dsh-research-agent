/** Read-only route/catalog preflight. No generation request and no credential is persisted. */
import fs from 'node:fs';import path from 'node:path';import yaml from 'js-yaml';
const out=path.resolve('.acceptance/rubric-efficiency-20261103/real-model-preflight.json');
const result={at:new Date().toISOString(),status:'blocked-before-generation',authorized:{routeDisplayName:'实验室',model:'gpt-6-sol',publicCandidates:1,maxModelRequests:24,maxPromptCharacters:1000000,maxOutputTokensPerRequest:4096,maxMilliseconds:300000,maxStageMilliseconds:60000,maxCostCny:20,maxOcrPages:0,providerRetries:0},modelRequests:0,inputTokens:0,outputTokens:0,estimatedCostCny:0,modelDirectoryRequests:0,pricingVerified:false,immutableModelRevisionVerified:false,reasons:[]};
try{
 const patch=yaml.load(fs.readFileSync('D:/DeepSeekHarness/data/profiles/desktop/cordis.patch.yml','utf8'));
 const providers=patch.find(x=>x.id==='llm-pi-ai')?.config?.providers??{};
 const routes=Object.entries(providers).filter(([,r])=>r.displayName==='实验室');
 if(routes.length!==1)throw Error('Expected one explicitly authorized 实验室 route');
 const [provider,route]=routes[0],model=route.models?.find(m=>m.id==='gpt-6-sol');
 if(!model)throw Error('Authorized model absent from current route');
 result.route={provider,displayName:route.displayName,api:route.api,endpointOrigin:new URL(route.baseURL).origin,configuredModel:model.id,configuredRevision:model.version??model.revision??null,configuredPricing:model.pricing??model.cost??null,configuredRetryPolicy:route.retryPolicy??'SDK default; not used for generation'};
 const credentials=yaml.load(fs.readFileSync('D:/DeepSeekHarness/data/.credentials.yaml','utf8'));
 const key=credentials.refs?.[route.apiKeyEnv];if(typeof key!=='string'||!key)throw Error('Authorized route credential reference unavailable');
 const url=route.baseURL.replace(/\/$/,'')+'/models';result.modelDirectoryRequests++;
 const response=await fetch(url,{method:'GET',headers:{Authorization:'Bearer '+key},signal:AbortSignal.timeout(10000),redirect:'error'});
 result.catalogHttpStatus=response.status;
 if(!response.ok)throw Error('Authorized catalog returned HTTP '+response.status);
 const catalog=await response.json(),item=(catalog.data??[]).find(m=>m.id==='gpt-6-sol');
 result.catalogModel=item?{id:item.id,created:item.created??null,ownedBy:item.owned_by??null,version:item.version??item.revision??null,pricing:item.pricing??item.cost??null}:null;
 if(!item)result.reasons.push('实际模型目录未确认授权模型 ID。');
 result.reasons.push('缺少该网关对 gpt-6-sol 的可核验版本绑定和权威计费表；不能用官方同名产品或通用估价替代此路由实际价格。');
}catch(error){result.reasons.push(String(error.message??error));}
result.reasons.push('用户要求价格无法核实或费用不可可靠控制时不得开始；本轮停止在任何生成请求之前，未自动切换路由。');
fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));

/** Local manual-test helpers. Never shipped in the research bundle. */
import {createHash} from 'node:crypto';
export function promptFacts(options) {
  const texts=[];
  function walk(v){if(!v||typeof v!=='object')return;if(v.type==='text'&&typeof v.text==='string')texts.push(v.text);for(const [k,x]of Object.entries(v))if(k!=='text'&&x&&typeof x==='object')walk(x);}
  walk(options.messages??[]);
  const stage=texts.join('\n').match(/\[(?:research|target-task)-stage:([\w-]+)\]/u)?.[1]??'native-agent';
  const text=JSON.stringify({messages:options.messages??[],systemPrompt:options.systemPrompt,system:options.system,tools:options.tools});
  return {stage,promptCharacters:text.length,promptSha256:createHash('sha256').update(text).digest('hex')};
}
export function usageFacts(usage) {
  if(!usage)return {inputTokens:null,outputTokens:null,cacheReadTokens:null,cacheWriteTokens:null};
  const n=x=>Number.isFinite(x)&&x>=0?x:null;
  const base=n(usage.inputTokens),read=n(usage.cacheReadTokens??0),write=n(usage.cacheWriteTokens??0);
  return {inputTokens:base===null||read===null||write===null?null:base+read+write,outputTokens:n(usage.outputTokens),cacheReadTokens:read,cacheWriteTokens:write};
}
export function admissionProblem(auth,ledger,options,facts,now=Date.now()) {
  if(!auth?.confirmed||!auth.confirmedAt)return '尚未由用户确认模型版本、价格状态和预算；请运行“确认测试条件”。';
  if(options.provider!==auth.provider||options.model!==auth.model)return '模型路由与用户确认值不一致，已阻止调用。';
  if(!auth.versionAcknowledged||!auth.pricingAcknowledged||!auth.budgetAcknowledged)return '模型版本、价格状态或预算确认不完整。';
  const b=auth.budget;
  if(!b||!Number.isSafeInteger(b.maxModelCalls)||b.maxModelCalls<1||b.maxModelCalls>500||!Number.isSafeInteger(b.maxPromptCharacters)||b.maxPromptCharacters<1||b.maxPromptCharacters>10000000||!Number.isSafeInteger(b.maxOutputTokens)||b.maxOutputTokens<1||b.maxOutputTokens>4096||!Number.isSafeInteger(b.maxMilliseconds)||b.maxMilliseconds<1||b.maxMilliseconds>300000)return '手动测试预算不合法。';
  if(ledger.epoch!==auth.epoch)return '预算账本身份不一致。';
  if(ledger.calls>=b.maxModelCalls)return '手动测试累计模型次数预算已耗尽。';
  if(ledger.promptCharacters+facts.promptCharacters>b.maxPromptCharacters)return '手动测试累计提示字符预算已耗尽。';
  if(ledger.startedAt&&now-ledger.startedAt>=b.maxMilliseconds)return '手动测试总时间预算已耗尽。';
  if(!Number.isFinite(options.maxTokens)||options.maxTokens>b.maxOutputTokens)return '输出 Token 上限未落实，已阻止调用。';
  return undefined;
}
export function redact(value,secrets=[],roots=[]) {
  if(Array.isArray(value))return value.map(x=>redact(x,secrets,roots));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,/^(?:api[-_]?key|authorization|password|secret|accessToken|refreshToken|credentials)$/iu.test(k)?'[REDACTED]':redact(v,secrets,roots)]));
  if(typeof value!=='string')return value;
  let s=value.replace(/Bearer\s+[^\s"'<>]+/giu,'Bearer [REDACTED]').replace(/\bsk-[\w-]{12,}/gu,'[REDACTED]');
  for(const secret of secrets.filter(x=>typeof x==='string'&&x.length>=8))s=s.split(secret).join('[REDACTED]');
  for(const root of roots)s=s.split(root).join('<TEST_ROOT>').split(root.replaceAll('\\','/')).join('<TEST_ROOT>');
  return s;
}
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function telemetryHtml(data) {
  return '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta http-equiv="refresh" content="3"><title>DSH 手动测试统计</title><style>body{font:16px system-ui;margin:32px;max-width:1400px;background:#f7f9fb;color:#17212c}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:white;padding:20px;border:1px solid #ccd5df}strong{color:#9c3600}</style><h1>DSH 手动测试 · 只读统计</h1><p>科研操作使用官方 Desktop。此页每 3 秒刷新，不发起模型或网络请求。</p><p><strong>费用：未知。未连接服务商账单；未知 Token 为 null，不能当作 0。这里统计原生 dispatch，服务商内部不可见重试/计费仍未知。</strong></p><pre>'+escape(JSON.stringify(data,null,2))+'</pre></html>';
}

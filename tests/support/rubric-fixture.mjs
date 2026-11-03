/** Deterministic reasoning fixture. Never included in the plugin package. */
export const taskFields={domain:'参数高效微调',problem:'在预训练模型上分别更新权重幅度和低秩方向',input:'预训练权重与下游训练样例',output:'适配后的模型权重',constraints:'固定训练参数预算，保留近邻等价任务',conditions:'可取得预训练权重及可微训练目标',subtaskBoundary:'同时比较LoRA、权重归一化及同构重参数化，不只比较方法名称',comparisonPoint:'2026-11-03'};
export const syntheticQuote='The synthetic mechanism changes one local prediction rule and can be independently checked.';
export const syntheticText=(syntheticQuote+' This controlled example contains a method, a definition and a reproducible structural relation. ').repeat(8);
function quote(doc,round=1){
 const locations=doc.provenance?.locations??[];
 const phrases=round===2?['Drawing on Weight Normalization','It is important to highlight']:['We initialize DoRA','The directional component','The synthetic mechanism'];
 let preferred;
 for(const phrase of phrases){preferred=locations.find(l=>doc.text.slice(l.start,l.end).replace(/\s+/g,' ').includes(phrase));if(preferred)break}
 preferred??=locations.find(l=>/4.1|method|parameterization|reparameterization/i.test(l.label)&&l.end-l.start>250)??locations.find(l=>l.page===2&&l.end-l.start>250)??locations.find(l=>l.end-l.start>250);
 const text=(preferred?doc.text.slice(preferred.start,preferred.end):doc.text).replace(/\s+/g,' ').trim();
 let index=-1;for(const phrase of phrases){index=text.indexOf(phrase);if(index>=0)break}if(index<0)index=0;
 return {sourceId:doc.id,location:preferred?.label??'Synthetic method relation',quote:text.slice(index,index+300)};
}
export function rubricFixture(stage,p,options={}){
 const duplicate=options.duplicate??false;
 if(stage==='target-task-extractor')return taskFields;
 if(stage==='contribution-extractor')return {paperVersion:p.papers[0]?.title??'Synthetic public-method test',comparisonPoint:p.targetTask.comparisonPoint,coreReadable:true,mainline:'固定目标任务下，核验权重分解与低秩方向更新这一不可约关系。',noveltyUnit:'幅度/方向分解以及低秩方向更新的关系',contributions:[{id:'c1',claim:'以已公开的幅度/方向分解及低秩更新关系构建候选方案',kind:'algorithm',core:true,evidence:[quote(p.papers[0])]}]};
 if(stage==='search-planner'){
  const queries=options.live?[
    'DoRA Weight-Decomposed Low-Rank Adaptation',
    'Weight Normalization A Simple Reparameterization to Accelerate Training',
    'DoRA initialization pretrained weight directional component LoRA'
  ]:['synthetic local prediction baseline','synthetic equivalent earlier mechanism counterexample','synthetic update relation proof verification'];
  return {strategy:['baseline','adversarial','cross-verification'][p.round-1],previousReadings:p.round===1?[]:p.previous.at(-1).sources[0].readings.slice(0,1),queries:[queries[p.round-1]],adjustmentFromPrevious:p.round===1?'建立低秩方向更新的比较基线。':p.round===2?'前轮发现DoRA，主动检验权重归一化与相同关系的早期来源。':'前轮发现幅度与方向训练方式的区别，回到原文核对初始化与冻结变量。',sourceUrls:[]};
 }
 if(stage==='search-plan-reviewer')return {substantivelyDifferent:true,usesPreviousDiscoveries:p.round>1,reasoning:'基线定位、主动反证和计算关系核验分别回答不同问题；后轮引用前轮取得的原文发现。'};
 if(stage==='source-selector'){
  const preferred=p.candidates.find(s=>/2402\.09353/.test(s.url))??p.candidates[0];
  const other=p.candidates.find(s=>s.url!==preferred.url&&!/2402\.09353/.test(s.url)&&/1602\.07868|weight normalization|Synthetic alternative/i.test(s.url+' '+s.title));
  return {urls:[preferred.url,...(other?[other.url]:[])]};
 }
 if(stage==='source-verifier'||stage==='adversarial-reviewer'){
  const d=p.documents.find(d=>/2402\.09353/.test(d.url??''))??p.documents[0];
  return {sufficiency:{coreVerified:true,methodReadings:[quote(d,p.round)],earlierWorkCheck:'本地夹具只验证早期工作审查字段与已取原文关联，不声称完成科学检索充分性。',isomorphismCheck:'本地夹具核验字段和逐字引用；科学同构判断需独立审查。',closestPrecedentCheck:'本地夹具读取已获取的最近机制位置，仅作为工程验收。',alternativeDecisions:p.documents.filter(x=>x.id!==d.id).map(x=>({url:x.url,disposition:'read',reason:'实际获取第二工作原文，夹具验证跨来源核验工程路径。',evidence:[quote(x)]})),unresolvedAlternatives:[]},nearestPrecedents:[d.id],support:duplicate?[]:['合成用例中的局部规则存在可核验结构变化。'],counterexamples:duplicate?['候选方案的幅度/方向分解及低秩方向更新已经出现在取得的DoRA原文中。']:[],exclusions:duplicate?['不排除命中的相同关系；它直接否定候选新增。']:[],changeFromPrevious:p.round===1?'定位最近原文，暂不计算分数。':p.round===2?'主动核对归一化来源及训练方式差别；候选重复关系仍未消除。':'原文变量初始化和低秩更新关系已交叉核验。',readings:[quote(d,p.round)],criticalMissingSources:[]};
 }
 if(stage==='validity-reviewer'){
  const d=p.documents.find(d=>d.primary&&d.url)??p.documents[0];
  return {findings:[{contributionId:'c1',result:duplicate?'duplicate':'verified',scope:duplicate?'只核验这一候选复用了已公开计算关系；不声称论文全部贡献已无效。':'合成结构事实支持局部规则变化。',evidence:[quote(d)]}],criticalUncertainties:[],nonDecisiveDisputes:options.provisional?['非决定性争议：合成局部规则的命名解释仍待讨论。']:[]};
 }
 if(stage==='rubric-classifier'){
  const d=p.documents.find(d=>d.primary&&d.url)??p.documents[0];
  const seed=p.extraction.contributions[0];
  const f={id:'f1',statement:duplicate?'候选关系与DoRA原文的已公开关系相同。':'合成用例中可核验的局部规则事实。',evidence:[quote(d)]};
  const c={...seed,category:duplicate?null:'A2',S0:duplicate?0:1,R:0,R_included:0,eligibility:duplicate?'duplicate':'verified',servesMainline:true,validityReview:p.validity.findings[0].scope,validityFactIds:['f1'],categoryFactIds:duplicate?[]:['f1'],baseFactIds:[],adaptationFactIds:[],independenceFactIds:[],sourceModuleAssessment:{origin:'公开原始论文',attribution:'原始关系归属于原作者',novelty:'仅比较实际取得的关系',necessaryComplexity:'不按代码长度或参数数量加分',role:'原文核验幅度/方向和更新关系',factIds:['f1']},problemComparison:{oldProblem:'预训练模型适配',newProblem:p.targetTask.problem,obstacle:'候选没有建立不同障碍',mapping:'相同幅度/方向关系',effect:'不额外主张因果提升',deduplication:'不拆分同一关系领取R或J'},boundaryChecks:{lowerCategory:duplicate?'相同关系已存在，核验重复归零':'局部计算规则',coreRelation:'按取得的初始化与更新关系比较',basicPrinciple:'没有新基本原则的证据',problemNonEquivalence:'没有新的非等价问题',nonFragmentation:'保留一个不可约关系',c8HighEnd:'不适用',e9Conditions:'不适用'}};
  return {contributions:[c],facts:[f],sameFactGroups:[],mainline:{status:'established',reasoning:'只审查候选关系与已公开原文的对应。'},criticalUncertainties:[],nonDecisiveDisputes:[],confidence:{level:'medium',reason:'本地推理夹具；验证结构和证据链，不能代替领域专家科学判断。'}};
 }
 if(stage==='overlap-reviewer')return {sameFactGroups:[],reasoning:'仅一个不可约候选贡献，不拆分同一事实领取奖励。'};
 if(stage==='final-synthesis')return {text:duplicate?'在公开原文与本地推理夹具范围内，候选复用了已公开关系，确定性计算为0。此为功能验收，非整篇DoRA论文的原创性评定。':'合成推理测试已通过证据门槛；分数由程序计算。',disagreement:'旧评分为本地夹具88/100，Rubric证据/计算独立记录，不改变旧DAG结果。'};
 throw new Error('Unknown rubric fixture stage '+stage);
}

import fs from 'node:fs';import path from 'node:path';import {assertFreshBuild} from './build-provenance.mjs';
const root='D:/dsh-research-agent',e=root+'/.acceptance/rubric-science-20261103',build=assertFreshBuild();
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/u,''));
const feed=read(e+'/nightly-after.json'),ctx=read(e+'/context.json'),tests=read(e+'/checks-final-delivery/vitest.json');
const findings=read(e+'/science/qualitative-review.json');
const rel=(label,p)=>`[${label}](${e}/${p})`;
const report=`本轮已完成可靠性代码修改、公开论文取证、真实模型限额试运行与官方 Nightly Desktop 工程验收。Rubric 仍为 Shadow；旧 0–100 分、70 分门槛、重试和 DAG 继续决定流程。**尚无足以替代旧评分的跨领域科学证据，现在不应开启唯一 Rubric 评分。**

1. **当前基线与保护情况**

项目 D:\\dsh-research-agent，分支 main，HEAD f8f3ddfe0b4677815905760ee44e90a2c56c7c86。本轮起点源码身份 5162b897c91d4e24b6ff1697cba3f9c9b001f5ccf7ba71b7c5f51706c190e6ba；最终 ${build.sourceSha256}。起点已有 dirty/untracked 成果全部保留；本轮差异以 checkpoint 比较，不能把相对 HEAD 的所有旧修改算成本轮贡献。没有 commit、push、安装包或独立 Research Web。

Rubric Markdown SHA256 保持 50990acd698ac5fada0f9d055864c982fdec3361fc9bd3542ba96dbd076532ff，scorer 保持 23044417392c02bba9792447e536f3b46451ae5931d94c130a832aea8b5a104e。评分区间、A/B/C/D/E/P、R/J 与公式均未修改；research v1 不迁移、不换算、不重算。

${rel('起点快照','checkpoint/source-index.json')}、${rel('本轮变更清单','final/this-turn-changes.json')}、${rel('最终构建清单','final/build-manifest.json')}。

2. **实际代码改动与可靠性**

- 多角色评审改为逐项持久保存到独立 research_review v1。session/节点/角色/完整提示哈希决定复用范围；Promise.allSettled 保存其他成功项，显式重试只补未成功角色。失败不能提前推进 DAG；空结果或损坏检查点明确失败。十项恢复回归覆盖取消、迟到响应、落盘失败、输入变化及单写入租约。
- 研究阶段增加超时配置，默认 300000ms，范围 1–900000ms。外部取消与阶段期限传给模型及联网；忽略取消的适配器迟到结果不得提交成功检查点。仍依赖官方 adapter 的 dispose 合作，不宣称可以强杀一切卡死适配器。
- 显式 dataDirectory 用独占 .research-writer.lock 限制单 Host 写入；正常关闭释放，第二写入者拒绝。崩溃残锁须人工核实 PID 后处理，不能自动抢锁。默认官方 storageDomain 仍依靠官方 Host 所有权；controller 保持全局串行，未开放多 Session 同写。
- innovationMode 默认 shadow；配置 authoritative 明确拒绝启动，防止未经校准被误启用。未来执行契约见 [权威模式方案](D:/dsh-research-agent/evaluation/rubric-1.7.0/AUTHORITY_SWITCH.md)。当前没有可运行的权威执行器，也没有未经校准的固定门槛。
- arXiv fallback 对每个关键词使用独立 all 字段和 AND，避免只有首词受字段约束；查询规划增加已有论文标识，要求短的可索引标题/机制词，论证句和比较日期放在说明字段。两项回归验证查询结构与传递的原文标识。
- 真实构建发现 CSS 导出字典顺序不稳定，使相同源码的 client.js 哈希不同。已固定字典排序；两次真实干净构建的全部 42 项产物 SHA256 一致。${rel('可重复构建回归','reproducible-build/result.json')}。验收截图增加受限的原生 Electron capturePage 回退，截图失败不伪造通过。

3. **原文能力与真实取证**

复用现有 PDF.js、上传读取和受控 OCR 适配器，未重写 PDF 解析器。官方 DSH Web 处理检索/HTML；二进制 PDF 用已有受限公开 HTTPS transport。支持 arXiv HTML/版本 PDF、公开 OpenReview、ACL、DOI/出版落地页开放链接、PMLR，以及 OpenAlex/Semantic Scholar 的元数据与原文定位。OpenReview 上阶段返回 403，本轮没有新增成功证明；不绕访问限制或付费墙。

本轮十案例有 26 条读取尝试，其中 22 条相关正文记录，按 PDF 哈希去重为 19 份公开 PDF；另有 3 条失败记录及 1 条身份错误资料。相同论文的多入口、重试和共享来源不重复计成独立先例。DOI→ACL 的 BERT 16 页正文、PMLR 温度缩放及多篇 arXiv 原文均实际取得。独立取证原始日志有 73 条响应/获取记录，53 条 200、20 条 429；这不是线级 HTTP 总次数。

保存原始和实际 URL、版本、版本日期未知时 null、抓取时间、PDF/正文 SHA256、页位置、缺页和截断。metadata/partial/core-complete/unavailable 区分获取覆盖；core-complete 不保证书目身份、公式理解或科学充分。超长 PDF 仍可能超页数/字符/20MB或时间限制；本轮科学取证显式用 100 页上限，A 类验收用 40 页，不能视为默认限制已放宽。OCR 预算为 0，未完成真实扫描论文 OCR 科学验收。

${rel('科学原始记录','science/network.jsonl')}、${rel('结构化定性审查','science/qualitative-review.json')}、${rel('公式渲染索引','science/visual/render-index.json')}。

4. **三轮查新与证据质量**

十案例均保存三轮真实检索尝试及前轮发现依据：第一轮定位原始工作，第二轮追同构/异名和早期工作，第三轮追引文与核心原文。OpenAlex/S2 限流后，独立补证第二、三轮改用 arXiv API，并遵守来源间隔，没有把 429 当作无先例。生产检索尚未实现跨评估共享的 Retry-After/cooldown；高并发下限流和召回不足仍是边界。

实际阅读使比较对象发生修订：DoRA→WN/LoRA，RAG→REALM/ORQA，LoRA→Intrinsic Dimension，Attention→早期自注意力/非循环注意力，认证→Lecuyer/Li，威胁模型→Szegedy。关键词 AND 对过长论证句过严，真实模型失败暴露后才改短查询提示。

视觉核对 DoRA第4页式(5)、WN第2页式(2)、LoRA第3页式(3)，以及随机平滑第4页和附录14–17页、Li先例第5页。该检查确认了所读页面的公式与假设位置，不等于独立证明审核。历史比较严格区分首次发表日期与当前取得版本日期；例如 DoRA v2 是2024年3月版本，不能直接沿用首次v1日期。

一条人工请求把 arXiv:1306.1809 标成 Evasion attacks，实际 PDF 是宇宙学论文，已在结构化报告和专家材料中排除，保留原始错误请求与正文哈希。Biggio相关2017 arXiv记录不能直接证明2013出版版本内容。本轮未取得其2013出版原文。不能用来源标题或机械全文覆盖替代身份核实。

5. **十案例科学结果与未决争议**

以下是当前 Codex 基于实际公开资料的定性审查，不是独立专家结论；boundaryFocus 是待检验问题，绝非预设分类或分数。${findings.cases.length} 案例科学分数均 null，没有把 Mock 结果移植为公开论文评分。

| 案例与目标时点 | 实际证据/仍缺材料 | 科学结果 |
| --- | --- | --- |
| DoRA复述；2026-11-03参数高效微调 | 方法关系与DoRA可直接对应；不据此评定2024原始贡献，真实流水线三轮充分性尚未通过 | insufficient/null |
| 合成局部规则；2026-11-03文本分类 | 温度缩放先例已取得，候选门控公式缺失 | insufficient/null |
| RAG；2020-05-22开放域问答 | 潜文档边缘化与REALM/ORQA有比较；DPR/BART及最近生成先例尚未完整核清 | insufficient/null |
| LoRA；2021-06-17冻结模型适配 | 可训练BA与固定Fastfood投影不同；更早低秩/适配器先例和必要性待核 | insufficient/null |
| Attention；2017-06-12机器翻译 | 早期非循环/自注意力已取得；ByteNet/ConvS2S等完整比较未完成 | insufficient/null |
| Randomized Smoothing；2019-02-08认证 | 定理半径、概率界与tightness证明原文已读，Li/Lecuyer先例已取得；等价性及严格理论增量尚无独立核验 | insufficient/null |
| Adversarial Examples；2014-12-20威胁建模 | Szegedy v1已取得，攻击新算法不能自动计新P；Biggio2013原文仍缺 | insufficient/null |
| 缺失核心证明的合成认证 | 三轮查询不能补出不存在的证明 | insufficient/null |
| 合成检索门控冲突 | 有RAG/FLARE原文，候选两份说明缺决定性公式，可能改变分类和J | insufficient/null |
| DOI/ACL/BERT定位样本；2026-11-03 | 公开原文可取得，但不是已明确定义的新科学方法候选 | insufficient/null |

贡献已拆成可审的最小关系假设，尚未把每一项资格标为 verified。R、J、主导项及最终类别保持未决；没有为填表而给R/J或C8、P4、E8高档。缺失门控、关键先例或理论等价性可能改变定类时，不能用 provisional 掩盖核心未知。置信度单独记录，不替代状态；实际数值仍只能交原确定性 scorer。未取得合格 scorerInput 的案例不调用数字计算。

6. **已授权真实模型试运行与预算**

按用户授权使用 DeepSeek 配置中名为“实验室”的 gpt-6-sol 号池路由。只读取该路由与选定凭据引用；凭据仅进入测试子进程环境，不写入测试 profile 或证据，不修改正式默认模型。精确凭据扫描结果见 ${rel('凭据隔离核验','credential-isolation-audit.json')}。

每次每例硬上限：90秒、60模型请求、30网络预算操作、200万提示字符、每请求maxTokens4096、0 OCR；provider自动重试0。先跑两例，再针对查询提示改进复测两例，达到上限即止；没有无限重试，也未因预算耗尽生成数字。

| 运行 | 案例 | 请求/网络预算操作 | 结果 |
| --- | --- | --- | --- |
| 首次 | DoRA复述 | 3 / 9，52.802秒 | insufficient/null，限流及查询未命中 |
| 首次 | 随机平滑 | 3 / 9，65.409秒 | insufficient/null，限流及查询未命中 |
| 复测 | DoRA复述 | 2 / 0，90.023秒 | 预算耗尽，流中止，没有完成的assessment |
| 复测 | 随机平滑 | 4 / 10，90.038秒 | 到达source-selector后预算耗尽，没有完成的assessment |

累计12次发起请求、28次网络预算操作、354213提示字符；路由实际报告108825 tokens，其中输入103519、输出5306。中止请求可能未回报用量，不能把这些数字视为完整计费账单，也未推断费用金额。这里采用用户授权的有限资源预算，不声称号池一定免费。

${rel('首次真实模型结果','desktop-isolated/real-model-pilot/result.json')}、${rel('复测真实模型结果','desktop-isolated/real-model-pilot-release/result.json')}。原始提示、响应、事件、公开网络原始体、截图均保留。查询提示改善后取得了可检索英文词；时间上限、模型延迟和429仍使三轮未完成。B类只是两例Rubric pilot，**真实模型科学判断未通过，也未完成真实模型的整条科研DAG验收**。末尾构建改动只固定CSS导出顺序，Host逻辑与该pilot相同；没有借最终构建之名重复模型消耗。

7. **独立专家校准准备**

${rel('专家材料说明','expert-materials-release/README.md')}包含10份盲审JSON、原Rubric、公开原文/哈希/页索引和提交模板。优先领域是参数高效微调、对抗鲁棒性与认证理论，各留三名真实独立专家席位，当前均为空。PRIVATE映射及roster仅供协调员；先独立提交，后披露其他意见，来源标题不能假装完全匿名。旧工程分和预设档位不进入盲审包。

compare-rubric-reviews只比较相同案例、任务摘要、比较时点和Rubric版本；有数值必须核对原scorer，逐对比较类别、R、J、主导与状态。空专家输入分析实际返回0名专家、calibration=false。工具不会因三个声明或模型数量自动宣布校准。**专家校准尚未执行；未联系或虚构任何专家。**

材料和分析工具已能支持招募和独立审阅；要形成可用于切换的科学证据，仍须真实合格专家、关键材料补全、独立性核验、分歧协调及留出验证。当前不能称跨领域数值校准条件已经全部满足。

8. **最新版官方 Desktop 与完整流程验收**

2026-11-03官方Nightly更新源复核为 ${feed.version}，发布 ${feed.releaseDate}，签名Valid；真实Electron44.7.0、内置Node24.21.0。测试EXE SHA256 7ae939b5a82b220fbd8ad04dfbafaaedb5a49ab43dc884a5db6381f678dd0cc4，ASAR e1b6f25fa937da98086c3e77af77aa14791105963c4d337a1c42179d232c6915。没有修改官方EXE/ASAR；正式F盘二进制前后哈希保持一致。

有效隔离根为 ${ctx.root}，home/profile/userData/workspace/research-data分开。**本轮最初环境准备曾先启动后改workspace配置，四个新建合成会话误导出至F盘默认workspace。** 已按本轮独有sessionID和合成内容核验，归档移走四个新目录，未覆盖已有真实科研记录。随后重建全新隔离环境，在首次启动前配置所有路径，并在上传后断言导出位于隔离workspace。不能把本轮说成从未发生过隔离疏漏。${rel('归档与核验','synthetic-export-cleanup-verification.json')}。

最终四套验收对应最终产物清单：

| 工程验收 | 结果与证据 |
| --- | --- |
| A类完整流程 | ${rel('通过','desktop-isolated/full-flow-deterministic-final/result.json')}：PDF上传→摘要→问题→检索→候选/Rubric→UI确认→完善→定向检索→多角色→方案选择→计划预览→确认写入→退出重启，revision10恢复 |
| Shadow风险 | ${rel('通过','desktop-isolated/shadow-risk-deterministic-final/result.json')}：三次旧拒绝仍独立审计，旧DAG/revision不变；按钮取消null；20ms预算不否决旧通过 |
| 历史v1 | ${rel('通过','desktop-isolated/legacy-v1-deterministic-final/result.json')}：闭机注入纯合成v1兼容夹具，83/100、70、revision6保留，无静默重算或新模型调用 |
| 插件移除 | ${rel('通过','desktop-isolated/plugin-disabled-deterministic-final/results.json')}：官方CLI只移除隔离profile插件，独立本地聊天Mock验证普通原生聊天，正常退出、无残留测试进程与监听端口 |

A类推理全用明确Mock，公开文献网络真实；旧35拒绝/88通过与Rubric0是工程夹具。UI确认由验收自动化执行，证明确认机制和落盘，不是人类专家认可研究内容。评审故障后两成功一失败保存，重启只补调1次；两次重同步不加revision、不调用模型。独立论文取证script的public-web transport与Desktop官方Web接口记录分开。

方案分支通过；实验仍限固定OLS示例，未验收通用科研实验执行。B类完整流程未通过，不能用A替代。原始失败记录保留，包括截图超时、重复执行时误统计旧检查点、关闭插件后科研专用Mock失去依赖；后者改用既有独立聊天适配器后验证通过。

9. **测试与已知问题**

| 检查 | 最终结果 |
| --- | --- |
| Build / 构建身份 / 常规Host与Client Typecheck | 通过 |
| 严格Client skipLibCheck=false / Lint | 通过，Lint 0诊断 |
| Vitest | ${tests.testResults.length}文件，${tests.numPassedTests}通过、${tests.numFailedTests}失败；236起点已实际复跑 |
| 两次构建产物比较 | 42项SHA256全部一致 |
| 严格Host skipLibCheck=false | 失败，仍3条官方SDK声明错误 |
| 最终官方Desktop四套工程验收 | 4通过、0失败；开发期失败尝试仍保留 |
| 真实模型科学评价 | 两例复测均未完成；没有科学通过结论 |
| 独立专家校准 | 0名、未执行 |

${rel('质量检查','checks-final-delivery/result.json')}、${rel('严格Host原始诊断','checks-final-delivery/strict-host.log')}、${rel('最终进程端口','processes-final.json')}。

仍有实质边界：D盘ReplaceFileW1175外部触发根因未定位，本轮句柄注入实际产生32，不能说修复1175；SDK三错未伪造类型处理。模型已响应/已计费但尚未保存之间崩溃仍可能重复调用；不能承诺跨崩溃exactly-once。running检查点需用户显式重试；跨domain不是单一事务，显式文件重同步仍可能失败。残锁可能要求人工处理。长PDF、公式排版、OCR、未知版本日期、错误书目身份、索引429及科学召回不足继续影响评分。取消能阻止提交，不等于外部模型永不继续计费。没有宣称完全无风险。

10. **明确回答与未来切换**

- Rubric是否已具备取代旧评分的科学证据？**没有。**工程门禁、取证和算术通过，不证明跨领域分类与决策有效。
- 完整科研流程通过哪一种验收？**A：本地Mock推理＋真实公开资料联网。**B只做两例真实模型Rubric pilot，未通过完整流程或科学充分性。
- 哪些步骤仍依赖Mock？A中的摘要、问题提炼、候选生成、旧评分、Rubric语义判断、方案完善、角色评审和计划文本均为Mock；文件、状态、公开网络和官方Electron是真实执行。
- 哪些原文/查新不足？核心证明缺失/门控冲突合成案；Biggio2013出版原文；RAG完整组件先例、Attention最近序列转换先例、LoRA早期适配器/低秩先例，以及随机平滑完整独立证明/理论比较；DoRA真实流水线仍未完成三轮充分性。来源列表不是充分性证明。
- 数据风险？崩溃计费窗口、单写入租约残留、跨domain事务边界、外部替换失败、长文/OCR及版本/身份问题；最初隔离疏漏已披露并清理合成目录。
- 现在是否适合唯一Rubric评分？**不适合。**保持Shadow，完成真实专家审阅与留出验证后，才可实现/解锁已校准领域规则。complete匹配校准规则才自动前进；provisional展示争议并确认；insufficient/null补证或人工复核，不能当通过或零分；旧分只历史对照，不自动0–100→0–10换算。

本轮建立了更多可追溯证据和可恢复软件流程；科学数值验证与专家校准的缺口仍明确保留。最终证据及源码差异按SHA256索引于 ${rel('冻结汇总','final/summary.json')} 和 ${rel('证据索引','final/evidence-index.json')}。
`;
fs.writeFileSync(root+'/docs/RUBRIC_SCIENTIFIC_VALIDATION_2026-11-03.md',report);
console.log(JSON.stringify({report:'docs/RUBRIC_SCIENTIFIC_VALIDATION_2026-11-03.md',sourceSha256:build.sourceSha256}));
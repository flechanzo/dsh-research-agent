# Rubric v1.7.0 原文与 Shadow 可靠性验证报告（2026-11-03）

本轮已实际修改插件、构建并完成 236 项测试，以及官方 Nightly DSH Desktop 的隔离运行。Rubric 继续处于 Shadow Mode，原 Markdown 和确定性 scorer 均未修改，旧 0–100 分、70 分门槛、默认三次尝试及 DAG 决定保留。

工程验证已完成。**多档位公开论文的科学数值验证尚未完成**：公开材料共 10 个案例，全部保持科学分数 null；Desktop 中的数值来自明确标识的本地 Mock 推理，只证明流程、证据传递和算术。没有实际独立领域专家审查，不宣称专家校准完成，也不建议启用权威 Rubric 门槛。

1. **代码与基线**

项目为 `D:\dsh-research-agent`，分支 `main`，HEAD `f8f3ddfe0b4677815905760ee44e90a2c56c7c86`。起点源码身份为 `6d993e81c70f67f238182cbb4517c6b98aae83a495c1f884195df447f513b8d6`，最终构建源码 SHA256 为 `5162b897c91d4e24b6ff1697cba3f9c9b001f5ccf7ba71b7c5f51706c190e6ba`。原有未提交修改、缓存和历史证据均保留，没有 commit、push、正式安装包或独立 Research Web。

Rubric SHA256 仍为 `50990acd698ac5fada0f9d055864c982fdec3361fc9bd3542ba96dbd076532ff`；scorer SHA256 仍为 `23044417392c02bba9792447e536f3b46451ae5931d94c130a832aea8b5a104e`。

主要代码在 `innovation/network.ts`、新增 `documents.ts` / `public-pdf.ts`、共享 `workflows/paper-reader.ts`、`pipeline.ts` / `schema.ts`、新增 `shadow.ts` / `reviews.ts`、coordinator/controller，以及原生 `ShadowAuditView` 和科研面板。新增公开样本、采集/分歧比较脚本、回归测试和真实 Electron 验收脚本。与本轮起点的差异及快照保存在 [本轮变更索引](D:/dsh-research-agent/.acceptance/rubric-evidence-20261102/final/this-turn-changes.json)，不能把相对 HEAD 的所有旧 dirty 修改算成本轮贡献。

2. **原文来源与 PDF 能力**

官方 DSH Web 负责索引和 HTML；其当前接口没有二进制响应能力，因此公开 PDF 使用明确独立且受限的 HTTPS transport。上传和公开 PDF 共用既有 PDF.js / canvas / OCR adapter，没有增加另一套 PDF 解析系统。

| 来源 | 实现与本轮实际证据 |
| --- | --- |
| arXiv | 支持正文 HTML、版本 URL、PDF 回退；实际取得 DoRA HTML 和 19 页 PDF、LoRA 等版本 PDF |
| OpenReview | 支持公开 forum/PDF 定位；本轮 LoRA PDF 返回 HTTP 403，准确记录 unavailable，未绕过 |
| ACL Anthology | 实际取得 BERT 16 页 PDF |
| DOI / 官方落地页 | 提取 citation_pdf_url 和公开链接；实际验证 DOI → ACL → BERT PDF；落地页摘要不再冒充正文 |
| OpenAlex / Semantic Scholar | 元数据检索和原文定位，保留来源错误及 fallback；元数据不等同全文 |
| 其他出版源 | 默认 PDF allowlist 还包括 PMLR；额外 HTTPS 出版源需显式配置。本轮未声称已实测所有出版站点 |

PDF 采用 HTTPS 来源允许列表、无凭据请求、最多三次重定向、20 MB、20 秒、取消信号和来源间隔（arXiv 3.1 秒，其他 1 秒）。不绕付费墙。正文分为 metadata / partial / core-complete / unavailable，保存原始与实际 URL、版本、未知则为 null 的版本日期、原始响应与正文哈希、页码或章节 offset、抓取时间、截断、缺页和失败尝试。

修复了真实采集中发现的 ACL 落地页误判：重复摘要和引用即使很长，也必须存在有正文内容的方法/理论章节才可标记 HTML core-complete；支持未加引号的 HTML 属性，能继续定位公开 PDF。core-complete 表示获取和提取覆盖，仍须审查公式、符号和科学含义。没有把 PDF 文本提取成功等同科学核对成功。

扫描页可接既有受控 OCR；Shadow 默认 OCR 预算为 0。无法 OCR 或缺页时保留 partial/unavailable，不伪造 OCR 成功。本轮没有真实扫描论文 OCR 成功的验收结论。

3. **三轮查新**

保留强制三轮。后续规划接收前轮实际读到的原文、发现、排除理由及未解决替代解释，分别覆盖最近原始工作、同构/异名与早期反例、关键公式/机制/理论/定义核对。加入独立的充分性审查、其他先例的阅读或有引文依据的排除、未解决冲突检查；三次查询本身不代表充分。

引用必须真实存在于保存正文的指定页或章节位置；HTML/PDF 同一工作不算多篇先例。实际 PDF final URL 与索引 landing URL 可对应，替代先例的实际阅读会进入持久审计并传给后轮。关键材料、历史版本日期或冲突不足时，保留 insufficient/null；仅原 Rubric 允许的非决定性争议才可 provisional。最终数字仍由原 TypeScript scorer 计算。

4. **Shadow 对照与资源控制**

旧拒绝和旧通过候选现在都可评价，独立写入 `research_shadow` v1 domain，不依赖科研 DAG 成功提交。审计记录旧决定、Rubric 状态/可选分数、候选哈希、尝试序号、source revision、用量，以及检索证据、分类、贡献独立性、旧体系四类分歧。legacy-error、cancelled、budget-exhausted、interrupted 不冒充完成。Host 重启可把遗留 running 标为 interrupted/null。审计持久化失败会告警，不能否决旧通过结果。

默认累计预算为 90 秒、3 个候选、60 次模型调用、30 次网络操作、200 万 prompt 字符、0 OCR 页，并有开关。本次主验收显式使用 150 秒、100 次模型调用、45 次网络操作、500 万字符和 40 页 PDF；不能把该验收配置说成默认能力。默认 PDF 页上限仍为 12 页，超限会保守返回 partial/null，需要按材料长度显式配置。

真实 Desktop 发现客户端 RPC 取消未及时传到 Host，已增加按 session/revision 匹配的独立 Host cancel 入口，避免排在正在等待的操作队列之后；原生面板提供取消按钮，关闭标签也转发取消。同一面板同步锁防止快速重复提交。保留原串行协调器与 revision 冲突检查；取消后不提交 DAG。重试数、旧分数和通过规则没有改变。预算计数是受限 transport 操作数，重定向还受各自固定上限约束，不应与线级 HTTP 请求总数混淆。

5. **公开样本与真实证据**

[样本清单](D:/dsh-research-agent/evaluation/rubric-1.7.0/cases.json)包含 10 个案例，任务有明确输入、输出、约束和比较时点。现代/合成样本比较时点为 2026-11-03；历史探索样本固定在各自首次发表时点，必须继续核实实际版本日期。boundaryFocus 是待审问题，绝非预设分类或分数。

| 待检验边界 | 材料与范围 |
| --- | --- |
| 已公开方法复述 | DoRA 幅度/方向与低秩更新；现代参数高效微调 |
| 局部创新 | 合成温度/门控规则；文本/句对分类 |
| 已有技术组合 | RAG；开放域知识问答 |
| 迁移与结构适配 | LoRA；冻结权重的低秩适配 |
| 核心机制 | Attention；机器翻译信息路径 |
| 理论/基本原理 | Randomized Smoothing；L2 图像鲁棒认证 |
| 问题/威胁定义 | Adversarial Examples；受限扰动威胁模型 |
| 信息不足/冲突 | 缺失关键证明；检索门控贡献独立性冲突 |
| 全文定位附加案例 | BERT DOI → ACL → PDF |

[最终采集结果](D:/dsh-research-agent/.acceptance/rubric-evidence-20261102/corpus-verified/result.json)记录 53 次预算操作，7 篇不同公开论文，9 份正文记录（包括同文 HTML/PDF 及 DOI 路径），另 1 份 OpenReview 403 记录。原始响应、正文、哈希、版本、位置、网络日志和 10 份评分盲审资料均保存。同一论文的不同入口不计成独立论文。

采集脚本的三轮是资料收集，**没有完成科学查新充分性审查**。全部案例的科学分数仍为 null、unreviewed。[定性负对照核对](D:/dsh-research-agent/.acceptance/rubric-evidence-20261102/qualitative-negative-control.json)由当前 Codex 根据 DoRA 第 4 页及公式 (5) 核对候选与公开方法的对应关系；没有将其改名为专家结论或完整 Rubric 科学评分。未给原论文在发表当时打分，也未以论文影响力设高分答案。

复现命令：`node --experimental-strip-types scripts/acquire-rubric-corpus.mjs <新的输出目录>`。该独立采集的 HTML transport 明确标为 public-web；Desktop 验收使用官方 Web 服务接口，不能混同两类运行证据。

6. **测试与质量边界**

| 检查 | 最终结果 |
| --- | --- |
| 构建、构建身份、常规 Host/Client Typecheck | 通过 |
| 严格 Client skipLibCheck=false | 通过 |
| Lint | 0 diagnostics |
| Vitest | 21 个测试文件，236 通过，0 失败 |
| 严格 Host skipLibCheck=false | 失败，仍有 3 条官方 SDK 声明错误 |
| 真实 Electron 中确定性算术 | 5 个合成边界全部通过 |

算术边界包括 C8 高端加独立 E1 得 8、P4 加独立 E1 得 7.5、更强次贡献切换主导、主线失败 M=4 和重复为 0。这些使用原 scorer 和合成事实，不是公开论文的科学评分。回归覆盖贡献保留、事实去重、R/J、状态与 null、网络失败、PDF 缺页、预算、取消、旧拒绝重试和历史兼容。

最小不可约贡献、源模块必要复杂性、C8 高档、P4、E8 及以上的额外门槛仍含科学语义判断：字段、逐字证据和确定性算术检查不能证明这些判断正确。需要领域专家核对贡献切分、类别边界、证明假设、非等价问题定义和独立性。置信度单独记录，不能代替 complete/provisional/insufficient。

开发过程中失败没有抹去：保留索引/PDF URL 对应、替代先例持久化、取消链路、落地页误判、验收只认 HTML 哈希，以及聊天未完成就退出等记录；修复后才采用最终通过结果。最终单元测试 0 失败不表示整个开发过程从未失败。

7. **官方 Desktop 真实运行**

官方 Nightly 更新源经多次复核，最后记录在 [更新源证据](D:/dsh-research-agent/.acceptance/rubric-evidence-20261102/nightly-post-tests-meta.json)：`0.2.1-rc.5`，releaseDate `2026-10-29T14:04:01.198Z`。实际 Electron `44.7.0`、内置 Node `24.21.0`。复用已校验官方安装包 SHA512 的解压副本，签名 Valid；没有修改 ASAR。

测试 EXE SHA256：`7ae939b5a82b220fbd8ad04dfbafaaedb5a49ab43dc884a5db6381f678dd0cc4`。测试 ASAR：`e1b6f25fa937da98086c3e77af77aa14791105963c4d337a1c42179d232c6915`。正式 `F:\deepseek` 的 EXE/ASAR 前后哈希相同。

本轮使用独立 DSH_HOME、profile、userData、workspace、attachments 和 research-data，配置见 [context](D:/dsh-research-agent/.acceptance/rubric-evidence-20261102/context.json)。测试读取公开资料，付费 provider 关闭，模型推理为本地 Mock；没有覆盖正式科研数据。

| 真实验证 | 证据 |
| --- | --- |
| 原生聊天、插件加载、目标任务编辑确认、公开 PDF 上传、HTML/PDF 多轮审计、旧拒绝后通过、断网 null、导出、reload 与真实退出重启恢复 | [主验收](D:/dsh-research-agent/.acceptance/rubric-evidence-20261102/desktop/evidence-transport-final/result.json) |
| 三次旧拒绝审计、DAG/revision 不变；按钮取消为 cancelled/null；20ms 预算不否决旧通过 | [风险验收](D:/dsh-research-agent/.acceptance/rubric-evidence-20261102/desktop/shadow-risk-landing-final/result.json) |
| 关闭原生科研标签取消，预算超时 | [标签取消日志](D:/dsh-research-agent/.acceptance/rubric-evidence-20261102/desktop/shadow-risk-tab-verified/workflow.log)；该附加运行只测取消/超时，三次拒绝另见上一行 |
| 旧 v1 83/100、threshold70、revision6 打开，不静默重算、不调用新模型 | [历史兼容](D:/dsh-research-agent/.acceptance/rubric-evidence-20261102/desktop/legacy-v1-landing-final/result.json) |
| 官方 CLI 移除隔离插件后，无科研入口，普通聊天完成、正常退出、进程与监听端口清理 | [插件关闭验收](D:/dsh-research-agent/.acceptance/rubric-evidence-20261102/desktop/plugin-disabled-verified/results.json) |

原始 Electron 日志、网络原始响应、截图和 build manifest 与上述结果同目录。[三轮记录截图](D:/dsh-research-agent/.acceptance/rubric-evidence-20261102/desktop/evidence-transport-final/three-round-online.png)、[重启恢复截图](D:/dsh-research-agent/.acceptance/rubric-evidence-20261102/desktop/evidence-transport-final/true-restart-restored.png)可直接查看。没有创建或启动独立 Research Web；官方 Desktop 自有 Host 的本地端口已纳入清理。

8. **科学评价边界**

本轮证实了可重复的证据获取、传递、保存、保守状态处理和确定性计算，并提供多领域材料。它没有证实模型能准确完成全部 A/B/C/D/E/P 科学分类，也没有证实评分具有跨领域效度。真实 HTTPS 加 Mock 推理只能作为工程验收，不能当作真实科学数值评价。未知材料不是重复，null 不是 0，已有高影响论文不是高分金标准。

9. **仍存在的问题**

D 盘 ReplaceFileW 1175 的外部触发根因仍未定位。本轮合成外部文件句柄触发的是可观测替换失败，不能把它说成复现并解决了 1175；释放后显式 resync 可恢复文件投影且不增 revision/模型调用。严格 Host 的 3 条错误位于官方 `dsh-session-projection` 声明第 150–151 行的泛型约束；没有改官方声明、伪造类型或增加无限重试。

OpenReview 403、部分出版站点访问条件、缺失历史版本日期、PDF 符号/公式提取质量、未实测的真实 OCR，以及自动科学分类的语义可靠性仍是限制。允许列表和预算也会使可公开访问的材料保守落入不足状态。最终测试成功不表示完全无风险。

10. **专家独立校准条件**

已具备启动受限跨领域盲审试点的技术材料：任务/时点/版本字段、原文快照、评分盲审包、实名来源与专业背景声明、当前 scorer 输入，以及按检索证据/分类/独立性/旧体系划分的结构化分歧工具。

运行 `node --experimental-strip-types scripts/compare-rubric-reviews.mjs reviews.json report.json` 可比较同一 case、任务摘要、时点和 Rubric 版本的审查。数值输入必须与现有确定性 scorer 的分数、J 和主导项一致。审查者身份、独立性及科学证据仍需外部核实；工具不会自动认定校准完成。

实际独立专家数量为 0。下一步应取得至少两个不同领域的真实独立审查，先解决历史版本和关键先例缺口，再开展盲标、一致性分析与分歧复核。当前仅可开始试点，尚不能宣称跨领域专家校准完成，也不具备将 Rubric 替换为正式创新门槛的证据。

完整源码快照、逐文件哈希、检查结果与证据索引在 [最终证据目录](D:/dsh-research-agent/.acceptance/rubric-evidence-20261102/final/summary.json)。

本轮已完成来源协调、公开原文缓存、Rubric 阶段检查点、有限预算恢复及 Desktop 隔离加固，并在重新核验的官方 Nightly Desktop 内完成 Mock 工程验收。真实模型预检缺少可核验版本与价格，依用户停止规则未开始生成。Rubric 保持 Shadow；本报告不宣布科学有效性或专家校准通过。

记录日期：2026-11-03，Asia/Shanghai。证据统一归档于 [本轮目录](D:/dsh-research-agent/.acceptance/rubric-efficiency-20261103)。历史 248 项测试、42 项产物及上一轮真实模型试运行均只作为基线，下面的新检查另有本轮日志。

1. **Git、源码身份与本地检查点**

项目 `D:\dsh-research-agent`，分支 `main`，HEAD `38cdaef9ffed88f5054578bef134419ea111851b`。本轮开始时工作树干净；先保存原源码及逐文件 SHA，再修改。未执行 commit 或 push，所有新成果仍在本地工作树。

| 身份 | SHA256 |
| --- | --- |
| 起点源码输入 | `591c827ccc1d67251e166b8116c58d141382464d1da3ad56ac9d14d9e5812ef9` |
| 最终构建源码输入 | `d068e0487be6e8c30fb8420841c57502c784e640781714973a40fe960d5c9623` |
| Rubric v1.7.0 原文 | `50990acd698ac5fada0f9d055864c982fdec3361fc9bd3542ba96dbd076532ff` |
| 现有 TypeScript scorer | `23044417392c02bba9792447e536f3b46451ae5931d94c130a832aea8b5a104e` |

起点见 [source-index](D:/dsh-research-agent/.acceptance/rubric-efficiency-20261103/checkpoint/source-index.json)，最终源码、保护哈希和检查计数见 [final-verification](D:/dsh-research-agent/.acceptance/rubric-efficiency-20261103/final-verification.json)。源码输入哈希的范围由既有 build-provenance 定义，包含插件源码、资源和构建配置；验收脚本、测试、文档另存于最终检查点清单，不混称为同一哈希范围。

2. **实际修改与实现边界**

新增 `innovation/source-coordinator.ts`、`paper-cache.ts`、`checkpoints.ts`、`file-checkpoints.ts`，分别负责来源准入、公开原文缓存、独立 Rubric 执行状态与显式目录文件仓库。`controller.ts` 使用独立 `rubric_execution`、`rubric_public_cache` 域，未混入 `research_review` 或修改 research v1 历史。

`pipeline.ts` 对每次模型、检索和原文读取保存输入、输出、哈希、耗时、失败、恢复位置及预算。`research-coordinator.ts` 让 Rubric 通过原生 `ctx.llm.stream` 单次请求执行，继承原生选择的 provider/model/reasoning/maxTokens，去掉父对话和工具循环；旧科研角色继续使用既有 Subagent。原生路由缺失时拒绝调用，未知模型版本仅允许当前 Host 身份内复用。已知版本仍依赖调用方提供可信绑定，不能把可变模型名称当成不可变版本。

界面增加显式恢复预算与确认，以及跨崩溃可能重复计费的提示。恢复只更新 Shadow 审计，不推进旧 DAG。所有三轮查新、独立计划审查、原文审查、Validity、Classifier、Overlap 和 Final synthesis 均保留，评分继续调用未修改的 TypeScript scorer。完整逐文件清单附于本文末尾。

3. **逐阶段耗时与失败根因**

首先重分析已有真实模型日志；这是历史数据，未消耗本轮生成授权。

| 历史运行/候选 | 总秒 | 模型请求至响应秒 | 未归因剩余秒 | 请求数 | 已报告 Token | 最后模型阶段/实际停止位置 |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| 首次 DoRA 复述 | 52.802 | 44.210 | 8.592 | 3 | 22,053 | search-plan-reviewer；查新未完成 |
| 首次随机平滑 | 65.409 | 56.672 | 8.737 | 3 | 32,638 | search-plan-reviewer；查新未完成 |
| 复测 DoRA 复述 | 90.023 | 90.005 | 0.018 | 2 | 20,060 | search-planner 中止 |
| 复测随机平滑 | 90.038 | 79.251 | 10.787 | 4 | 34,074 | source-selector 后取得原文时中止 |

历史 12 次请求合计报告 108,825 Token，其中输入 103,519、输出 5,306；中止请求用量可能缺失，不能视为完整账单。首批 HTTP 429 为 12 次、复测 6 次。历史只有响应事件，没有逐 fetch 起止、纯文件读取或 CPU 计时，因此不能把剩余 wall time 当作网络延迟。模型列也包含 provider 排队和模型传输，无法分离纯生成时间。逐次输入长度、响应、已报告 Token、重复 URL/正文哈希见 [历史阶段报告](D:/dsh-research-agent/.acceptance/rubric-efficiency-20261103/performance/historical.md)及同目录 JSON。

直接根因是模型等待占据大部分 90 秒预算、来源限流、冗长且难检索的论证词、同一原文重复取得/传入，以及中断后重新执行已完成阶段。最新源码还发现旧科研检索曾绕过 Rubric coordinator，并在 429 后 50ms 重试；现已共用同一来源协调器，429 不再立即重试。没有通过无限提高总时间处理问题。

最终官方 Desktop 的单个公开对照候选，使用 Mock 推理及真实公开 HTTPS，6 次调用后中断，真实关闭/重启，再补 11 次。两段 Rubric 预算内 wall time 合计 18.943 秒，不含关闭、重启及等待界面授权的间隔。模型阶段约 0.033 秒是 Mock 执行，不能比较为真实模型加速；检索阶段约 3.718 秒，5 个读取阶段约 0.043 秒。来源 action 3.708 秒、adapter transport 3.706 秒，均包含适配/归档开销，不是纯网络 wire latency；来源排队 0 毫秒。附件读取及 PDF 提取合计 186 毫秒，无法拆成纯磁盘读取。缓存 lookup 合计 35 毫秒。检查点读 118 毫秒、累计写入 wall time 14.753 秒，最后一次保存自身开销未纳入持久计数，且这些嵌套测量不能随意相加。

本地大 JSON 检查点多次写入已经成为 Mock 运行的主要开销，后续可研究内容寻址存储或增量写入；本轮优先保证完整证据和恢复正确性，未宣称已解决这一成本。原文缓存命中使本次不再解析公开原文，提取 CPU/墙钟统计为 0，仅说明此次没有再次提取。

最终 25 个模型/检索/读取步骤的逐项毫秒数、输入输出字符、重试/复用数及 Token 空值见 [本轮逐阶段报告](D:/dsh-research-agent/.acceptance/rubric-efficiency-20261103/performance/current-desktop.md)。

4. **模型请求、Prompt 与 Token 对照**

使用完全相同的归档公开 DoRA/WN 正文和明确 Mock 决策，对起点与最终 pipeline 做受控比较：

| 指标 | 起点 | 最终 | 相同输入再次恢复 |
| --- | ---: | ---: | ---: |
| 模型请求 | 17 | 17 | 0 |
| 检索调用 | 3 | 3 | 0 |
| 原文 read 调用 | 6 | 6 | 0 |
| 提示字符 | 928,502 | 785,260 | 0 新增 |

减少 143,242 字符，即 15.4272%。按正文 SHA 将相同全文在单个 Prompt 中共享，保留书目 aliases、段落/页定位、完整核心正文、公式、证明及反证引用；去掉重复的传输日志和链接清单。后续 planner/reviewer 使用已有结构化轮次证据，Validity 与 Classifier 仍获得完整必要材料。没有以摘要替换关键证明，也未删除独立审查。

上述结果是字符减少，不是实测 Token 或付费延迟减少；Mock 无 Token 报告时记 null。基准本地 wall time 和逐阶段字符对照保留于 [受控比较](D:/dsh-research-agent/.acceptance/rubric-efficiency-20261103/performance/controlled-comparison.json)，检查点增加的本地开销也如实保留。

真实 Desktop 最终 Mock 恢复运行累计 17 次提交、1,013,814 提示字符；执行记录另有 1 次在预算检查时被拒绝、未提交的阶段尝试，因此 checkpoint attempts 为 18。这次使用独立的 Mock 工程预算。其累计提示比本轮真实模型授权的 100 万上限多 13,814 字符；若真实运行生成相同规模的输入，必须在超限请求提交前中断，不得把这次 Mock 预算移用于真实调用。当前最长阶段为 Validity 242,163、Classifier 247,445 字符，真实模型在 60 秒内完成与否尚未实测。

5. **检索限流、查询与原文缓存效果**

协调器按来源共享，arXiv API/HTML/PDF 同组。默认 arXiv 间隔 3100ms、其他来源 1000ms、并发 1、自动重试 0；可设置有限重试，采用有界指数退避与抖动。429/503 冷却、可用的 Retry-After、连续失败熔断与恢复均有测试。DSH Web rc.5 不暴露响应头，所以该接口只能使用明确默认冷却；公开 PDF transport 能读取 Retry-After，未编造缺失的响应头。冷却状态在同一 Host 跨任务共享，进程重启后不持久化，这仍是限制。

旧检索压缩为最多 18 词/180 字符并优先发现的论文 ID，已知 arXiv ID 使用 `id_list`。Rubric 计划要求短标题、机制、别名、前轮实际来源及原文参考链接。本次三轮分别查询 DoRA 标题、Weight Normalization 标题、DoRA 初始化/预训练方向/LoRA 机制；每轮 5 条书目返回，共 15 条累计返回记录，不能称为 15 篇独立原文。实际读取 2 项工作，三轮保留不同目标与原文交叉核验。

最终恢复运行的 Rubric transport 3 次、HTTP200 3 次、429/超时/网络失败 0 次；全 DAG 原始网络 trace 为 9 次 HTTP200，另含旧 DAG 的请求，未混入 Rubric 计数。此前本轮开发期有实际 429，日志保留；一次无 429 的成功运行不证明以后不会限流，也不能将其变化全部归因于代码。受控测试另验证了共享冷却和 Retry-After 时序。

公开原文缓存保留规范 work ID、版本、请求/实际 URL、正文 SHA、原文件 SHA、比较日期、获取与核验时间、提取配置、身份验证结果，以及 HTML/PDF 原始 bytes。HTML/PDF 可共享书目身份，但内容记录独立，不算两个独立先例。TTL 默认 24 小时，过期、被改动或身份不符重新取得。历史比较拒绝未来版本及版本日期未知的当前正文。

本次 5 个实际 read 阶段命中持久缓存 5 次，另有已完成 read 阶段在重启后复用 1 次；cache miss 0、新下载正文 0、重复下载正文 0。缓存原文来自本轮同一隔离环境较早取得的公开资料，非本次新下载。统计以 read acquisition URL+SHA 对应原文，不将 ACL 检索页算作正文。单元测试证明并发请求同一已核验公开论文只 fetch/parse 一次，不同版本分别保留。

缓存中的来源绑定与标题正文匹配属于工程身份核验，不能代替完整书目考证或专家验证。搜索失败、429、冷却和熔断均保留错误/状态，不能当成“没有先例”；相应负例返回 insufficient/null。

6. **检查点、恢复与并发安全**

检查点记录 Assessment ID、Rubric 版本/SHA、target/candidate/papers 哈希、比较时点、模型身份、source revision、当前与下次阶段、三轮查询及证据、资料、每阶段 Prompt/raw/结构化输出、输出 SHA、用量、耗时、失败/取消原因和每次重新授权预算。恢复严格验证身份和输入；显式 ID 不匹配直接拒绝，非显式 ID 的新输入形成新 assessment。检索和读取有 TTL，模型阶段仅复用输入哈希、模型/源码版本与约束匹配的有效输出；语义证据核验失败使模型步骤失效，失败、取消、max-tokens 或迟到结果不能成为成功。

| 恢复/失败情形 | 本轮结果 |
| --- | --- |
| 完全相同输入再次执行 | Mock 17 个已完成模型阶段复用；新增模型/检索/read 均 0 |
| 模型超时后重新打开文件仓库 | 保留成功阶段，超时失败步骤重做，最终完成 Mock 流程 |
| 官方 Desktop 第 6 次后预算中断 | budget-exhausted/null；成功阶段和原文落盘 |
| Desktop 真正退出、重启、UI 授权预算 | 6 个模型阶段复用，仅补 11 次，resumeCount=1，旧 revision4/DAG 不变 |
| target/Rubric/model/source/candidate 改变 | 旧显式检查点拒绝复用；新 target 自动使用新 assessment |
| 同时恢复相同 assessment | 第二个 owner 拒绝，不重复提交阶段 |
| 取消后迟到模型输出 | 保持 cancelled，未提交成功输出 |
| 持久存储不可用 | 发外部请求前失败，模型调用 0 |
| 语义引用失败、429、预算耗尽 | 无错误成功缓存，评分保持 null |

Desktop 数据域沿用单 Host 写入租约和 controller 串行保护；同 profile 禁止多个 Host。独立文件仓库用独占 lock、PID/token、fsync 和 rename；残锁不自动抢占。正常关闭后释放。不能承诺跨崩溃 exactly-once：provider 已接收计费而成功结果尚未持久化时崩溃，恢复可能重复调用并重复收费；取消阻止本地提交也不保证外部模型立即停止计费。界面、存储与报告均披露这一窗口。

默认总预算仍为 90 秒，模型 60 次、网络 30 次、提示 200 万字符、阶段 60 秒、PDF 12 页、OCR 0 页，均有限。恢复表单逐次显式配置新预算并确认，不能自动续费。预算历史分开保存，避免把前次稀疏计数重复累加。Final synthesis 失败同样不给数值分；Shadow 失败不否决旧科研流程。

7. **Desktop 隔离安全**

本轮 root 为 `C:\Users\destiny\AppData\Local\Temp\rubric-efficiency-olb5uK`，owner `2b6a5fd4-4aa7-44b0-af91-f5d708cb87d3`。首次 CLI/EXE 前完成 DSH_HOME、profile、userData、workspace、research-data、attachments、evidence 及 `workspace-controller.documentsDirectory`；不复用上轮错误初始化顺序。

启动器核对 owner、配置封印、路径和环境；运行时守卫核对 workspace-controller 实际解析绝对路径及 Session cwd，并在附件写入、上传、确认、导出、计划及恢复前断言。路径遍历、同前缀相邻根、junction、缺失配置、所有权伪造、F 盘默认回退均 fail closed。6 项隔离回归测试通过，运行时 proof 和实际写入路径已保留于 [隔离证据](D:/dsh-research-agent/.acceptance/rubric-efficiency-20261103/desktop-completed/runtime-isolation.jsonl)。

14 个旧 Electron 验收入口统一走隔离 launcher；历史真实模型 runner 已显式关闭，不能重用旧硬编码授权。本轮上传/导出/计划文件均位于 owner 根，没有写入正式 F 盘 workspace；没有对正式数据做清理。官方 CLI 的离线加载复用此前临时 pnpm store；该依赖缓存并非科研 workspace，配置仅写入隔离 profile。CLI 重试过程中出现 store 路径不一致、移除参数不受支持，均修正后才采用通过结果，原始日志保留。

测试证据已复制回仓库 `.acceptance/rubric-efficiency-20261103/desktop-completed`，仅包含本轮公开/合成材料及执行记录，未删除隔离证据或历史数据。插件最后仅从隔离 profile 移除；其普通聊天通过，正常关闭后测试进程树与监听端口均空。

8. **Build、类型、Lint 与 Vitest 实际结果**

| 检查 | 本轮最终结果 | 证据 |
| --- | --- | --- |
| frozen lockfile 离线安装，ignore-scripts | 通过 | `install-frozen.log` |
| 两次实际构建 | 通过；45 项产物 SHA256 一致 | `reproducible-completed/result.json` |
| 构建新鲜度/源码身份 | 通过；最终源码 d068e048… | `final-verification.json` |
| 常规 Host + Client Typecheck | 通过 | `typecheck-completed.log` |
| 严格 Client，skipLibCheck=false | 通过 | `typecheck-sdk-client-completed.log` |
| 严格 Host，skipLibCheck=false | 失败；3 条官方 SDK 声明错误 | `typecheck-sdk-host-completed.log` |
| Lint | 通过，42 个源码文件，0 诊断 | `lint-completed.log` |
| Vitest 全量 | 26 文件、291 通过、0 失败 | `vitest-completed.json` |

严格 Host 错误位于官方 `@deepseek-ai/dsh-session-projection/lib/types/index.d.ts` 150–151 行，TS2536/TS2344 的 SessionProjection 泛型映射问题；未改 SDK、伪造类型或放宽严格检查。因此不能称所有严格类型检查通过。

新增回归涵盖缓存去重/内容版本/历史时点、429 冷却/熔断/恢复、旧 DAG 与 Rubric 共享限流、超时落盘/重启/相同输入、版本失效、并发恢复、取消迟到、预算 null、有效证据保留、原生单次模型路由及隔离顺序。开发中一次旧断言仍预期 429 立即重试，得到 290/291；将预期改为新行为的两次请求后全量 291/291。此前开发期故障日志也保留，不把最终通过说成开发过程没有失败。

9. **最新官方 Desktop 实际运行**

在最终源码检查后重新读取官方 Nightly 更新源，核验时间 `2026-11-03T13:11:29.827Z`，版本仍为 `0.2.1-rc.5`，发布时间 `2026-10-29T14:04:01.198Z`。官方 feed SHA512 与已验签官方安装程序一致，Authenticode Valid，发布者 Hangzhou DeepSeek Artificial Intelligence Co., Ltd.；实际启动 Electron `44.7.0`、Node `24.21.0`。

测试 EXE SHA256 `7ae939b5a82b220fbd8ad04dfbafaaedb5a49ab43dc884a5db6381f678dd0cc4`；ASAR `e1b6f25fa937da98086c3e77af77aa14791105963c4d337a1c42179d232c6915`。最终重验同正式 F 盘文件哈希一致。未运行安装器覆盖正式应用，未修改 EXE/ASAR、正式 profile 或生成正式安装包。

| 官方 Electron 验收 | 最终结果 |
| --- | --- |
| Rubric 阶段中断/真实关闭重启/UI 恢复 | 通过，6+11 次 Mock，三轮 complete，旧 DAG 不变 |
| 完整科研流程 | 通过，19 页公开 DoRA PDF、目标确认、旧拒绝/通过审计、三轮、计划导出、reload/重启 revision10 |
| 文件同步故障与多角色恢复 | 通过，真实外部句柄故障可见，显式 resync 不增 revision/模型调用；重启仅补 1 个失败角色 |
| Shadow 风险 | 通过，3 次旧拒绝保留；按钮取消 null；20ms 预算 null，旧通过继续 |
| 历史 research v1 | 通过，合成旧 83/100、threshold70、revision6 保留，无静默重算 |
| 官方 CLI 移除隔离插件 | 通过，科研入口消失、普通原生聊天与预设可用、正常退出、无测试进程/监听残留 |

逐套结果、实际运行身份、截图、网络原始响应、路由 trace、输入输出及 build manifest 见 [最终 Desktop 归档](D:/dsh-research-agent/.acceptance/rubric-efficiency-20261103/desktop-completed)。这些工程验收的推理是明确 Mock，包含一个旧检索 Semantic Scholar 的合成适配返回；Rubric 引用的原文和记录的公开 HTTPS 是真实获取。自动化勾选和确认验证交互机制，不代表人类专家认可科研内容。没有把 Mock S=0 作为公开论文的科学评分。

10. **本轮授权真实模型的实际结果**

用户仅授权一个公开候选、实验室 gpt-6-sol，最多 24 次生成请求/100 万提示字符/每次输出 4096 Token/总 5 分钟/阶段 60 秒/人民币20元/OCR0/provider重试0，且执行前必须核实实际版本和价格。这是条件授权，未沿用上轮试运行额度。

Mock 和最终官方 Desktop 验收完成后，仅读取当前选定路由及其 `/models`：Provider `a`、displayName“实验室”、API `openai-responses`，配置与 HTTP200 模型目录均确认 ID `gpt-6-sol`。配置与目录均无可核验版本/revision、价格或计费表。目录的 owned_by 字符串不能证明不可变模型版本，也不能用同名产品公开报价代替私有路由的实际计费。预检第一次因自动权限审批超时未执行，允许的一次重试已成功；这不是模型重试。

| 本轮真实模型指标 | 实际值 |
| --- | --- |
| 只读模型目录请求 | 1，HTTP200 |
| 生成调用，包括失败重试/恢复 | 0 |
| 生成输入/输出 Token | 0 / 0 |
| 生成费用估算 | 0 元对应零生成；非网关账单认证 |
| 真实候选执行/阶段耗时 | 未开始，无可测阶段延迟 |
| 真实评估检索/429/恢复 | 0 / 0 / 0 |
| 真实科学评估状态 | 未执行：blocked-before-generation；无数值分，S=null |

按用户“无法核实价格或可靠控费时不得开始”的要求停止，没有自动切换路由、没有修改正式 Provider 重试策略、没有追加测试或预算。原配置重试为 SDK 默认值，但从未用于本轮生成。不能宣称一次真实模型评估已完成，也没有使用 Mock 结果替代真实结果。[脱敏预检证据](D:/dsh-research-agent/.acceptance/rubric-efficiency-20261103/real-model-preflight.json)只记录必要元数据，不包含凭据；私有网关地址未送往公开搜索。

11. **未解决的工程与 Rubric 科学问题**

真实模型 60 秒阶段与 5 分钟全流程的可完成性、实际 Token/费用、版本绑定和真实取消计费均未验证。完整 Prompt 对长文仍较大，单候选也可能超过 100 万字符；不能为通过验收删掉必要证据。检查点写入成本、跨进程冷却持久化、崩溃残锁、跨 domain 非原子事务仍有限制。原 D 盘 ReplaceFileW1175 外部原因未定位；句柄注入验证的可恢复失败不能称为解决1175。严格 Host SDK 三错仍存在。

科学方面，原有十案例仍没有本轮真实模型完整评价。Biggio2013 等关键原文、LoRA/RAG/Attention 更早或异名先例、随机平滑严格理论增量、历史版本日期与 PDF 公式提取质量仍需核实。最小不可约贡献、源模块必要复杂性、贡献独立性、A/B/C/D/E/P 边界、C8/P4/E8及以上门槛和置信度的科学可靠性未因工程测试而成立。三轮完成和逐字引文检查是必要条件，不保证召回充分、引文解释正确或分类有效。多模型角色不等于独立领域专家。

12. **独立专家校准条件与本轮停止点**

已具备开展受限专家盲审试点的工程基础：明确目标/时点/版本、可追溯原文、可恢复审计、结构化分歧工具及既有公开盲审材料。可以进入材料补全、专家招募和独立提交的准备阶段。

完整科学校准条件尚未齐备：真实专家实际参与数量仍为 0，关键原文与版本缺口未全补齐，真实模型整例未完成，跨领域分类与决策规则尚无留出验证。权威切换仍须按既有 AUTHORITY_SWITCH 要求取得每个目标领域适当背景且独立的真实专家审查、分歧协调、外部身份核验与保留样本验证。当前没有科学证据允许替代旧评分。

本轮到此停止。保留 Shadow、旧评分历史、Rubric 原文和评分数学；未推送 GitHub、未启用 authoritative、未扩展真实模型授权，也未联系专家。

**实际修改文件清单与最终证据**

以下清单由本轮最终 Git 工作树生成；包含新增文件。构建生成目录和 `.acceptance` 证据不作为 Git 源码文件列入；其哈希另存于最终本地检查点。

- [docs/DESKTOP_VALIDATION.md](D:/dsh-research-agent/docs/DESKTOP_VALIDATION.md)
- [docs/RUBRIC_EFFICIENCY_VALIDATION_2026-11-03.md](D:/dsh-research-agent/docs/RUBRIC_EFFICIENCY_VALIDATION_2026-11-03.md)
- [packages/research-agent/src/client/ShadowAuditView.tsx](D:/dsh-research-agent/packages/research-agent/src/client/ShadowAuditView.tsx)
- [packages/research-agent/src/controller.ts](D:/dsh-research-agent/packages/research-agent/src/controller.ts)
- [packages/research-agent/src/innovation/checkpoints.ts](D:/dsh-research-agent/packages/research-agent/src/innovation/checkpoints.ts)
- [packages/research-agent/src/innovation/file-checkpoints.ts](D:/dsh-research-agent/packages/research-agent/src/innovation/file-checkpoints.ts)
- [packages/research-agent/src/innovation/network.ts](D:/dsh-research-agent/packages/research-agent/src/innovation/network.ts)
- [packages/research-agent/src/innovation/paper-cache.ts](D:/dsh-research-agent/packages/research-agent/src/innovation/paper-cache.ts)
- [packages/research-agent/src/innovation/pipeline.ts](D:/dsh-research-agent/packages/research-agent/src/innovation/pipeline.ts)
- [packages/research-agent/src/innovation/public-pdf.ts](D:/dsh-research-agent/packages/research-agent/src/innovation/public-pdf.ts)
- [packages/research-agent/src/innovation/resource.ts](D:/dsh-research-agent/packages/research-agent/src/innovation/resource.ts)
- [packages/research-agent/src/innovation/shadow.ts](D:/dsh-research-agent/packages/research-agent/src/innovation/shadow.ts)
- [packages/research-agent/src/innovation/source-coordinator.ts](D:/dsh-research-agent/packages/research-agent/src/innovation/source-coordinator.ts)
- [packages/research-agent/src/types.ts](D:/dsh-research-agent/packages/research-agent/src/types.ts)
- [packages/research-agent/src/workflows/research-coordinator.ts](D:/dsh-research-agent/packages/research-agent/src/workflows/research-coordinator.ts)
- [scripts/benchmark-rubric-resume.mjs](D:/dsh-research-agent/scripts/benchmark-rubric-resume.mjs)
- [scripts/preflight-authorized-rubric-model.mjs](D:/dsh-research-agent/scripts/preflight-authorized-rubric-model.mjs)
- [scripts/rubric-performance-report.mjs](D:/dsh-research-agent/scripts/rubric-performance-report.mjs)
- [scripts/summarize-rubric-efficiency.mjs](D:/dsh-research-agent/scripts/summarize-rubric-efficiency.mjs)
- [tests/acceptance/README.md](D:/dsh-research-agent/tests/acceptance/README.md)
- [tests/acceptance/desktop-bootstrap.mjs](D:/dsh-research-agent/tests/acceptance/desktop-bootstrap.mjs)
- [tests/acceptance/desktop-disabled-smoke.mjs](D:/dsh-research-agent/tests/acceptance/desktop-disabled-smoke.mjs)
- [tests/acceptance/desktop-isolation.mjs](D:/dsh-research-agent/tests/acceptance/desktop-isolation.mjs)
- [tests/acceptance/desktop-native-smoke.mjs](D:/dsh-research-agent/tests/acceptance/desktop-native-smoke.mjs)
- [tests/acceptance/desktop-regression.mjs](D:/dsh-research-agent/tests/acceptance/desktop-regression.mjs)
- [tests/acceptance/electron-candidate.mjs](D:/dsh-research-agent/tests/acceptance/electron-candidate.mjs)
- [tests/acceptance/electron-flow.mjs](D:/dsh-research-agent/tests/acceptance/electron-flow.mjs)
- [tests/acceptance/electron-ui-rc5-screenshots.mjs](D:/dsh-research-agent/tests/acceptance/electron-ui-rc5-screenshots.mjs)
- [tests/acceptance/electron-ui-rc5.mjs](D:/dsh-research-agent/tests/acceptance/electron-ui-rc5.mjs)
- [tests/acceptance/prepare-rubric-efficiency.mjs](D:/dsh-research-agent/tests/acceptance/prepare-rubric-efficiency.mjs)
- [tests/acceptance/rubric-desktop.mjs](D:/dsh-research-agent/tests/acceptance/rubric-desktop.mjs)
- [tests/acceptance/rubric-evidence-desktop.mjs](D:/dsh-research-agent/tests/acceptance/rubric-evidence-desktop.mjs)
- [tests/acceptance/rubric-evidence-legacy-desktop.mjs](D:/dsh-research-agent/tests/acceptance/rubric-evidence-legacy-desktop.mjs)
- [tests/acceptance/rubric-legacy-desktop.mjs](D:/dsh-research-agent/tests/acceptance/rubric-legacy-desktop.mjs)
- [tests/acceptance/rubric-real-desktop.mjs](D:/dsh-research-agent/tests/acceptance/rubric-real-desktop.mjs)
- [tests/acceptance/rubric-shadow-risk-desktop.mjs](D:/dsh-research-agent/tests/acceptance/rubric-shadow-risk-desktop.mjs)
- [tests/acceptance/rubric-stage-resume-desktop.mjs](D:/dsh-research-agent/tests/acceptance/rubric-stage-resume-desktop.mjs)
- [tests/acceptance/ui-desktop.mjs](D:/dsh-research-agent/tests/acceptance/ui-desktop.mjs)
- [tests/desktop-isolation.spec.ts](D:/dsh-research-agent/tests/desktop-isolation.spec.ts)
- [tests/research-coordinator.spec.ts](D:/dsh-research-agent/tests/research-coordinator.spec.ts)
- [tests/rubric-direct-model.spec.ts](D:/dsh-research-agent/tests/rubric-direct-model.spec.ts)
- [tests/rubric-resume.spec.ts](D:/dsh-research-agent/tests/rubric-resume.spec.ts)
- [tests/rubric-source-efficiency.spec.ts](D:/dsh-research-agent/tests/rubric-source-efficiency.spec.ts)
- [tests/support/desktop-isolation-guard.mjs](D:/dsh-research-agent/tests/support/desktop-isolation-guard.mjs)

[最终本地检查点](D:/dsh-research-agent/.acceptance/rubric-efficiency-20261103/final/summary.json)包含最终源码副本、逐文件 SHA、Git diff/status、构建清单和证据索引。

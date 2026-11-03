# Rubric v1.7.0 验证模式集成与可靠性报告（2026-11-02）

本轮已完成插件实现、188 项自动化测试，以及当时官方最新 Nightly DSH Desktop 中的隔离运行。Rubric 保持 Shadow Mode，旧创新评估的 0–100 分、门槛 70 和 DAG 通过逻辑继续生效。

仍保留两项明确问题：D 盘 ReplaceFileW 1175 的外部触发根因未定位；严格 Host SDK 检查仍有 3 条官方泛型声明错误。本轮不宣布这两项已修复，也不建议立即将 Rubric 切换为权威门槛。

## 1. 基线、源码与官方版本

| 项目 | 核验结果 |
| --- | --- |
| 项目 | `D:\dsh-research-agent` |
| 分支 / HEAD | `main` / `f8f3ddfe0b4677815905760ee44e90a2c56c7c86` |
| 插件版本 | `0.1.5-rc.5` |
| 原基线源码 SHA256 | `fa8d0625c23ca8ff9ad8632ef5e046acd8a50b22e05cb188582662229797e287` |
| 最终构建源码 SHA256 | `6d993e81c70f67f238182cbb4517c6b98aae83a495c1f884195df447f513b8d6` |
| 构建时间 | `2026-11-02T12:30:41.694Z` |
| 开发 Node / pnpm | `22.20.0` / `11.7.0` |
| 官方 Desktop / Runtime / DSH SDK | `0.2.1-rc.5` |
| 实际 Electron / 内置 Node | `44.7.0` / `24.21.0` |
| 通道 | 沿用原有 Nightly |

开始时于 `2026-11-02T10:39:13Z` 重新读取官方更新源；最终于 `2026-11-02T12:44:47Z`（北京时间 20:44）再次读取，均为 `0.2.1-rc.5`。更新源记录 releaseDate 为 `2026-10-29T14:04:01.198Z`，GitHub rc.5 发布于 2026-10-30。GitHub 另有 alpha.2，未据版本号跨通道替换目标。

来源：

- [官方 Nightly win-x64 更新源](https://download.deepseek.com/dsh-desk/feeds/win-x64/nightly.yml)
- [官方 rc.5 Release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-rc.5)

本轮复用了上一轮已按官方更新源 SHA512 校验的解压测试副本，并重新检查签名、实际进程版本和 EXE/ASAR 哈希。签名状态为 Valid，发布者为 Hangzhou DeepSeek Artificial Intelligence Co., Ltd.；没有执行安装器。原安装包校验记录见上一轮 `installer-identity.json`。签名二进制与 GitHub tag 的精确源码 commit 对应关系仍沿用原报告的未完全核实限制。

开始前已阅读现有基线、Desktop 验收规范、开发说明、diff 和 manifest，并在以下目录保存 186 个已选源码文件、逐项哈希、原 diff、manifest 及先前证据：

`D:\dsh-research-agent\.acceptance\rubric170-20261102\checkpoint`

原工作树已有的 SDK/构建修复和无关未跟踪缓存均保留。本报告的修改清单只列本任务实际改动，不能把相对 Git HEAD 的全部 diff 归为本任务。

## 2. ReplaceFileW EIO 调查与恢复

详细调查见 [EIO_INVESTIGATION_2026-11-02.md](D:/dsh-research-agent/docs/EIO_INVESTIGATION_2026-11-02.md)。调查先于新增科研功能进行。

通过官方 EXE 的 Node 运行方式，直接调用其未修改 ASAR 内的 `dsh-fs-local`。合成文件不涉及插件协调器或正式科研目录。870 次写入结果：

| 隔离位置 | 串行 150 次 | 同目标并发 80 次 | Node 读句柄 60 次 |
| --- | --- | --- | --- |
| D 盘普通路径 | 4 次 1175 | 1 次 1175 | 3 次 1175 |
| C 盘 Temp | 0 次失败 | 0 次失败 | 0 次失败 |
| D 盘中文长路径 | 0 次失败 | 0 次失败 | 0 次失败 |

官方适配器在目标同级建立私有临时目录，复制 DACL，写入、sync 并 await close 后调用 ReplaceFileW；同目标写入由官方锁串行化。因此，这个实现不存在已查明的跨卷临时文件或遗漏关闭临时写句柄问题。1175 已在无插件、无主动读句柄的串行场景出现。

微软将 1175 定义为 `ERROR_UNABLE_TO_REMOVE_REPLACED`，含义为无法移除被替换的文件。故意持有不共享删除的 Win32 读句柄得到的是 32（共享冲突），不能把它当作已重现 1175 的同一根因。共享删除或释放句柄后写入成功。

C/D 均为本地 NTFS、空间充足；保存了卷信息和 D 盘合成文件 ACL。Defender 查询为未运行、实时防护关闭，WSearch 运行。没有关闭安全设施、索引器或其他应用句柄。缺少瞬时内核 handle/filter 跟踪，不能归责于某个进程、Defender、索引器或官方库自身缺陷。

**已建立插件边界：官方适配器/Win32 路径可以独立失败，插件无法保证消除其触发条件。** 本轮增加 `resyncProject` 和“重新同步科研文件”按钮，显式导出当前权威状态：串行执行、核对 expectedRevision、不更新 domain row、不递增 revision、不调用模型，失败继续显示。论文引用持久化后，首次侧车导出失败也能重建附件清单。没有增加自动重试掩盖错误。

最终真实 Desktop 中，合成侧车被外部句柄占用时，同步显示原生替换错误；释放句柄后连续两次同步成功，revision 均为 4，模型调用数未变。此为恢复行为实测，故障注入返回 32，不代表 1175 根因已解决。

## 3. 旧创新评估审计与 Shadow Mode

原流程生成候选后执行候选专属查重检索，再调用 innovation-reviewer，输出 `score / overlap / rationale`。score 是 0–100 整数，默认门槛 70、最多 3 次候选尝试。没有检索证据、分数不达标或 overlap=true 时拒绝，耗尽尝试后报错。历史 evaluation 保存在 research v1 artifact 中。

本轮保留上述路径。在旧候选通过后，单独执行 Rubric pipeline，附加可选 `rubricAssessment`，并记录旧分数、门槛、pass 和分歧说明。Rubric 的 0 或 null 均不改写旧 evaluation，不改变通过/否决和重试结果。**没有把 70 转换为 7.0。** 当前对照集合限于旧流程通过的候选，尚未形成旧拒绝候选的完整双评分样本。

UI 使用“Rubric v1.7.0 创新评估（验证模式）”，同时展示旧评分与 Rubric 状态/总分。最近先例、原文 URL、位置和引用、三轮查询、支持/反例/排除理由、判断变化、计算字段和完整 JSON 均可展开查看。

## 4. 完整规则资源、target_task 和数据结构

原文件逐字节复制至：

[packages/research-agent/resources/rubrics/innovation/rubric_v1.7.0.md](D:/dsh-research-agent/packages/research-agent/resources/rubrics/innovation/rubric_v1.7.0.md)

原件与项目副本 SHA256 完全相同：

`50990acd698ac5fada0f9d055864c982fdec3361fc9bd3542ba96dbd076532ff`

`resource.ts` 加载完整 Markdown 并校验 SHA256；包的 files 包含 resources。完整文档交给有效性和分类阶段，确定性分值表实现其数学规则。research 状态只记录版本/哈希和评估结果，没有每次重复保存整份 Rubric，也未修改用户原件或历史版本。

Target-task extractor 根据已确认摘要、Research Problem、方向及分支记忆生成草稿。用户可编辑研究领域、问题、输入、输出、约束、适用条件、子任务边界及比较日期；勾选确认后才进入创新评估。Host 核对当前上下文摘要并记录 confirmedAt；确认对象沿分支继承，评估阶段不能缩窄或改写。上下文不一致需重新提取，关键字段仍未知则返回 insufficient/null。

assessment 包含 rubricVersion、rubricSha256、targetTask、assessmentStatus、comparisonScope、searchAudit、mainline、noveltyUnit、contributions、sourceModuleAssessment、problemComparison、boundaryChecks、validityCheck、score、confidence、uncertainties，以及 facts、事实等价分组、阶段记录和总结。

状态明确区分 complete、provisional 和 insufficient。insufficient 必须 S=null；完成核验且没有有效新增可以 complete/S=0。非决定性争议可 provisional/数值分。运行时和持久化 schema 会拒绝状态/分数矛盾、非法步长及缺少三轮原文获取证据的数值结果。

新增 artifact 的 rubricAssessment、paperRefs 和 memory 的 targetTask 均为可选；research v1 版本号不变，旧记录不要求补齐这些字段，也不自动重算历史分数。

## 5. 分阶段查新与 fail closed

实际执行顺序：

1. Target-task extractor 和用户确认。
2. Contribution extractor：确认核心原文和不可约贡献单元。
3. 每项贡献执行三轮；每轮分别调用 search planner、独立 search-plan reviewer、实际检索、source selector 和原文 reviewer。
4. Round 1 建立近邻/同义/等价问题基线；Round 2 主动查找同构异名、早期先例及理论反证；Round 3 根据前轮发现补搜，并交叉核对方法、公式、信息流、证明或定义。
5. Validity reviewer → Rubric classifier → 独立 overlap reviewer → 确定性 score calculator → final synthesis。

每阶段有单独 JSON schema 和输出哈希。后续计划必须引用前轮实际取得的原文发现；完全重复的查询会被程序拒绝，实质差异另由计划审查阶段判断。每项贡献，包括拟作为次要项的贡献，都需要三轮证据。

网络适配器通过官方 `ctx.web.fetch` 获取 OpenAlex 索引，必要时回退 arXiv 索引，再实际取得原文正文。记录 URL、时间、HTTP 状态、正文 SHA256、是否截断及 transport。逐字引用必须在已取得的原文中找到；不得选择检索候选之外的来源，追引文 URL 也必须有前轮原文依据。摘要/索引页不能充当方法正文，未知或晚于比较时点的先例不支持回溯结论。

无网络、查询失败、少于三轮、核心论文缺失、关键先例原文缺失、引用编造、关键有效性/分类未知，均保留已有审计并返回 insufficient/S=null。不能用模型记忆补齐，fixture transport 不能支持数值评分。网络原文读取目前支持可识别的完整 HTML；付费墙、纯 PDF、正文过长或 provider 截断会保守返回 null，需要后续扩展获取能力。

这些约束能检查来源取得、引用存在性和计算条件；类别、反例充分性及语义独立性仍需要模型/专家理解，不能由字符串核验保证科学判断正确。

## 6. 确定性计算器

A/B/C/D/E/P 共 35 个子类的基础分和上限按原文实现；所有数值为 0.5 步长。计算并保存 L/H、S0、R、R_included、Delta_R、U0、U_class、U_i、S_i、U_main、S_main、j_i、J、M 和 S。

- B/C：Delta_R=R−R_included；U_i=min(U_class,U0+Delta_R)；S_i=min(U_i,S0+Delta_R)。R 仅可为 0/1/1.5/2，R_included 仅为 0 或 R。
- A/D/E/P：R=0，按固定基准和 U0 计算。P4 基准是 6.5，不能把 U0=7.5 当作基础分。
- 选择最高合格 S_i 为主导；并列先按 U_i，再按稳定贡献 ID，记录依据。
- 用事实 ID、语义等价分组和相同原文引用归并重复事实，拒绝 R 与定类/高端 S0 复用；与主导或已计次要项重叠者不能领取 J。
- 独立次要项：0<S_i≤2 时 j_i=0.5，S_i≥2.5 时为 1；J=min(1,Σj_i)。主线失败 M=4，否则 M=10。
- 最终严格使用 **S=min(10,M,S_main+J)**，不再以 U_main 截断独立次要奖励。

73 项数学测试包含全部子类、原文第 7 节示例、C8 高端、P4、R 去重、别名重复、主导切换、J、M 和总分封顶。

## 7. 实际验证结果

| 检查 | 本轮结果 | 证据 |
| --- | --- | --- |
| 冻结锁文件、禁安装脚本、离线依赖安装 | 通过 | 已执行命令退出 0；最终 manifest 的精确 SDK |
| Build | 通过 | 最终 manifest，源码 SHA256 见第 1 节 |
| 常规 Host/Client Typecheck | 通过 | 本轮最终检查命令退出 0 |
| Lint | 通过 | 最终命令退出 0；lint-schema.json 无 diagnostics |
| 完整 Vitest | 18 文件、188/188 通过 | vitest-final.json |
| 严格 Client，skipLibCheck=false | 通过，退出 0 | strict-client.log |
| 严格 Host，skipLibCheck=false | **失败，退出 2，官方原有 3 条错误** | strict-host.log |
| 官方 Desktop 原生科研与公开三轮联网 | 通过 | desktop/rubric-e2e/result.json |
| 实际断网/null、同步失败恢复 | 通过 | offline-assessment.json、workflow.log |
| 页面刷新和真实退出/重启恢复 | 通过，revision 10 | tested-session.json、重启截图 |
| 旧 research v1 | 通过，83/100 不重算 | desktop/legacy-v1/result.json |
| 官方 CLI 移除插件后原生普通聊天 | 通过 | plugin-remove.log、desktop/plugin-disabled-final |
| 测试进程树/监听端口清理 | 通过，均为空 | processes-after-close.json |

新增 90 项测试：数学 73、pipeline 12、兼容 3、重同步 2；原基线 98 项也在同一次完整运行中通过。pipeline 单测网络明确为 mock，不计作真实联网证据。

严格 Host 的原始错误仍位于官方 `@deepseek-ai/dsh-session-projection/lib/types/index.d.ts` 第 150–151 行：TS2536 一条、TS2344 两条，SessionProjectionMap 的 subagent 键与 SessionProjectionStateMap 不匹配。当前 Nightly/SDK 仍为 rc.5，未发现本轮目标已提供修复。没有改 node_modules、伪造 augmentation、使用 any 掩盖或关闭规则。常规类型检查通过不等于严格 Host 检查通过。

本轮重新运行了 Rubric 相关原生全流程、A→B 模型选择、上传、人工确认、导出与恢复。PDF/OCR 和双分支计划的专门 Desktop 场景没有在本任务再次执行；它们的上一轮实测证据已纳入检查点，不列作本轮重新通过项。

## 8. 公开论文真实联网对照

材料为公开 DoRA 论文 `arXiv:2402.09353v2` 的完整公开正文，实际 HTTPS 获取后以 TXT 上传，未使用私人论文。

**被评对象是“在 2026-11-02 复用已经公开的 DoRA 幅度/方向分解及低秩方向更新”的重复候选。结果不是对原始 DoRA 论文原创性的历史评分。** 本地 reasoning fixture 明确标注这一范围，旧流程结果也是测试夹具。

最终 Session：`session-e43dd145-ef01-4b0b-a3bb-ea8bdb02bb8e`。

| 轮次 | 实际查询 | 目的 |
| --- | --- | --- |
| 1 | DoRA Weight-Decomposed Low-Rank Adaptation | 确立最近公开原文 |
| 2 | DoRA weight normalization magnitude direction low rank | 反证幅度/方向拆分及同构关系的新颖性 |
| 3 | DoRA initialization pretrained weight directional component LoRA | 根据前轮差异核对初始化、冻结状态和低秩更新关系 |

实际发生 3 次 OpenAlex 查询和 3 次 arXiv 原文 HTTPS 读取，全部 HTTP 200；响应体、哈希和时序保存在 network.jsonl 与 network-bodies。三轮交叉核验同一最近原文的不同方法段落；不是三篇不同论文，也不是三次相同关键词查询。

在线结果：complete、S=0、J=0、M=10，候选贡献确认为 duplicate；旧评估 88/100、threshold 70、pass=true，DAG 正常继续。无网络场景实际阻断 OpenAlex/arXiv 请求，得到 insufficient/S=null，审计保留失败原因；旧流程仍正常推进。随后完成评审、计划预览、确认写入、刷新和真正退出重启。

**推理部分使用获准的本地 Mock 模型；Rubric 文献获取是真实联网。** 因而本轮验证了官方 Desktop、分阶段接口、真实文献来源/引用、fail closed、计算和持久化链路；没有验证收费模型质量或跨领域科学评分一致性。旧 Semantic Scholar 流程的网络由明确标记的 legacy-fixture 支撑，不纳入上述 6 次真实 HTTPS 统计。

旧 v1 兼容测试另起原生 Session；应用关闭后，仅在本轮隔离 JSON 中植入纯合成旧 v1 行，删除新可选字段，保留 83/100 与 revision 6。再次启动后原生 UI 可打开，无 Rubric 字段要求、无评分重算、无模型调用。该兼容夹具与完全通过 UI 推进的公开论文主流程分别保存。

## 9. 隔离、原生 UI 和正式安装核对

官方测试 EXE：

`D:\dsh-research-agent\.acceptance\desktop-baseline-20261102\installer-unpacked\DeepSeek Harness.exe`

本轮专用根目录：

`C:\Users\destiny\AppData\Local\Temp\dsh-rubric170-20261102-IH85ls`

其 home、profile、Electron userData、workspace、research-data 和 attachments 分别隔离，workspace-controller 显式指定专用目录；没有复制正式 Session、科研数据或凭据。插件通过官方内置 CLI 链接到当前源码包，实际执行的 Host/UI 和 sourceSha256 均已核对。CLI 有链接包 peer 提示，但本轮实际加载和完整流程通过；未把提示当成科学验证结果。

最终主流程启动 PID 51160，重启 PID 47668；旧记录检查 PID 51396/44872；禁用检查 PID 6184。均使用官方 EXE 和 ASAR，未修改内核或替换成独立 Web Host。保存了普通/窄窗口、审计展开、目标确认、同步错误、重启和旧记录截图。原 offline-null.png 的视口没有落在评分标题处；null 的直接证据为该真实 UI 导出的完整 JSON 及测试断言，不能仅凭该截图声称标题可见。

最终哈希与原基线相同：

| 文件 | SHA256 |
| --- | --- |
| 测试 EXE | `7ae939b5a82b220fbd8ad04dfbafaaedb5a49ab43dc884a5db6381f678dd0cc4` |
| 测试 ASAR | `e1b6f25fa937da98086c3e77af77aa14791105963c4d337a1c42179d232c6915` |
| 正式 F:\deepseek EXE | `fd7d298f4ba03ee9bab1719a892afeaef5c09bf50c574a592a64c85f64574c0c` |
| 正式 F:\deepseek ASAR | `04b32e3a872826ba15cfb2081c6a929a8d4ecaa65e09a2543e5a6b30e2eff1f0` |

正式主进程 PID 28428 仍在运行。测试进程只按独立路径和已知实例管理，未按进程名终止正式应用。最终隔离 profile 已通过官方 CLI 移除科研依赖和 Bundle 注册；残留本地 junction 不作为仍启用的依据，实际普通聊天和预设菜单已验证。

## 10. 本任务修改文件

以下路径均相对于 `D:\dsh-research-agent`：

| 文件 | 作用 |
| --- | --- |
| packages/research-agent/package.json | 打包包含版本化 resources |
| packages/research-agent/resources/rubrics/innovation/rubric_v1.7.0.md | 完整原文副本 |
| packages/research-agent/src/innovation/resource.ts | 版本、哈希及完整规则读取 |
| packages/research-agent/src/innovation/schema.ts | target_task、证据、审计、评估、分数运行时结构 |
| packages/research-agent/src/innovation/network.ts | 官方 Web seam 的实际索引和原文获取 |
| packages/research-agent/src/innovation/pipeline.ts | 分阶段三轮查新、引用检查和 fail closed |
| packages/research-agent/src/innovation/scorer.ts | 35 子类与确定性公式、去重、封顶 |
| packages/research-agent/src/types.ts | 可选持久字段及 Remote 类型 |
| packages/research-agent/src/controller.ts | 草稿、确认、兼容 schema、幂等重同步 |
| packages/research-agent/src/workflows/research.ts | 可选 assessment/task/paperRefs 沿状态传递 |
| packages/research-agent/src/workflows/research-coordinator.ts | 保留旧门槛并挂接 Shadow pipeline |
| packages/research-agent/src/client/ResearchPanel.tsx | 目标确认和同步操作 |
| packages/research-agent/src/client/ResearchTranscriptMain.tsx | 显示验证模式结果 |
| packages/research-agent/src/client/TargetTaskEditor.tsx | 可编辑任务和显式确认 |
| packages/research-agent/src/client/RubricAssessmentView.tsx | 状态、分数、三轮证据与计算审计 |
| packages/research-agent/src/client/Rubric.module.css | 编辑器和审计卡片样式 |
| tests/projection-resync.spec.ts | 同步失败、同 revision 恢复和 stale 拒绝 |
| tests/rubric-scorer.spec.ts | 73 项数学/边界测试 |
| tests/rubric-pipeline.spec.ts | 12 项来源/状态测试 |
| tests/rubric-compatibility.spec.ts | 3 项旧 v1 与新 schema 测试 |
| tests/support/rubric-fixture.mjs | 明确标记的本地推理夹具 |
| tests/support/rubric-desktop.mjs | 验收专用模型/Web provider，保存真实 HTTPS |
| tests/acceptance/rubric-desktop.mjs | 官方 Desktop 原生主流程验收 |
| tests/acceptance/rubric-legacy-desktop.mjs | 合成旧 v1 的原生读取验收 |
| tests/acceptance/hold-sidecar.cjs | 仅合成 workspace 的受控句柄占用 |
| docs/EIO_INVESTIGATION_2026-11-02.md | EIO 调查结论和边界 |
| docs/RUBRIC_1_7_0_INTEGRATION_2026-11-02.md | 本报告 |

## 11. 证据交付与下一轮建议

本轮证据根目录：

[D:\dsh-research-agent\.acceptance\rubric170-20261102](D:/dsh-research-agent/.acceptance/rubric170-20261102)

主要入口：`final/summary.json`、`final/source-index.json`、`final/working-tree.diff`、`final/build-manifest.json` 和 `evidence-index.json`。最终索引包含本报告、测试脚本、源码快照和逐文件 SHA256；排除索引自身，避免循环哈希。初次 Desktop 成功结果单独保存为 rubric-e2e-initial，最终验收以 rubric-e2e 及其 sourceSha256 为准。中间 lint 失败记录和第一次更新源字节解码错误也保留，不将其冒充最终结果。

尚未解决或尚未验证：1175 的具体进程/过滤驱动根因；严格 Host SDK 的 3 条上游声明错误；通用原文获取覆盖率；模型科学判断质量；多领域专家独立校准；旧拒绝候选的双评分对照。未使用付费外部模型。

建议下一轮继续 Shadow Mode，先积累公开负对照、中档和高档候选，以及旧通过/拒绝的分歧样本，再按原 Rubric 要求开展多名领域专家独立查新和一致性校准。现有证据足以支持工程集成，尚不足以决定权威创新门槛。

本轮没有 commit、push、正式安装包、正式应用升级或独立 Research Web 开发。

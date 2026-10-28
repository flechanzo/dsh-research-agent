# 最终验收测试报告

日期：2026-10-27（Asia/Shanghai）。基线：dsh-research-agent@0.1.4 / 4245985；修复候选：0.1.5-rc.3；正式 Electron/内核：0.2.1-rc.3。此报告取代前一版将 54 项测试和 Web Host 流程作为主要证据的结论。正式 profile 未更新。

**总判定：0.1.4 失败；修复候选部分验收通过，尚未达到全部验收条件。** 下表的“通过”仅指所列范围。模型和文献均为本地 Mock；真实服务测试因用户明确禁止外部调用而未执行。

## 命令及实际结果

命令工作目录均为 D:\dsh-research-agent。默认 sandbox helper 无法启动时使用窄范围宿主执行；这不改变 DSH 产品权限或隔离配置。

| 检查 | 实际命令或入口 | 结果与证据 |
| --- | --- | --- |
| 构建 | node scripts/build.mjs | 通过：协议、Host/Client bundle、声明编译；[build.txt](docs/acceptance/build.txt) |
| 类型 | npm run typecheck | 通过：Host 与 Client tsc --noEmit；既有 skipLibCheck=true，不能据此证明 SDK 声明依赖闭合；[typecheck.txt](docs/acceptance/typecheck.txt) |
| 行为 | node node_modules/vitest/vitest.mjs run --reporter=json --outputFile=docs/acceptance/tests-after.json | 13 文件、89/89 通过；[JSON](docs/acceptance/tests-after.json)、[日志](docs/acceptance/tests-after.txt) |
| 原 0.1.4 缺陷复现 | node tests/acceptance/check-baseline.mjs | 53 项聚焦用例，41 通过、12 失败；退出 1 是内层 Vitest 的预期复现结果；脚本 finally 恢复并重建候选；[失败摘要](docs/acceptance/baseline-failures.json)、[原始结果](docs/acceptance/baseline-confirmed.json) |
| 五条旧 v1 数据 | node tests/acceptance/legacy-records.mjs | 5/5 只读兼容与副本分支通过，真实源哈希不变；[结果](docs/acceptance/legacy-v1.json) |
| 正式 Electron 流程 | node tests/acceptance/electron-candidate.mjs | 通过：完整流程、A→B 子代理路由、导出故障恢复、两分支文件隔离、刷新恢复；[日志](docs/acceptance/electron-final.txt)、[身份](docs/acceptance/electron-identity.json)、[截图](docs/acceptance/electron-completed.png) |
| 离线安装 | 内置 dsh.cmd plugin --profile desktop add 本地 rc.2.tgz --ignore-scripts | 通过；DSH_HOME 仅为隔离 home，npm_config_offline=true，downloaded 0；[日志](docs/acceptance/isolated-update-rc3.txt) |
| Lint | node node_modules/oxlint/bin/oxlint --type-aware --tsconfig tsconfig.lint.json packages/research-agent/src --format json | **失败，exit 1，15 项**；[完整诊断](docs/acceptance/lint-final.json) |
| 覆盖对照 | node tests/acceptance/coverage-map.mjs | 已生成 74→54→89 的逐项断言对照；[说明](docs/acceptance/COVERAGE.md)、[断言原文](docs/acceptance/coverage-final.json) |
| 损坏图解析 | node tests/acceptance/graph-risk.mjs | **失败：parser 接受缺失选择节点和自环**；只解析合成数据，不运行图遍历；[结果](docs/acceptance/graph-risk.json) |
| 真实模型、实时公开文献 | 未执行 | **未验证**，用户已回复“暂不允许任何真实外部调用” |

旧 74 项使用旧报告记录的执行结果，不在旧仓库重跑；当前只读取旧测试用于对照。没有运行旧仓库全套测试、覆盖率 gate、平台矩阵或在线 e2e。最终 89 项中 UI 单测使用显式宿主 primitives 替身；Electron 路径使用真实宿主组件。

## F01–F19 回归矩阵

| 编号 | 0.1.4 / 旧基线 | 候选结果 | 证据及剩余范围 |
| --- | --- | --- | --- |
| F01 | 失败：导出报错后前端仍带旧 revision | **通过** | 缓存和面板单测先失败后通过；Electron 将隔离 research-state.json 临时替换为目录，真实写入失败但 durable revision 11→12，UI 选择与已提交状态一致；还原文件后下一次操作到 13，无持续冲突 |
| F02 | 失败：创建 A 后切 B，实际子代理仍请求 A | **通过（本地路由）** | [修复前 trace](docs/acceptance/f02-before.jsonl)；[修复后 trace](docs/acceptance/model-routing.jsonl)为首次 A、后续 9 次 B；研究/OCR helper 单测覆盖 pending B、maxTokens 与旧 effort 清除；真实远端 B 和视觉 OCR 未验证 |
| F03 | 失败：长问题截掉候选关键词 | **通过** | research-coordinator.spec.ts 的长中文问题、CANDIDATEXYZ 与实际有界索引 URL 断言；没有联网检索 |
| F04 | 失败：新分支根无标记、折叠入口不匹配 | **通过** | ui-regressions.spec.tsx 检查分支所属根、徽标、入口和隐藏后代；旧 canvas 交互测试恢复 |
| F05 | 失败：否决状态/理由未传给新生成器 | **通过** | 原节点 rejected、decision/reason、反馈延续和下一次生成 prompt 都有断言；旧分支和成果保留 |
| F06 | 失败：继承成果重复展示/导出 | **通过** | 正文保留 continuation，唯一成果文本只出现一次；controller 导出同 ID 一次；两项在原 0.1.4 复现失败 |
| F07 | 失败：只读前 N 页却显示总页数已检查 | **通过** | 真实 PDF.js 两页夹具限制一页，processedPageCount=1、pageCount=2，prompt/摘要均显示 1/2；真实模型 OCR 质量未验证 |
| F08 | 失败：缓存阻止刷新、选择失败静默 | **通过（已列路径）** | 重挂载与 window focus 从 revision 1→2→3；选择失败显示 alert；Electron page.reload 恢复计划；跨 Host 主动推送不在本次覆盖 |
| F09 | 并行角色 Promise.all，单角色失败可能丢失其余结果 | **未验证，风险保留** | coordinator 仍使用整体 Promise.all；未注入部分角色失败或实现按角色持久重试，不把正常三角色完成视为故障恢复通过 |
| F10 | 控制器全局队列、无持久在途阶段 | **未验证，风险保留** | serialize 仍按控制器串行；未执行跨会话长任务阻塞、Host 中断与续跑故障矩阵 |
| F11 | JSON 多 Host 无原子 CAS | **未验证，风险保留** | 进程内 revision/queue 不提供跨进程锁；仅验证单写入者，未开展双 Host 竞争写入 |
| F12 | 失败：多分支覆盖同一计划路径 | **通过** | controller 单测与正式 Electron 两份独立计划；branch-1/revision-10 和 branch-3/revision-15，第一份 SHA256 不变 |
| F13 | 代理 DNS/目的访问限制依赖目标 provider | **未验证** | 没有外部连接，也未修改目标 web-fetch 或代理访问策略 |
| F14 | 研究 reader 在附件落盘后检查体积 | **未验证，风险保留** | reader 限额已有测试；上传入口总磁盘/并发配额不属于已验证范围，未做大文件压力写入 |
| F15 | 旧七项 lint 失败 | **失败（仍有 15 项）** | 旧七项对应源码已修复；剩余 ResearchPanel/ResearchTitle 的 error-typed tab 来自缺失 dockkit 声明，见下文；未屏蔽规则 |
| F16 | 五个真实索引 API 语义/字段/限流未验证 | **未验证** | 离线解析、重试、部分来源失败和 URL 限长测试通过；真实 OpenReview、ACL、JSON null/正文截断与实时服务能力不能据此宣称通过 |
| F17 | 固定 OLS 与模板计划不能证明科研有效性 | **未验证（科学能力）** | 固定五点计算和合成流程通过；未执行用户方法、真实实验或科研质量评估 |
| F18 | 重复 reducer 与大组件技术债 | **未验证（仅部分清理）** | 无引用且依赖旧工作区的 reducer 已移除，构建类型通过；没有据此宣称大组件和全部状态语义已完成重构 |
| F19 | 缺失引用/环未统一拒绝 | **失败，未修复** | 合成 parser 探针接受缺失 selectedNodeId 和自环；五条真实记录图检查正常。未引入未经兼容评估的全图拒绝策略 |

F01 的故障是文件目标被目录占用，不是磁盘满或进程断电。F02 的实际子代理生命周期来自正式内核，provider 为 research-mock；不能把真实子代理路由测试等同于真实服务测试。F12 保存新计划采用分支/revision 目录，已有计划文件未迁移。

## 五条 v1 记录的证据

只从真实 research.json 读取字节并复制到隔离目录，测试输出不包含记录内容。每条读取后复制文件字节不变；对副本调用 continueFromNode 后逐一比较全部原节点、原分支与原成果。

| 脱敏序号 | 读前 revision | 副本续接后 revision | 只读 | 原历史保留 |
| --- | ---: | ---: | --- | --- |
| 1 | 51 | 52 | 通过 | 通过 |
| 2 | 209 | 210 | 通过 | 通过 |
| 3 | 15 | 16 | 通过 | 通过 |
| 4 | 13 | 14 | 通过 | 通过 |
| 5 | 7 | 8 | 通过 | 通过 |

原 0.1.4 parser 丢弃历史 web 值，因此不能沿用旧报告“5 条记录有效”推断无损续接。本次候选保持该值并只在检索执行时展开。没有对这些真实记录执行模型阶段；原始私有副本仅留在被 Git 忽略的 .acceptance 中。

## Lint 的具体限制

旧 require-await、no-unnecessary-condition、restrict-template-expressions、prefer-promise-reject-errors、no-base-to-string 和两处 no-confusing-void-expression 已在对应实现中处理。当前 15 项诊断均位于 ResearchPanel.tsx、ResearchTitle.tsx 的 useTabInfo 返回值及 tab.signal/title/id 使用处。

目标 @deepseek-ai/dsh-client-ui-sidebar-right 的公开声明导入 @deepseek-ai/dsh-client-ui-dockkit，当前 node_modules 和本地离线缓存均无目标 0.2.1-rc.3 包。离线补取返回 ERR_PNPM_NO_OFFLINE_META；用户禁止任何真实外部调用，因此未联网。既有 skipLibCheck 允许 tsc 通过，而类型感知 lint 仍将这些字段识别为 error type。未用旧版本 SDK、临时伪造声明或 lint 禁用掩盖失败；恢复许可并补齐同版本声明后仍需重新执行 lint。

## 证据范围与最终完整性

最终 [integrity-final.json](docs/acceptance/integrity-final.json) 中真实数据、正式用户补丁、EXE、ASAR 哈希均与本次起点一致；原 0.1.4 tgz 不变，296 个旧源码文件不变，旧仓库状态不变，正式安装版本仍为 0.1.4。早期 docs/data-integrity.json 是上一轮安装证据，不能替代本次不同时间点的哈希。

本轮所有合成 Session 的工作区位于 .acceptance/run-20261027-RV7z7X/workspace 下；没有向正式科研目录写出结果。Electron 已关闭，故障注入的目录已移除且原隔离导出文件已恢复。首次 rc.2 脚本因隐藏的旧面板产生 strict locator 歧义，修复 visible 选择器后通过；该失败保存在 electron-script-selector-failure.txt，不算产品功能失败。此前 rc.1 的 A→B 路由失败是产品缺陷，保留独立证据。另一次 rc.2 复跑在 node-8 后发生未注入的 ReplaceFileW EIO (Win32 1175)，目标文件为隔离 research-conversation.md；日志见 [electron-filesystem-failure.txt](docs/acceptance/electron-filesystem-failure.txt)。UI 显示错误，服务端阶段已推进；该文件替换错误的根因和重复率尚未定位，保留为运行可靠性未验证项，不以另一次成功抹除。

最终归档为 dist/dsh-research-agent-0.1.5-rc.3.tgz，共 33 文件、178689 字节。rc.2 重打包仅改变生成 CSS 映射属性顺序及包文档，但官方同版本重装复用了旧缓存；因此递增至 rc.3 再安装与验收。最终包与隔离安装的全部五个 JavaScript 运行文件 SHA256 相同，见 [package-final.json](docs/acceptance/package-final.json)。

文档相对链接与文本结尾检查、git diff --check 均通过；检查清单见 [document-check.json](docs/acceptance/document-check.json)。

候选仍不应作为“最终全部通过”的发布结果。未验证项需要相应环境或专项故障测试；本报告没有要求或隐含授权更新正式 profile、使用真实凭据或访问外部服务。

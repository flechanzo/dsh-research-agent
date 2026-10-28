# 迁移最终验收报告

日期：2026-10-27（Asia/Shanghai）。验收对象为独立仓库提交 4245985 的 dsh-research-agent@0.1.4，回归基线为旧仓库 DSH_AGENT_STATE_REPORT.md 的 F01–F19。目标是 F:\deepseek 的正式 Electron Desktop/内核 0.2.1-rc.3。

**结论：0.1.4 未通过最终验收。** 本次复现了刷新、模型继承、候选检索、分支展示、否决反馈、成果重复、PDF 页数、计划覆盖及 v1 历史来源解析问题；修复候选为 0.1.5-rc.3。候选的 89 项行为测试、构建、类型检查及正式 Electron 隔离流程通过，但 lint 失败、F19 数据校验缺口和其他未验证风险仍在，不能宣布全部发布门槛通过。重复桌面验收还出现一次未注入的 Windows 文件替换错误，保留日志且根因未定位。正式 profile 仍是 0.1.4，未自动升级。

## 实际承载与隔离

本次直接由 Playwright 启动 F:\deepseek\DeepSeek Harness.exe，appPath 确认为 F:\deepseek\resources\app.asar，版本 0.2.1-rc.3。使用 .acceptance/run-20261027-RV7z7X 下独立的 home、electron-user 和 workspace；workspace-controller 的 documentsDirectory 也显式指向该目录。因此 Session 产物均位于独立仓库内，不沿用前次 Web 测试的 F:\Documents 默认工作区。

新会话选择“自动科研”，创建时用合成模型 A，切换到合成模型 B，再上传合成 TXT，依次完成摘要、问题、文献检索、候选与创新评分、完善、针对性检索、多角色审查、计划预览及人工确认写入。正式 Electron、RPC、子代理 activation、JSON 存储、附件和文件适配器实际执行；模型与五索引响应为本地 Mock。[桌面证据](docs/acceptance/electron-final.txt)、[路由记录](docs/acceptance/model-routing.jsonl)、[截图](docs/acceptance/electron-completed.png)分别保存，不把这些结果称为真实模型或在线文献验证。

用户明确回复“暂不允许任何真实外部调用”。该限制之后没有进行真实模型、文献平台或在线依赖请求；离线安装日志显示 downloaded 0。此前迁移及工具准备曾有依赖下载，不能把整个历史描述成零网络。没有发送旧科研记录或私人论文。

## 已修复的行为

| 范围 | 修复与可见结果 | 证据 |
| --- | --- | --- |
| F01/F08 状态刷新 | 命令失败后读取权威状态；面板重挂载与窗口 focus 刷新；分支选择失败显示反馈；初始占位状态保持稳定以避免加载渲染循环 | 桌面真实导出故障后 revision 11→12，恢复后下一操作成功到 13；89 项测试含缓存、竞态、重挂载、focus 和 UI 错误用例 |
| F02 模型继承 | 优先读取已持久记录的 modelSelection.pending；否则使用目标 delegation helper；切换模型时不继承旧 reasoningEffort，保留 maxTokens | rc.1 桌面日志证明切换 B 后仍请求 A；最终候选创建请求 A，后续 9 个研究请求全部 B；研究/OCR 单测均覆盖 |
| F03 候选检索 | 为候选优先保留 URL 编码预算，研究问题使用独立预算，字符截断不拆分 Unicode 字符 | 长中文问题与 CANDIDATEXYZ 实际索引 URL 测试 |
| F04 分支根 | 用分支自身拥有的首节点计算标记和折叠入口 | 新分支根显示徽标，折叠保留根且隐藏后代 |
| F05 否决反馈 | 原候选标记 rejected 并记录理由；新分支保留反馈，生成器读取理由 | 状态与下一次生成 prompt 的合成断言 |
| F06 成果重复 | 正文按祖先已展示成果去重；项目 Markdown 按 artifact ID 去重 | continuation 节点保留，成果只显示/导出一次 |
| F07 PDF 页数 | 临时提取结果区分总页数与实际检查页数，摘要和模型 prompt 显示两者 | 真实 PDF.js 读取两页 PDF、限制一页，结果 1 / 2 |
| F12 计划文件 | 路径按分支及 revision 分目录 | 正式 Electron 分别生成 branch-1/revision-10 与 branch-3/revision-15，第一份文件哈希保持不变 |
| v1 历史来源 | 解析时保留历史 web，执行时展开为五个显式来源并去重 | 五条真实记录副本兼容；合成 schema 与来源执行回归 |
| F15/F18 局部质量 | 修复旧七项 lint 对应问题，移除无消费者且引用旧工作区的 reducer；补齐 Host/Client lint 项目发现配置 | 构建与类型检查通过；lint 仍有 SDK 缺失导致的 15 项错误 |

只在独立插件中修改以上有复现或静态证据的行为。未修改目标核心的 loop、UI 槽位、EXE/ASAR、旧源码或正式配置。F09–F11、F13–F14、F16–F19 的剩余范围逐项列于 [测试报告](TEST_REPORT.md)，没有用本次修复掩盖这些限制。

## v1 数据兼容与持久化确认

research domain 继续使用 version=1，没有新必填持久字段、数据代际替换或聊天日志转换。Host 与 Remote 的 ResearchLiteratureSourceId 声明纳入已存在于 v1 的 web 值；解析器保留其原值。只有检索执行层展开为 arXiv、OpenReview、Semantic Scholar、ACL Anthology、OpenAlex，新配置仍只接受显式来源。这是恢复历史数据读写兼容，不是写出新的域版本。processedPageCount 只属于临时 PDF 读取结果。

真实 research.json 先复制到隔离目录。目标 JsonStorageBackend 和候选控制器对全部五条记录读取时未改变副本字节；再对副本逐条执行 continueFromNode。revision 分别为 51→52、209→210、15→16、13→14、7→8，所有原节点、原分支、原成果保持相等。该结果验证控制器级只读兼容和分支续接，没有向模型提交真实记录，也没有逐条在 Electron 内执行私人科研推理。[脱敏结果](docs/acceptance/legacy-v1.json)。

单个 JSON 域仍要求单写入者。损坏引用与环尚未在 parser 中统一拒绝；安全合成探针确认缺失 selectedNodeId 和自环均被接受，详见 [F19 结果](docs/acceptance/graph-risk.json)。五条真实记录的局部图检查没有发现缺失引用或环，不代表任意损坏数据可安全加载。

## 测试覆盖与交付边界

旧 74 项有 250 个直接 expect 调用点；0.1.4 新 54 项有 181 个。原迁移保留 50 项旧测试，遗漏 24 项 UI/样式测试；本次恢复或适配 22 项，另两项旧核心布局断言保留为未验证。候选共 89 项、301 个静态调用点，全部执行通过。调用点数量不等于覆盖率或测试等价性；逐条断言和适配说明见 [COVERAGE.md](docs/acceptance/COVERAGE.md)。

构建产生 Host、Client、Typert 和声明；0.1.5-rc.3 候选包位于 dist/，仅安装到隔离 desktop profile。最终归档 33 文件、178689 字节，运行文件与隔离安装的哈希对照见 [package-final.json](docs/acceptance/package-final.json)。正式安装仍是 0.1.4。Lint 的 15 项剩余诊断来自目标 sidebar SDK 引用未缓存的 @deepseek-ai/dsh-client-ui-dockkit@0.2.1-rc.3；禁止联网期间无法补齐。没有添加替代声明、关闭规则或将失败改报为通过。

最终只读哈希核验显示真实 research.json、正式 desktop/cordis.patch.yml、EXE、ASAR 和原 0.1.4 tgz 均未改变；296 个已备份旧源码文件哈希不变，旧仓库 git status 与本次起点一致。隔离 Electron 已关闭，没有该验收根目录对应的残留进程。[完整性证据](docs/acceptance/integrity-final.json)。这些范围是实际核验清单，不宣称对用户所有文件做过全盘比较。

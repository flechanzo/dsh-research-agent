# 迁移审计（2026-10-26）

## 实机版本和入口

旧源码：D:\deepseek-harness，package.json 为 0.1.7-rc.2，分支 codex/round2-research-reliability，提交 2cf8f5ae37af3acee9546190b0cdc78f1359365e。存在未提交修改，已随源码备份。不是用户口述的 0.17.1rc。origin 指向 flechanzo/dsh-auto-research-agent；upstream 指向 deepseek-ai/deepseek-harness。两条历史没有 merge-base，不能把与 upstream HEAD 的全部差异都归为用户改动。

目标：F:\deepseek\DeepSeek Harness.exe，官方有效 Authenticode 签名 Hangzhou DeepSeek Artificial Intelligence Co., Ltd.；Electron；桌面和内核均为 0.2.1-rc.3，构建提交 be72761ee1a6736ebcdf4f3739363b083ae53c98，dirty=false。更新源 download.deepseek.com，nightly。内置 CLI --version 实测相符。运行时 Node 24.21.0，pnpm 11.28.5。

目标 Host 的实际进程参数指向 F:\deepseek\resources\app.asar\dsh 和 D:\DeepSeekHarness\data\profiles\desktop。其 profile 为 desktop，实际数据根为 D:\DeepSeekHarness\data。用户默认 ~/.dsh 另有 research-forge profile，不能混用。Electron UI 缓存位于 C:\Users\destiny\AppData\Roaming\@deepseek-ai\dsh-desktop，与科研状态目录不同。另有旧源码 Electron 和 D:\DeepSeekHarness\data\electron 实例同时运行。

## 功能和源码归属

| 功能 | 旧源码 | 归属和迁移策略 |
| --- | --- | --- |
| 研究 Preset、人工确认 Prompt、工具组成 | packages/bundle/web-app/presets/research.patch.yml | 自定义；提取原 Prompt，保留 research ID，添加中文名称；不改默认 Agent |
| DAG、分支、回溯、阶段确认、记忆 | packages/workflow/workflow/src/research.ts | 自定义；完整提取，保持状态格式 |
| 论文读取、PDF.js、OCR、五索引检索、创新评分、角色评审、计划生成 | packages/workflow/workflow/src/research-coordinator.ts | 自定义；适配当前 Host API |
| 固定 OLS 数值仿真 | packages/workflow/workflow/src/research-simulation.ts | 未提交自定义源码；保留；不是通用 Python/代码实验器 |
| RPC、revision、持久化、上传、计划导出 | packages/api/research-controller/src/index.ts、types.ts | 自定义；独立 Cordis 服务，保留 research 命名空间和域 |
| 研究面板、画布、树、正文、方案选择 | packages/client/ui-workflow-run/src/client/Research* | 原官方工作流包内的自定义 UI；提取为插件 UI |
| 聊天正文/分支/header tabs | packages/client/ui-chat、ui-conversation 的槽位声明与渲染修改 | 核心 UI 修改；目标无对应自定义槽，改用公开 sidebar.right.pane.tab 与 header.actions |
| 调整子代理模型继承、网页请求网络兼容 | packages/api/session-controller、packages/web/web-fetch-http 等 | 不能整包替换目标核心；按目标 API 核对实际影响 |
| 文件、Shell、Goal、Skills、MCP、通用子代理 | Preset 依赖官方组件 | 复用目标公开组件，不把整个旧内核打进插件 |

原始科研提交 dc2161fee3 的历史及后续提交用于区分用户新增；当前工作区文件是迁移基线。旧科研入口没有独立 Python 研究执行器；Skills 来自官方 filesystem/office，外部 MCP 属于 profile 配置，不能据清单凭空新增功能。

## 为什么聊天迁移了而科研没有

旧 web-app/package.json 的 dsh.bundle.patch 显式包含 presets/research.patch.yml；cordis.patch.yml:106 注册 @deepseek-ai/dsh-api-research-controller。旧 workflow 包导出 research 模块，ui-workflow-run 加载 ResearchPanel 等组件。目标 ASAR 的包清单不包含 research-controller，官方 ui-workflow-run 只包含通用 WorkflowRun，目标 profile bundles 也没有科研扩展。这些代码/注册不是聊天记录的一部分。

后端 researchDomain 定义 name=research/version=1，把每个 Session 的 DAG 放在 storageDomain，实际文件 D:\DeepSeekHarness\data\storages\research.json（审计时 669966 字节）。聊天位于独立 sessions 目录。科研项目导出至各 Session cwd 下 research-projects/<sessionId>。仅恢复历史聊天不会安装 Preset、控制器、UI，也不能从聊天重建独立 DAG。

## API 差异和推荐集成

目标支持 dsh.bundle.patch、engines.dsh 和 @deepseek-ai/dsh-agent-preset 的 id/name/description/order/plugins 字段；桌面自带 F:\deepseek\resources\runtime\cli\bin\dsh.cmd plugin --profile <name> add/remove 入口，实测帮助已确认。原生 Bundle + Preset + 独立后端/客户端入口为首选；版本严格限定 0.2.1-rc.3，不声称兼容未来版本。

目标保留 conversation.session.header.actions 和 sidebar.right.pane.tab；没有旧自定义 conversation.chat.research、conversation.chat.branch、conversation.session.header.tabs。必须迁移这些 UI 功能到公开面板，不修改 ASAR。Typert 协议文件必须从当前源重新生成：旧 lib 的 ResearchSnapshot 缺少当前源码 simulationAvailable，不能直接复制旧构建当作可用协议。

## 数据与备份

备份位置见 docs/backup-location.json；302 个文件已逐个读取并验证哈希。profile 含用户私有配置，只存在本地备份，不进入安装包；未读出或上传凭据。research.json 采用重复读取哈希一致校验，按完整 JSON 快照备份。未复制或修改正在使用的聊天 JSONL/SQLite，未重建会话索引。安装前后需再检查真实 profile，避免并发修改被覆盖。

## 实施验收

2026-10-27：已生成并正式安装 dsh-research-agent@0.1.4；用户重启确认桌面菜单出现自动科研。目标内核隔离 Mock 全流程、54 项自动化测试和管理周期通过。执行结果、展示位置变化和未验收范围见 MIGRATION_REPORT.md 与 TEST_REPORT.md。

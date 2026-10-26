# 迁移实施报告

日期：2026-10-27（Asia/Shanghai）。旧项目 D:\deepseek-harness 为 0.1.7-rc.2；目标 F:\deepseek 为官方签名 Electron Desktop 和 DSH 内核 0.2.1-rc.3。独立插件 dsh-research-agent@0.1.4 已安装到实际 DSH_HOME D:\DeepSeekHarness\data 的 desktop profile。用户已重启并确认 Agent 菜单出现“自动科研”。

## 功能对应与实现

| 原功能 | 独立实现 | 验证 |
| --- | --- | --- |
| research Persona、工具、人工检查点 | packages/research-agent/presets/research.patch.yml，保留 research ID | 目标运行时新建科研会话成功；实际桌面菜单由用户确认 |
| DAG、分支、反馈、拒绝、回溯 | src/workflows/research.ts | 行为测试；浏览器从历史节点创建新分支 |
| TXT、PDF 文本层、扫描/混合页 OCR | src/workflows/research-coordinator.ts | TXT 浏览器上传；真实 PDF.js 文本提取和页面渲染测试；OCR 模型为夹具 |
| arXiv、OpenReview、Semantic Scholar、ACL、OpenAlex | 同一 coordinator | 五源离线端到端；失败、限流分类和查询长度测试 |
| 候选创新点、专项查重、创新评分门槛 | coordinator | 完整流程；低分、重合、无证据拒绝测试 |
| 多角色审查、精确模型继承 | coordinator + subagent-adapter.ts | 真实目标子代理生命周期配合 Mock 模型完成；继承、取消清理测试 |
| 固定五点线性回归仿真 | research-simulation.ts | 计算测试和浏览器分支仿真通过 |
| 最终计划预览、人工确认写文件 | controller.ts + coordinator | 真实目标文件适配器写出合成 Markdown；重开恢复 |
| 科研正文、方案选择、画布、列表、历史导航 | src/client/ | 公开右侧面板和标题按钮；保存截图 |
| RPC、revision 防冲突、状态恢复和项目导出 | controller.ts、types.ts、生成的 Typert | 行为测试、Host 重启继续任务、显式数据目录重开测试 |
| Shell、文件工具、Skills、MCP、Goal 等原有组合 | 保留 Preset 的官方组件引用，复用目标服务 | Preset 能实例化；未逐个调用收费或外部工具 |

没有发现独立的自定义 Python 科研执行器、专用向量数据库或独立科研 Skills 目录。未创建空模块冒充迁移结果。通用 Python/Shell 能力继续由目标工具与用户环境提供，本机 Python 为 D:\Anaconda3\python.exe，3.11.7；此次没有运行模型生成的实验代码。

## 兼容处理

旧 SubagentRuntime.start 改为 startActivation(delivery=caller)，保留显式等待、后发布取消和 dispose 错误观察。模型路由使用目标 parentAgentOptionsForDelegation。PDF 字体路径通过当前包的 pdfjs-dist 解析，不再引用旧 monorepo 的 node_modules。

客户端自带协议由当前 Typert 生成；先显式 $mount，再 ctx.inject remote.research。Locale 使用独立 researchAgent 名称。客户端依赖打包遵循目标 ModuleLoader，React 和目标 UI primitives/store 外置。

原 conversation.chat.research、conversation.chat.branch、conversation.session.header.tabs 自定义槽不在目标官方 API 中。正文、方案选择和控制台保留在公开 sidebar.right.pane.tab 内，标题入口使用 conversation.session.header.actions。原主聊天区替换布局没有照搬，这是明确的展示位置变化，未补丁修改目标核心。

移除目标不支持的 Persona {{cwd}} 后缀，继续使用目标运行时上下文。只读检查的 192 个真实会话文件没有该旧模板文本；没有修改历史组合。历史会话恢复后对真实模型的继续推理未调用验证。

## 数据与程序分离

默认保留 research/version=1，直接使用现有 research.json 的 5 条记录；dataDirectory 可显式指定绝对目录。迁移工具校验 domain 和全部记录，默认 dry-run；原样复制、同内容无操作、异内容拒绝覆盖。没有转换聊天日志或 SQLite，没有覆盖 profile 用户补丁和模型配置，没有改变默认 Agent。

正式安装后 194 个被检查的历史文件、研究状态和用户补丁无哈希变化，296 个备份范围内的旧源码文件无变化。详见 docs/data-integrity.json。安装目录 EXE/ASAR 未写入。隔离测试使用另一个 DSH_HOME，但该实例由目标默认工作区服务分配会话 cwd；合成产物实际写入 F:\Documents\deepseek-harness\default-workspace\research-projects\session-531bec1e-fef9-4217-86eb-2e85cfb9aea4\，仅新增验收任务目录，未覆盖用户科研项目。回滚后再次完整验收生成了 session-7a726755-3d87-4a7d-9870-78b3ed7bf7cf 目录。

## 交付与剩余边界

发行包 dist/dsh-research-agent-0.1.4.tgz 共 33 个文件，176110 字节；包含 Host/Client、声明、协议和 Preset。运行依赖通过 npm 声明，官方依赖严格匹配版本。源码、测试、缓存、数据和凭据均不在安装包内。独立工程已 git init，未推送远端。

已恢复审计发现的核心科研能力。真实模型推理质量、实时索引网络、私人论文 OCR、第三方 MCP 和 Office 工具未逐个实测。完整 GUI 流程在安装目录自带运行时的隔离 Web Host 上自动执行；实际 Electron 窗口菜单由用户重启确认，无法把它称为 Electron 窗口内完整流程自动化验收。Windows Computer Use 因 sandbox helper 初始化失败而不可用；没有绕过权限保护。

具体命令见 README.md，开发流程见 DEVELOPMENT.md，已执行证据与人工补验步骤见 TEST_REPORT.md。

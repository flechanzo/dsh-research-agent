# dsh-research-agent 当前状态技术审计

- 审计日期：2026-11-02（Asia/Shanghai）。
- Git 最终核验时间：2026-11-02 13:20:45 +08:00。
- 项目路径：`D:/dsh-research-agent`。
- 目标方向：DSH 官方原生 Web + 独立自动科研插件。
- 范围：当前 Git、源码、生成文件、已安装依赖、实际 DSH 安装实例、profile 元数据、进程及监听端口。
- 操作边界：检查阶段只读。未修改源码、依赖、profile、凭据、科研数据或运行服务；未构建、打包、安装、迁移、回退或推送。本报告是用户在审计完成后明确要求新增的 Markdown 文件。
- 隐私边界：未读取凭据明文、私人会话和科研记录正文；未调用模型、真实文献检索或外部科研服务。
- 标记规则：**已证实**表示本轮通过实际文件、命令或静态实现核对；**基于源码推断**表示具有代码依据但未做运行验证；**未验证**表示本轮没有取得足够的实际证据。历史验收结果单独列出，不能视为本轮通过。

**核心结论：Git 跟踪源码已恢复到用户仓库默认分支的最新提交，当前插件源码版本是 0.1.5-rc.5；但生成文件、遗留 Web 运行时及已安装插件存在版本混用。当前可确认的是原生 DSH 科研插件源码，不能宣布“官方 Web + 当前科研插件”已经完成部署和验收。**

## 1. 当前版本状态

### 1.1 Git 和远程

| 检查项 | 结果 | 状态 |
| --- | --- | --- |
| 本地仓库 | D:/dsh-research-agent | 已证实 |
| origin fetch / push | `https://github.com/flechanzo/dsh-research-agent.git` | 已证实 |
| 当前分支 | main | 已证实 |
| GitHub 实时默认分支 | main | 已证实 |
| 本地 HEAD | `f8f3ddfe0b4677815905760ee44e90a2c56c7c86` | 已证实 |
| 本地 origin/main | `f8f3ddfe0b4677815905760ee44e90a2c56c7c86` | 已证实 |
| GitHub 实时 HEAD | `f8f3ddfe0b4677815905760ee44e90a2c56c7c86` | 已证实 |
| 提交时间 | 2026-10-28T17:31:29+08:00 | 已证实 |
| 提交说明 | Update research agent UI and workflows | 已证实 |
| Git 跟踪文件差异 | 审计检查阶段无差异，git diff --exit-code HEAD 返回 0 | 已证实 |
| Git 跟踪文件数量 | 173 | 已证实 |
| 子模块 / gitlink | 未发现 | 已证实 |

实际执行的关键命令：

```powershell
git remote get-url origin
git remote get-url --push origin
git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
git log -1 --format='%H%n%cI%n%s'
git --no-optional-locks status --short --branch
git diff --exit-code HEAD
git ls-remote --symref origin HEAD
```

实时查询成功返回：

```text
ref: refs/heads/main HEAD
f8f3ddfe0b4677815905760ee44e90a2c56c7c86 HEAD
```

这里使用了 GitHub 实时响应，不是用本地 origin 缓存代替远程结果。当前仓库是用户的 flechanzo/dsh-research-agent，不是 DSH 官方仓库。本轮没有执行 fetch、pull、reset、checkout、switch、restore、clean、stash 或 push。

### 1.2 当前版本和版本混用

| 层次 | 实际状态 | 状态 |
| --- | --- | --- |
| 根工作区 package.json | dsh-research-agent-workspace@0.1.0 | 已证实；不是插件版本 |
| 当前插件 package.json | dsh-research-agent@0.1.5-rc.5 | 已证实 |
| packages/research-agent/lib | 五个主要 JS 与遗留原生 Web 运行时中标记为 rc.9 的插件运行文件逐字节一致 | 已证实 |
| 正式数据目录的 desktop profile | 安装插件 0.1.4 | 已证实，限磁盘安装元数据 |
| 正式数据目录的 web profile | 官方 base + web-app，没有科研插件 | 已证实，限磁盘安装元数据 |
| .native-web-runtime 的插件副本 | 0.1.5-rc.9 | 已证实 |
| .web-runtime 的插件副本 | 0.1.5-rc.9 | 已证实 |
| .research-web/home 的 research-web profile | 安装插件 0.1.5-rc.9 | 已证实 |
| .isolated/home 的 web profile | 安装插件 0.1.4 | 已证实 |

源码版本证据：[插件 package.json](D:/dsh-research-agent/packages/research-agent/package.json:3)。

生成文件混用涉及：

- `packages/research-agent/lib/index.js`
- `packages/research-agent/lib/client.js`
- `packages/research-agent/lib/types.js`
- `packages/research-agent/lib/typert.host.js`
- `packages/research-agent/lib/typert.remote-client.js`

这五个文件的 SHA256 分别与 `.native-web-runtime/node_modules/dsh-research-agent/lib` 下对应文件相同。它们是被 Git 忽略的生成文件，Git 跟踪源码一致并不意味着这些运行文件已经恢复到 rc.5。

### 1.3 未跟踪目录及历史产物

审计检查结束时仍有七个未跟踪目录：

```text
.native-web-runtime/
.npm-cache-local/
.npm-cache-v2/
.pnpm-store/
.research-web/
.web-runtime/
progress-repo/
```

其中 `.native-web-runtime/host.mjs` 和 `.web-runtime/server.mjs` 属于遗留可执行代码，不能将这些目录全部理解为普通缓存。当前根 package.json 和跟踪源码启动链未发现使用它们的入口；本轮进程检查也未发现这些 Host 正在运行。

`progress-repo` 是独立嵌套 Git 仓库，不是子模块，也不是当前项目的版本权威。

被忽略的 `dist/` 中还存在多个 rc.1–rc.9 插件包、旧 Research Web ZIP，以及 `dsh-native-research-web-0.2.0-rc.1-win32-x64-20261102T025243Z` 候选目录/压缩包。归档中还有 `archive/research-web/apps/research-web/dist` 页面产物。它们均不能代表当前跟踪源码。

此前回退备份保留于：

- `D:/dsh-research-agent-backups/before-github-reset-20261102T045907Z`
- 备份分支：`codex/backup-before-github-reset-20261102T045907Z`

本轮没有恢复或改动这些备份。

**结论：已证实 Git 跟踪源码恢复成功；整个磁盘目录不是单一版本的干净运行环境。**

## 2. 当前项目架构

### 2.1 模块和职责

| 模块 | 作用和实际关系 | 证据 | 状态 |
| --- | --- | --- | --- |
| DSH Desktop / Kernel | 使用 F:/deepseek 中正式安装实例；本仓库没有维护完整 DSH 内核 | app.asar 与内置包元数据 | 已证实 |
| Cordis 插件注册 | 将 research-agent-controller 注册为 dsh-research-agent | [cordis.patch.yml](D:/dsh-research-agent/packages/research-agent/cordis.patch.yml:1) | 已证实 |
| Agent Preset | 增加“自动科研”预设，复用官方 Agent、工具、Skills、子智能体和规划机制 | [research.patch.yml](D:/dsh-research-agent/packages/research-agent/presets/research.patch.yml:1) | 已证实 |
| Host 控制器 | Remote API、revision 检查、Session 研究状态、分支及导出 | [controller.ts](D:/dsh-research-agent/packages/research-agent/src/controller.ts:230) | 已证实 |
| 科研状态机 | 阶段、节点、分支、成果、确认和历史续接 | [research.ts](D:/dsh-research-agent/packages/research-agent/src/workflows/research.ts:15) | 已证实 |
| 科研协调器 | 论文处理、检索、创新评价、多角色评审、计划生成和适配器装配 | [research-coordinator.ts](D:/dsh-research-agent/packages/research-agent/src/workflows/research-coordinator.ts:292) | 已证实 |
| 子智能体适配 | 对接官方 Subagent Runtime，传递取消并释放运行句柄 | [subagent-adapter.ts](D:/dsh-research-agent/packages/research-agent/src/workflows/subagent-adapter.ts:1) | 已证实 |
| 原生客户端扩展 | 官方右侧栏、Session 标题动作和远程 API 集成 | [client/index.ts](D:/dsh-research-agent/packages/research-agent/src/client/index.ts:18) | 已证实 |
| 科研界面 | ResearchPanel、Transcript、分支选择、横向画布及列表 | [ResearchPanel.tsx](D:/dsh-research-agent/packages/research-agent/src/client/ResearchPanel.tsx:171) | 已证实 |
| 构建 | 生成 lib、声明及 Typert Host/Client 文件 | [build.mjs](D:/dsh-research-agent/scripts/build.mjs:1) | 已证实 |
| 数据迁移工具 | 独立迁移脚本；本轮未执行 | [migrate-data.mjs](D:/dsh-research-agent/scripts/migrate-data.mjs:1) | 已证实 |

插件通过官方服务使用 Session、附件、文件系统、存储域、Subagents、Web 和 Typert；没有在当前跟踪源码中发现另一套完整的 Host、聊天服务、模型管理后台或 Session 系统。

### 2.2 实际安装的兼容目标

本轮于 **2026-11-02T05:09:13.100Z，即北京时间 13:09:13**，只读核验了 [实际 app.asar](F:/deepseek/resources/app.asar)，不是仅参考本项目 engines 或旧报告。

| 检查项 | 实际版本 |
| --- | --- |
| @deepseek-ai/dsh-desktop | 0.2.1-rc.3 |
| Desktop commit | be72761ee1a6736ebcdf4f3739363b083ae53c98 |
| @deepseek-ai/dsh-desktop-runtime | 0.2.1-rc.3 |
| dsh、dsh-base、dsh-app-boot | 均为 0.2.1-rc.3 |
| dsh-web-app、dsh-web-frontend | 均为 0.2.1-rc.3 |
| dsh-sdk-app、dsh-sdk-minimal、dsh-sdk-protocol | 均为 0.2.1-rc.3 |
| dsh-agent、dsh-subagent、dsh-llm | 均为 0.2.1-rc.3 |
| dsh-client-ui-settings-models | 0.2.1-rc.3 |
| Cordis | 4.0.5 |

app.asar SHA256：

```text
04b32e3a872826ba15cfb2081c6a929a8d4ecaa65e09a2543e5a6b30e2eff1f0
```

读取方式为仓库内纯读取工具 [asar-reader.mjs](D:/dsh-research-agent/scripts/asar-reader.mjs:1)。实际内核包位于 ASAR 的 `dsh/node_modules/@deepseek-ai/`，Desktop 自身元数据位于根 package.json。

**已证实：所核验的版本与当前插件声明的 rc.3 目标相符。未验证：当前 rc.5 源码重新构建后在此实例中的完整行为兼容性。** 缺失 DockKit 类型声明仍构成已知 SDK 开发环境问题，不能用版本相符代替兼容验收。

## 3. 当前网页端类型

### 3.1 分类结论

**当前受 Git 管理的工程是“DSH 原生科研插件工程”。它具备实现 C：DSH 官方 Web + 科研插件的扩展结构，但当前正式 web profile 尚未安装科研插件，也没有运行中的项目 Web 可供本轮界面验收。**

因此不能将当前实际部署直接宣布为 A“完整官方 Web 已运行”、B“独立 Research Web 默认首页”或“C 已完成上线”。

证据：

1. [插件清单](D:/dsh-research-agent/packages/research-agent/package.json:52) 声明官方 bundle patch 和 `dsh.client.platform: web`。
2. [客户端入口](D:/dsh-research-agent/packages/research-agent/src/client/index.ts:28) 使用 `sidebarRightTabs`、`sidebar.right.pane.tab`、`sidebar.right.pane.tab.title` 和 `conversation.session.header.actions` 官方扩展点。
3. 当前科研界面由原生 Session 内的右侧栏打开，没有独立整站导航或自定义聊天入口。
4. 当前跟踪源码没有 `apps/research-web/src/main.tsx`、`apps/dsh-web-host/host.mjs`、`scripts/web.mjs`、`scripts/build-web.mjs` 或 `scripts/native-web/cli.mjs`；根 package.json 没有 Web 启动脚本。
5. 正式数据目录中的 web profile 仅包含官方 base 和 web-app。

实际安装的官方 Web bundle 包含模型设置、聊天、模型选择、插件管理和 Skills 客户端注册。证据是 ASAR 内：

- `dsh-web-app/cordis.patch.yml:180`：官方 Web Server。
- `dsh-web-app/cordis.patch.yml:313`：模型设置。
- `dsh-web-app/cordis.patch.yml:333`：聊天。
- `dsh-web-app/cordis.patch.yml:378`：Skills 界面。
- `dsh-web-app/cordis.patch.yml:413`：模型选择器。
- `dsh-base/cordis.patch.yml`：Session、JSONL 持久化、Storage Domain、LLM、凭据、Skills 和 MCP 资源服务。

### 3.2 独立工作台是否仍然存在

- **已证实：当前跟踪源码没有独立 Research Web 整站实现。** 科研 React 组件是插件界面，不等同于重复维护完整官方前端。
- **已证实：磁盘仍有旧工作台运行副本和构建产物。** `.web-runtime` 属于旧独立工作台；`.native-web-runtime` 属于此前原生 Web 候选。
- **未验证：这些旧产物现在启动后具体呈现的页面。** 本轮没有启动它们。
- **已证实：当前 rc.5 界面不包含后续 rc.8/rc.9 的完整 UI V2 三视图实现。** 当前面板是 Transcript、分支和阶段操作的集成布局，分支有 map/list 两种呈现；不能沿用后续版本的验收结论。

## 4. 自动科研智能体状态

下表的“接入”指源码调用链，不等同于当前运行实例已经加载该版插件。

| 能力 | 当前实现与边界 | 状态 |
| --- | --- | --- |
| 自动科研 Preset | bundle 插入 research 预设，保留人工检查点、官方工具和子智能体约束 | 已证实：源码及注册存在；实际加载未验证 |
| ResearchController | Remote 命令、Session 状态、revision、分支与文件导出相连 | 已证实：调用链存在 |
| 科研 Workflow | 论文阅读、问题提取、文献、创新、细化、定向检索、评审、仿真/计划和结束阶段 | 已证实：状态机存在；本轮未跑通 |
| 人工操作 | 确认、反馈、否决、分支选择、节点选择、历史续接和 Session restore 代码保留 | 已证实：源码存在 |
| DAG / 分支 | 节点、父子引用、分支标识、成果、历史来源和选中态保留 | 已证实：数据结构存在 |
| 横向布局 | 自动坐标 x 随深度递增，多个子分支在 y 方向展开；有拖动、选择、缩放、平移、折叠、适配视图及小地图 | 已证实：源码如此；400px/完整桌面 Electron 未验证 |
| TXT / PDF | 附件读取、PDF.js 文本提取、页面渲染和视觉 OCR 子智能体相连 | 已证实：适配器装配存在；真实文件未验证 |
| PDF 页数 | 同时记录总页数与实际处理页数，受最大页数限制 | 已证实：修复代码仍在 |
| 文献检索 | 使用 arXiv、OpenReview、Semantic Scholar、ACL、OpenAlex 等显式来源；有来源错误和重试处理 | 已证实：源码存在；真实在线检索未验证 |
| 创新评估 | 评分、阈值、重试和否决后新分支逻辑存在 | 已证实：源码存在；输出质量未验证 |
| 多智能体 | 使用官方 Subagent Runtime；评审采用 Promise.all 并行；有取消与 dispose | 已证实：调用链存在；真实并发未验证 |
| 模型继承 | 读取当前 Session 的待应用模型选择，继承 provider/model/reasoningEffort/maxTokens | 已证实：修复实现存在；动态切换实测未验证 |
| 仿真 | 固定五点数据的最小二乘回归，计算真实指标 | 已证实：实现存在；不是通用实验执行系统 |
| 状态持久化 | research domain v1，按 Session 保存 revision/state/updatedAt | 已证实：实现存在；真实数据读写未执行 |
| 计划与导出 | Markdown 计划、research-conversation.md、research-state.json；计划按分支和 revision 分目录 | 已证实：调用链存在；本轮未导出 |

关键证据：

- [控制器和原生服务装配](D:/dsh-research-agent/packages/research-agent/src/controller.ts:478)。
- [科研协调器适配器装配](D:/dsh-research-agent/packages/research-agent/src/workflows/research-coordinator.ts:1280)。
- [并行评审](D:/dsh-research-agent/packages/research-agent/src/workflows/research-coordinator.ts:532)。
- [PDF 实际页数](D:/dsh-research-agent/packages/research-agent/src/workflows/research-coordinator.ts:1393)。
- [横向坐标算法](D:/dsh-research-agent/packages/research-agent/src/client/ResearchFlowCanvas.tsx:196)。
- [固定数值仿真](D:/dsh-research-agent/packages/research-agent/src/workflows/research-simulation.ts:1)。
- [最终计划模板](D:/dsh-research-agent/packages/research-agent/src/workflows/research-coordinator.ts:1314)。

必须明确的能力边界：

- 仿真只验证固定数值任务及成果链路，不验证用户提出的科研方法，不执行模型生成的 Python/Shell 实验。
- 最终计划的实验设计部分仍包含需要补齐数据、基线、指标和消融的模板提示，不能视为自动完成完整实验设计。
- 当前未发现后续版本的分支聚焦/全局概览专用切换实现；已有 fit-to-view 和小地图不能直接冒充后续功能验收。
- 前端遍历防环不等于权威数据完整性校验。
- 所有需要真实模型、真实检索、写文件或 Electron 运行的行为，本轮均未重新验证。

## 5. 模型管理状态

### 5.1 当前使用哪套机制

**已证实：当前跟踪源码复用 DSH 原生模型服务，没有发现独立 Research Web 模型管理页面或自定义配置服务的现行源码。**

实际安装的 DSH 官方实现包含：

| 检查项 | 静态证据与判断 | 状态 |
| --- | --- | --- |
| 原生提供商管理 | dsh-client-ui-settings-models + dsh-llm-pi-ai | 已证实 |
| DeepSeek 官方 API 路由 | 内置 deepseek 路由和官方 endpoint 定义 | 已证实；用户当前配置未读取 |
| 第三方 OpenAI 兼容 | openai-completions / openai-responses 适配、baseURL、api、models 配置 | 已证实：实现支持 |
| 获取模型列表 | UI 调用 remote.llm.discoverModels；Host 注册发现处理器 | 已证实：静态链路存在 |
| 搜索 / 选择 | 按模型 id/name 过滤并维护选中项 | 已证实 |
| 保存提供商和模型 | settings.mutate 写 providers.<route> | 已证实：实现存在 |
| 保存凭据 | 独立 credentials.set，profile 保存 apiKeyEnv 引用 | 已证实：机制存在；未读写真实凭据 |
| 聊天模型选择器 | 官方 Web bundle 注册 dsh-client-ui-model-selection | 已证实：bundle 注册存在 |
| 科研子智能体继承 | 从父 Agent 和 Session modelSelection projection 读取模型路由 | 已证实：源码存在 |
| 实际推理接口 | 官方 LLM adapter 注册后由 Agent/Subagent 使用 | 已证实：静态链路存在；真实推理未验证 |

ASAR 内的证据路径均以 `dsh/node_modules/@deepseek-ai/` 为前缀：

- `dsh-client-ui-settings-models/lib/client.js:950`：模型发现输入。
- 同文件 `:1002`：模型列表搜索。
- 同文件 `:1600`：组装 api/baseURL/models/apiKeyEnv 并保存提供商。
- 同文件 `:3172`：credentials.set。
- 同文件 `:3180`：settings.mutate。
- 同文件 `:3194`：remote.llm.discoverModels。
- `dsh-llm-pi-ai/lib/index.js:2275`：模型目录 URL 构造。
- 同文件 `:2385`：discoverModels 实现。
- 同文件 `:2937`：registerModelDiscovery。
- 同文件 `:2952`：registerAdapter。

OpenAI 兼容模型目录通常访问配置 baseURL 后的 /models；不是所有推理协议都支持自动列举模型，不支持时实现会要求手动录入。当前实现不能保证任意第三方服务都能被自动发现。

### 5.2 模型切换和科研继承

[research-coordinator.ts:1220](D:/dsh-research-agent/packages/research-agent/src/workflows/research-coordinator.ts:1220) 会读取：

```text
sessionProjections -> stateOf(parent.session, 'modelSelection') -> pending
```

存在待应用选择时，以其中的 provider/model/reasoningEffort 覆盖旧路由，并保留 maxTokens 等委派限制。Preset 中还关闭子智能体单独选模型和后台脱离运行。

**已证实：此前模型继承修复仍在当前源码中。未验证：真实界面保存模型后、聊天切换后、科研子智能体下一次调用是否全链路使用正确模型。** 正式 profile 仍安装旧插件且本地 lib 混用，因此不能用当前源码推导正在运行实例的实际行为。

### 5.3 是否有两套模型界面

- 当前跟踪源码中未发现两套模型设置实现。
- 旧工作台运行副本和 ZIP 仍可能包含历史自定义模型页面。
- 本轮没有启动旧副本，也没有读取用户实际模型配置或测试 API Key。

## 6. 启动与运行状态

### 6.1 当前源码启动入口

**已证实：根目录没有 start.cmd、stop.cmd，根 package.json 只有 build/typecheck/test/pack/lint，没有可直接作为生产 Web 入口的启动脚本。**

现有 [start-isolated.ps1](D:/dsh-research-agent/scripts/start-isolated.ps1:1) 是隔离测试辅助脚本：

- 默认使用 F:/deepseek。
- 将 DSH_HOME 指向项目 .isolated/home。
- 创建 mock overlay、url.txt 和日志。
- 调用官方 `dsh.cmd web`，默认监听 127.0.0.1:53736。
- 使用 mock/browse-picker patch；不是当前生产启动管理方案。
- 本轮没有执行。

当前源码中没有发现完整的生产后台进程监督、stop.cmd、退出联动及端口回收实现。旧打包目录的启动器不能作为当前源码已具备这些功能的证据。

### 6.2 本轮进程与端口快照

采样时间：**2026-11-02 13:11:02 +08:00**。只读查询未停止或启动进程。

| 进程归属 | PID / 关系 | 监听地址 | 状态 |
| --- | --- | --- | --- |
| 正式 DSH Desktop | 根 PID 28428，F:/deepseek/DeepSeek Harness.exe | 根进程不据此推断服务端口 | 已证实 |
| Desktop 子进程 | PID 38980，父进程 28428 | 127.0.0.1:56684、127.0.0.1:51038 | 已证实 |
| Desktop 下的 Electron 子树 | PID 40892，父进程 38980，D:/DeepSeekHarness/data/electron/electron.exe | 127.0.0.1:55443 | 已证实 |
| 项目 Research Web / native Web Host | 未识别到归属本项目的运行进程 | 未发现 4317 / 53736 监听 | 已证实：本轮快照范围 |

这些 PID 属于同一 Desktop 进程树，不能把 Electron 子进程数当作独立 DSH 实例数。另有 Codex 自身的 CUA Node 进程，路径归属 Codex，不应归因于项目。

**未验证：上述监听端口各自的 API/CDP 用途、Desktop 当前界面健康度和加载的插件行为。** 本轮没有发送服务请求或打开测试页面。未发现足够证据认定存在项目孤儿进程；进程快照也不代表已验证长期退出行为。

## 7. 数据兼容情况

### 7.1 当前路径和 profile 元数据

本轮审计进程的环境变量：

```text
DSH_HOME=D:/DeepSeekHarness/data
RESEARCH_DATA_DIR 未设置
```

这不自动证明所有现有进程都继承了相同环境，生效中的 profile patch 和 dataDirectory 覆盖项仍未完整核验。

| 目录 | 只读检查结果 | 状态 |
| --- | --- | --- |
| D:/DeepSeekHarness/data/profiles/desktop | 官方包及科研插件；依赖指向本地 dist/dsh-research-agent-0.1.4.tgz，实际安装 0.1.4 | 已证实 |
| D:/DeepSeekHarness/data/profiles/web | 官方 base + web-app，无科研插件 | 已证实 |
| D:/DeepSeekHarness/data | sessions、attachments、storages/research.json、workspace 配置存在 | 已证实：仅元数据 |
| .research-web/home | research-web profile，插件 rc.9；有 sessions/workspace，未发现 storages/research.json | 已证实：仅元数据 |
| .isolated/home | web profile，插件 0.1.4；有 sessions、research storage 和 workspace | 已证实：仅元数据 |

凭据文件只确认存在，没有读取明文。未打开真实研究状态正文、私人会话和论文内容。

### 7.2 存储协议

[controller.ts:175](D:/dsh-research-agent/packages/research-agent/src/controller.ts:175) 定义全局 `research` domain，版本仍为 **1**，按 Session ID 保存：

```text
revision
state
updatedAt
```

state 包含 nodes、branches、artifacts、selectedNodeId、activeBranchId 及编号计数。节点可保存 sessionSeq/sourceSessionId，以支持历史边界及跨 Session 来源。

默认使用官方 storageDomain；配置了绝对 dataDirectory 时使用独立 JsonStorageBackend，见 [controller.ts:258](D:/dsh-research-agent/packages/research-agent/src/controller.ts:258)。附件通过官方 attachment 服务，计划与研究文件通过官方 fs/Session workspace 处理。

### 7.3 兼容性结论和风险

- **已证实：当前源码保留 research v1、revision 和历史来源字段，没有看到本轮引入的协议升级。**
- **基于源码推断：对结构正常的既有 v1 数据具有兼容基础。**
- **未验证：全部当前真实科研记录能否无损加载和继续研究。** 本轮没有读取或迁移真实数据。

历史报告记录了五条真实记录副本的读取及续接验证，仅属于旧轮次证据，不能视为本轮再次通过。

关键风险：

1. [权威 schema](D:/dsh-research-agent/packages/research-agent/src/controller.ts:152) 只检查字段结构，未统一检查 selectedNodeId、分支和成果引用以及父子环。F19 仍不能判为修复。
2. Desktop 和 Web 若使用同一 DSH_HOME 并都写入全局 research JSON 域，存在跨 Host 并发风险。控制器的 [serialize](D:/dsh-research-agent/packages/research-agent/src/controller.ts:704) 只约束本控制器实例，不是跨进程锁或 CAS。
3. 状态在 [controller.ts:514](D:/dsh-research-agent/packages/research-agent/src/controller.ts:514) 提交后再写项目导出文件；导出失败可能出现 revision 已推进但文件未同步。
4. UI 失败后重新读取权威状态的代码仍在 [ResearchPanel.tsx:268](D:/dsh-research-agent/packages/research-agent/src/client/ResearchPanel.tsx:268)，可处理部分显示/版本失配，但不等于解决文件 EIO。
5. 旧 Web 与隔离目录使用不同 home，容易出现“界面没有记录”或“记录版本不同”的现象；不能据此直接判定原数据丢失。

本轮未执行数据修复、转换、写回或重建，未删除任何数据目录。

## 8. 代码质量与测试状态

### 8.1 工具链和依赖

| 项目 | 本轮结果 | 状态 |
| --- | --- | --- |
| Node | v22.20.0；插件要求 >=22.19 | 已证实 |
| pnpm 要求 | packageManager: pnpm@11.7.0 | 已证实 |
| 本机 pnpm 安装 | Roaming/npm/pnpm.ps1 指向已安装 pnpm，package.json 版本 11.7.0 | 已证实：读取 shim/元数据，未触发安装 |
| 当前声明依赖 | 根工作区 50 个 dependencies/devDependencies 与本地已安装声明版本相符，无缺失/不匹配 | 已证实 |
| 额外安装包 | 存在当前根清单未声明的历史残留包 | 已证实；不是干净依赖环境 |
| 锁文件 | 存在 pnpm-lock.yaml | 已证实；未重建或验证全新安装复现 |
| TypeScript | strict、noUncheckedIndexedAccess，同时 skipLibCheck:true | 已证实 |
| 测试框架 | Vitest，13 个 spec 文件，包含行为、控制器、工作流及 UI 测试 | 已证实 |
| UI 测试替身 | primitives 在 vitest.config 中映射到 tests/support/ui-primitives.tsx | 已证实；不能代替真实 Electron |
| CI | 当前跟踪树未发现 .github 工作流 | 已证实 |

### 8.2 本轮实际执行的检查

```powershell
node node_modules/typescript/bin/tsc --noEmit --incremental false -p packages/research-agent/tsconfig.host.json
node node_modules/typescript/bin/tsc --noEmit --incremental false -p packages/research-agent/tsconfig.client.json
node node_modules/oxlint/bin/oxlint --type-aware --tsconfig tsconfig.lint.json packages/research-agent/src --format json
```

| 检查 | 实际结果 |
| --- | --- |
| Host Typecheck | 退出码 0 |
| Client Typecheck | 退出码 0 |
| Lint | 退出码 1，15 项错误 |
| Build / Pack | 未执行 |
| Vitest 行为和 UI 测试 | 存在测试，尚未重新执行 |
| Electron / 400px / 完整窗口验收 | 未执行 |
| 真实模型 / 文献接口 / OCR | 未执行 |
| 真实数据兼容和写入恢复 | 未执行 |

Lint 错误集中于 ResearchPanel.tsx 和 ResearchTitle.tsx 的 useTabInfo、tab.signal/title/id 等访问。官方 sidebar-right 声明依赖 `@deepseek-ai/dsh-client-ui-dockkit`，本地及核验的安装 SDK 位置缺少对应包/声明。

证据：[官方 sidebar-right 声明](D:/dsh-research-agent/node_modules/@deepseek-ai/dsh-client-ui-sidebar-right/lib/types/client/contract/slots.d.ts:25)。

**Typecheck 通过有明确局限：skipLibCheck 会跳过部分依赖声明检查，当前生成声明又不属于经过重建确认的 rc.5 基线。因此不能据此宣称完整 SDK 类型健康。**

### 8.3 源码 / 生成文件 / 测试混用

- [client/index.ts:1](D:/dsh-research-agent/packages/research-agent/src/client/index.ts:1) 直接导入 lib/typert.remote-client.js。
- [根 tsconfig](D:/dsh-research-agent/tsconfig.json:22) 将 remote 类型映射到 lib/typert.remote-client.d.ts。
- [controller.spec.ts:6](D:/dsh-research-agent/tests/controller.spec.ts:6) 和 [compatibility.spec.ts:2](D:/dsh-research-agent/tests/compatibility.spec.ts:2) 导入 lib/index.js。

所以在未从当前提交重建前运行测试，可能验证遗留 rc.9 运行文件，而不是当前 rc.5 控制器。**这是下一轮开发基线的首要问题。**

本轮没有直接运行测试：迁移测试会创建/写入/删除临时文件，部分 PDF/附件测试也可能写入；构建会生成 lib/dist，均超出检查阶段只读边界。

### 8.4 历史结果和当前修复保留情况

历史证据：

- [TEST_REPORT.md](D:/dsh-research-agent/TEST_REPORT.md:3)：rc.3 的 89 项测试通过记录。
- [UI_TEST_REPORT.md](D:/dsh-research-agent/docs/UI_TEST_REPORT.md:36)：rc.5 追加记录为 13 文件、90 项通过，包含 1 项 F19 前端环图回归。
- 同报告记录 rc.5 完整 Electron 流程通过，也记录追加重跑遇到 ReplaceFileW EIO。
- 后续 rc.9 的测试数量和通过结果不适用于当前 rc.5 源码。

| 历史关注点 | 当前源码核对 | 本轮结论 |
| --- | --- | --- |
| 模型继承 F02 | Session pending modelSelection 覆盖旧路由代码保留 | 已证实源码保留；行为未验证 |
| 状态刷新 F01/F08 | 失败 reload、共享快照、重挂载和 focus 刷新保留 | 已证实源码保留；行为未验证 |
| 分支显示及历史兼容 | 分支状态、来源字段、历史续接和前端遍历保护保留 | 已证实源码保留；真实数据未验证 |
| 多分支计划覆盖 F12 | 分支/revision 分目录 | 已证实源码保留；实际写文件未验证 |
| PDF 页数 | processedPageCount / pageCount 区分 | 已证实源码保留；真实 OCR 未验证 |
| F19 缺失引用与环 | 权威 schema 仍未统一校验 | 未修复，不能用 UI 降级替代 |
| Windows EIO | 有失败后刷新，未发现足以证明根因解决的实现或本轮专项证据 | 未验证，仍保留问题 |
| 并行任务失败恢复 | Promise.all 评审，未见完整持久化的逐角色重试恢复 | 基于源码推断存在恢复不足 |
| Windows 服务退出 | 当前无完整生产生命周期实现 | 未验证；缺少验收基础 |

## 9. 当前存在的问题

### P0

**本轮没有已证实的 P0。** 未发现足够证据证明正在发生数据丢失、凭据泄露或不可恢复故障。由于未读取私人记录，也不能据此保证所有历史数据绝对健康。

### P1

| 问题 | 证据与影响 | 建议 |
| --- | --- | --- |
| 源码和生成运行文件混用 | rc.5 源码、与遗留 rc.9 副本相同的 lib，测试直接导入 lib；可产生错误验收结论 | 先建立隔离、可追溯的当前提交构建和测试环境 |
| 目标 Web 尚未完成科研插件集成 | 正式 web profile 无科研插件，当前源码无生产 Web 启动入口 | 后续在隔离 profile 验证官方 Web + 当前插件，不先修改正式 profile |
| F19 权威图完整性缺口 | schema 只检查形状；引用和环未统一拒绝 | 设计兼容既有 v1 的权威校验与可读错误，禁止静默重写旧记录 |
| 多 Host 写同域风险 | 全局 research JSON、实例内 serialize；无控制器层跨 Host CAS | 首先明确单写入者/隔离策略，再评估跨实例并发机制 |

后两项为已证实的实现缺口及基于源码推断的数据风险，**不是本轮已复现的真实数据损坏**。

### P2

| 问题 | 证据与影响 | 建议 |
| --- | --- | --- |
| 15 项 Lint 错误 | 本轮实测仍失败，涉及缺失 DockKit 类型 | 核对实际目标 SDK 的完整类型来源后修复，不伪造声明或关闭规则 |
| Windows ReplaceFileW EIO 未解决 | 历史报告保留失败；当前无专项复测 | 在隔离 workspace 重现并区分文件系统、占用和替换实现问题 |
| 状态提交与文件导出不原子 | commit 在 writeProjectRecord 前；失败后可能状态与文件不同步 | 设计导出重试、幂等和明确的恢复状态 |
| 并行评审失败恢复不足 | Promise.all 某角色失败可使阶段失败；无完整持久化逐任务恢复 | 保留成功结果并明确失败角色的重试语义 |
| 控制器全局串行队列 | 单实例 chain 覆盖命令，可使长任务阻塞其他 Session | 后续评估 Session 级串行与取消，不破坏 revision 一致性 |
| 缺少生产 Web 生命周期 | 当前脚本是隔离 mock 测试助手 | 原生 Web 验证通过后，再补最小启动/退出管理 |
| 版本和历史验收证据分散 | 源码、安装、包、旧报告版本不同 | 为候选提交、构建、安装和测试建立哈希对应 |
| 未发现 CI | 回归检查依赖本机环境 | 基线稳定后加入实际有效的自动化检查 |

### P3

| 项目 | 说明 | 建议 |
| --- | --- | --- |
| 旧运行时和大量产物残留 | 容易误启动和误判版本；本轮未证实正在运行 | 先建立清单及归属，不直接删除 |
| 仿真能力有限 | 固定回归基准，不是通用科研实验系统 | 作为能力边界明确展示，后续单独立项 |
| 计划模板仍需补充实验设计 | 不能等同完整自动化研究方案 | 后续评估科研内容质量和结构化验收 |

## 10. 下一阶段建议

以下只提出方案，本轮未实施。顺序按依赖关系排列；不建议直接恢复整个 rc.9 备份，也不建议继续扩展旧独立 Research Web。

| 顺序 / 优先级 | 任务目标 | 涉及模块 | 数据风险 | 验收标准 |
| --- | --- | --- | --- | --- |
| 1 / P1 | 建立 f8f3ddf 对应的可复现基线，隔离源码、lib 和旧运行副本 | build、protocol、lib、tests、依赖环境 | 低；应只写隔离生成目录 | 所有运行 JS、声明和测试均能追溯同一提交；不再引用遗留 rc.9；重新构建和当前测试结果完整记录 |
| 2 / P2，基础门槛 | 补齐实际目标 SDK 类型，解决 15 项 Lint | SDK 提取/准备脚本、sidebar-right 类型链、Lint | 低 | 依赖具体版本和来源有证据；Typecheck/Lint 均通过；不关闭规则、不伪造声明 |
| 3 / P1 | 完成 v1 权威图校验和数据写入边界设计 | controller、research state、storage、兼容测试 | 高；须使用合成数据和授权副本 | 缺失引用、环、无效选择可控报错；正常 v1 无损；明确单写入者或跨 Host 方案；不静默修复真实数据 |
| 4 / P2 | 解决导出故障、EIO 和并行任务恢复 | controller、fs export、coordinator、subagent adapter | 中；涉及状态和导出 | 隔离故障注入后 revision 可解释、导出可重试且幂等、成功评审不无谓丢失；EIO 有独立证据和结论 |
| 5 / P1 | 最小化接入官方 Web + 科研插件 | 官方 base/web-app bundle、插件 patch、隔离 profile | 低，前提是使用全新 home/userData/workspace | 原生聊天、模型设置、Session、Skills/MCP 与科研预设/右栏可共同工作；无独立工作台首页；不复制正式凭据 |
| 6 / P1 | 验证原生模型配置和科研模型继承 | 官方 Models/LLM、modelSelection、coordinator | 涉及凭据；优先 mock | 用合成 provider/model 切换验证聊天及新科研子任务一致；真实外部调用须另行授权；凭据不进入日志或计划 |
| 7 / P1 | 核对 UI V2 功能基线并保持横向树 | ResearchPanel、Transcript、成果视图、FlowCanvas/List | 应仅影响展示 | 逐项对照 rc.8 稳定功能；400px 和完整桌面真实 Electron 截图；父子真实坐标保持向右、同父分支纵向区分；聚焦/概览不改研究状态 |
| 8 / P2 | 补最小生产 Web 启动和退出管理 | 官方 CLI 启动封装、进程和端口归属 | 低至中；必须只管理自身子进程 | 启动信息可追溯、重复启动行为明确、退出释放自己的端口和子进程，不误结束正式 Desktop |
| 9 / P2 | 固化候选验收、CI 和历史产物清单 | 测试、候选包、证据、自动化 | 低 | 提交/构建/包/安装/验收哈希对应；旧证据保留；候选先在隔离 profile 验证，正式 profile 更新单独取得许可 |

第 7 项中的 UI V2 三视图属于用户长期功能约束，**不是当前 rc.5 已有事实**。后续应依据历史参考逐项对照，不能通过删除旧回归断言或将纵向 DAG 当作当前规范来降低验收标准。

若下一轮仅希望尽快验证方向，最小路径是：**先完成 1、2，明确单写入者和已知数据风险，再做隔离的 5、6、7；在此之前不把现有 dist 或旧运行目录作为发布候选。**

## 11. 最终结论

| 问题 | 回答 | 结论标记 |
| --- | --- | --- |
| GitHub 版本是否恢复成功？ | 是。当前 main、HEAD、origin/main 及实时 GitHub 默认分支均为 f8f3ddfe0b4677815905760ee44e90a2c56c7c86；检查阶段跟踪文件无差异。旧的未跟踪/忽略文件仍保留。 | 已证实 |
| 当前到底是什么网页端？ | 跟踪源码是 DSH 原生科研插件，没有独立整站 Web 入口；结构可用于官方 Web + 插件，但正式 web profile 尚未安装科研插件，也没有项目 Web 运行验收。 | 已证实结构；部署效果未验证 |
| 自动科研智能体保留什么？ | Preset、控制器、工作流、论文/PDF/OCR、文献、创新评审、原生子智能体、DAG/分支、确认/历史续接、v1 存储和计划导出代码均保留；仿真是固定基准。 | 已证实源码；实际运行未验证 |
| 模型机制是什么状态？ | 当前源码复用官方模型服务，官方实现支持第三方兼容路由、发现、搜索、选择和保存；科研模型继承修复仍在。 | 已证实静态链路；真实调用未验证 |
| 是否有重复前端？ | 当前跟踪源码未发现完整重复工作台；磁盘仍有旧独立工作台、原生 Web 候选和多个版本产物。 | 已证实 |
| 是否适合继续开发？ | 可以继续以此提交为源码基线，但当前生成/依赖/安装环境不足以直接形成可信发布基线，必须先处理版本混用和已知门槛。 | 基于源码和环境证据推断 |
| 下一步先做什么？ | 先建立当前提交对应的隔离、可追溯构建/测试基线，解决 SDK/Lint，再验证官方 Web + 插件；数据完整性、单写入者和 EIO 继续保留为明确问题。 | 基于审计证据建议 |

本报告没有将旧验收报告改写为本轮结论，没有宣称 F19、15 项 Lint 或 Windows EIO 已解决。审计检查未改变 GitHub、正式安装、profile、凭据或科研数据；用户随后授权的文件输出仅为本报告。


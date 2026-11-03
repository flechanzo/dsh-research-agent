# 可信开发基线与官方 DSH Desktop 实测报告（2026-11-02）

本轮已完成可执行的构建修复、全部现有测试和最新版官方 Nightly Desktop 的隔离实测。**不宣布完整通过**：常规 Typecheck、Lint、98 项测试及 Desktop 主流程已通过，但 `skipLibCheck=false` 的 Host 检查仍有 3 条官方 SDK 泛型声明错误；首次 D 盘场景还出现了官方文件替换 EIO，根因尚未定位。后续 C 盘独立场景完整通过，不能抹去前次失败。

所有结果均来自本轮运行。历史报告仅用于定位背景；旧 Web、旧 SDK 缓存和旧 Desktop 的结果没有被用作最终通过依据。下文状态使用“实际通过 / 实际失败 / 未执行 / 因环境阻塞无法验证”。

## 1. Git、插件和工作区身份

| 项目 | 本轮核验 |
| --- | --- |
| 仓库 | `D:\dsh-research-agent` |
| 分支 | `main` |
| 基础 HEAD | `f8f3ddfe0b4677815905760ee44e90a2c56c7c86` |
| 插件版本 | `0.1.5-rc.5`，未冒充后续 rc.8/rc.9 |
| 本轮修改 | 未提交的工作树修复；没有 commit、push 或发布 |
| 实际构建源码身份 | `fa8d0625c23ca8ff9ad8632ef5e046acd8a50b22e05cb188582662229797e287` |
| 构建时间（UTC） | `2026-11-02T09:51:02.773Z` |
| 构建 Node / pnpm | `v22.20.0` / `11.7.0` |
| Desktop 内置 Node / pnpm | `24.21.0` / `11.28.5` |

基础 HEAD 不能单独代表修复后的源码，因此同时保存输入文件逐项哈希、工作树 diff、新增文件快照及构建 manifest。初查已有未跟踪的 `.research-web`、`.web-runtime`、`.native-web-runtime`、缓存和历史审计资料；本轮没有启动、删除或继续开发它们，也没有把它们放入本轮源码快照。正式安装和科研记录未被当作测试夹具。

## 2. 官方最新版及本机版本差异

沿用本机已经选择的 **Nightly** 官方通道。最终更新源复核时间为 `2026-11-02T10:09:06.5864484Z`，来源为：

- [官方 Nightly win-x64 更新源](https://download.deepseek.com/dsh-desk/feeds/win-x64/nightly.yml)：`0.2.1-rc.5`。
- [官方 rc.5 Release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.2.1-rc.5)：2026-10-30 发布，用于交叉核对。
- 安装包来自更新源指定的 DeepSeek 官方下载域，原始 URL、SHA512、签名和发布者保存在 `installer-identity.json`。

| 核验项 | 用户正式安装 | 本轮官方测试副本 |
| --- | --- | --- |
| Desktop | `0.2.1-rc.3` | `0.2.1-rc.5` |
| Runtime | `0.2.1-rc.3` | `0.2.1-rc.5` |
| Electron | `44.7.0` | 实际进程 `44.7.0` |
| EXE | `F:\deepseek\DeepSeek Harness.exe` | `D:\dsh-research-agent\.acceptance\desktop-baseline-20261102\installer-unpacked\DeepSeek Harness.exe` |
| 签名 | Valid | Valid |
| 使用方式 | 保持运行，未升级 | 校验安装包后解压，未执行安装器 |
| 插件 engines.dsh / DSH peers | 修改前声明 rc.3 | 现已精确声明 rc.5 |

`stable.yml`、`latest.yml`、`alpha.yml` 的已试 URL 返回 404，故这些入口的版本**因环境阻塞无法验证**；这不能证明官方没有 Stable。GitHub 上另有 `dsh-v0.2.2-alpha.2`（2026-10-28），不能据此替代用户所选 Nightly Desktop 目标。

签名包内 metadata 的 buildCommit 为 `d4db512a969fccf0c5cc7ec8fe38e9c1d27af916`，dirty=false；GitHub rc.5 tag 对应另一提交树。本轮未能查询并精确匹配前者，故**不声称发布二进制与 GitHub tag 的源码 commit 已完全对应**。信任依据为官方更新源、匹配的 SHA512、有效发布者签名及运行版本实测。

安装包 SHA512（base64）：

`gu2dH+aTr678c0P8DGAH/h4B1GaWfQIjpsPrLjl/ukLrQIh6DLVq/MhX4FZvJ8o1GCMocOhix6XbLa6KmtjXXg==`

## 3. 真实运行路径与隔离范围

正式路径只读。成功验收场景的根目录：

`C:\Users\destiny\AppData\Local\Temp\dsh-official-desktop-20261102-r4eWmA`

| 资源 | 实际位置 |
| --- | --- |
| DSH_HOME | 上述根目录的 `home` |
| desktop profile | `home\profiles\desktop` |
| Electron userData | `electron-user` |
| Workspace 根目录 | `workspace`，通过官方 workspace-controller 显式配置 |
| 实际默认工作区 | `workspace\deepseek-harness\default-workspace` |
| Research 数据 | `research-data\research.json`，控制器显式配置 |
| 实际附件存储 | `home\attachments\v1`，仅合成 TXT/PDF/渲染 PNG |
| 附件暂存目录 | 根目录的 `attachments`；不是官方实际存储目录 |
| 证据 | `D:\dsh-research-agent\.acceptance\desktop-baseline-20261102\evidence\clean-c` |

首次另建的 D 盘场景位于 `.acceptance\desktop-baseline-20261102`，有自己的 home、profile、userData、workspace 和数据，未与 C 盘或正式环境共享可写 Session。

官方 EXE 启动后初始化 profile，正常退出，再通过**该副本自带官方 CLI**链接当前插件：

```powershell
$env:DSH_HOME='<隔离 home>'
& '<测试Desktop>\resources\runtime\cli\bin\dsh.cmd' plugin --profile desktop add D:\dsh-research-agent\packages\research-agent --ignore-scripts --offline
```

运行期检查了 profile 的 `link:` 依赖、三项 Bundle 注册、本地 junction 的真实路径、构建 manifest 和实际科研 Remote/UI 行为。实际加载路径为 `D:\dsh-research-agent\packages\research-agent`。

成功完整流程主进程 PID 为 28388；后续真实重启验证 PID 为 43048，移除插件后的重启 PID 为 42444。所有进程均通过 Playwright Electron 启动**官方 EXE**，页面为 `dsh-app://app/`。CIM 保存的 Host 命令行指向同一官方 `resources\app.asar\dsh\node_modules\@deepseek-ai\dsh-desktop-host\lib\index.js`、同一隔离 profile 和官方内置 runtime；没有使用独立 Web Host、自制 Electron 或源码内核代替。

## 4. 旧产物防误用和可复现构建

**实际通过。** 新构建流程先把既有 lib 移入 `.build\stage-*\previous-lib`，复制当前源码到干净 staging，再生成 Host、Client、Typert、TypeScript 声明。全部成功且源文件未发生变化时才发布新 lib；失败不会把旧 lib 放回可用路径。

`lib\build-manifest.json` 包含 HEAD、实际源码输入哈希、精确 SDK 版本、Node、时间、所有生成文件哈希。Typecheck、Lint、npm test 和 Vitest 配置均校验 manifest；直接运行 Vitest 也会拒绝过期产物。

五个隔离防护实验均实际通过：相同副本可用；篡改 Host 被拒绝；混入 `rc9-stale.js` 被拒绝；改变源码被拒绝；故意引入错误 SDK 导致 build 失败后，正式 lib 不存在，旧产物仍在 quarantine。失败实验没有污染实际插件。

冻结锁文件离线安装 `pnpm install --frozen-lockfile --ignore-scripts --offline` 已实际成功（519ms），随后 verify-build 成功。编译重生和离线依赖可复现已验证；没有宣称两次独立构建具有字节级确定性。

主要产物 SHA256：

| 文件（相对 lib） | SHA256 |
| --- | --- |
| `index.js` | `4472fb5eb899e5c12deb0739574aea549ae5b0b4149d20f874e76e7a3330bc60` |
| `client.js` | `d775312f3054a6a2e28ecd51e5bb67009ba5a31076588be43f05ad890f6b96c0` |
| `typert.host.js` | `5e22c06f9cbbca4d39cd91c270c849b2edddcddfb822122802e50a92445d4c9d` |
| `typert.remote-client.js` | `49329322f467bb40684a58f2e7b392065531e4c7da9eba9f242bea77b289160c` |
| `typert.host.d.ts` | `5e2d26ee86d0fe170dac8cd3f5854e67bdea334c57f40a5766ace57b8304c17d` |
| `typert.remote-client.d.ts` | `5b7bc85f1a5a7c7c1572c5d05071d0ccc5224083aa2b93abf69c05f004f57451` |
| `types\index.d.ts` | `dee107e446c87996b6e216e9219b87349a005026064bda22f86ef6d1ffc885f2` |

完整文件列表见构建 manifest，成功 Desktop 流程另存了同一份 `tested-build-manifest.json` 和 `plugin-source-link.json`。

## 5. SDK、类型与 Lint 修复

**原 15 项 Lint 问题实际修复。** 补齐同版本 `dsh-client-ui-dockkit`、sidebar/layout/settings/remote 等真实官方声明依赖；使用官方 Session/Workspace Remote augmentation；CSS 声明改用 Vite 自带类型。没有增加 any、伪造 DSH augmentation、修改 SDK、放宽 engines 或关闭 Lint 规则。

当前安装检查的 **110 个 `@deepseek-ai/dsh-*` 包均为精确 `0.2.1-rc.5`**。Cordis `4.0.5`、Schemastery `3.18.5`、LibreOffice Kit `0.1.5` 等是各自独立版本，不能要求它们使用 DSH 版本号。

为排除对旧 API 的猜测，额外从官方 npm registry 获取仅用于只读比较的 rc.3 声明包，逐包验证 dist.integrity；没有加入 node_modules、构建或 Desktop profile。对 Agent、Subagent、Agent Preset、Gateway、Session Controller、Workspace Controller、Sidebar Right、DockKit、Storage Domain、Typert Protocol 共 **10 包、154 个声明文件**逐项比较，忽略 CRLF 差异后均一致。本轮在这十包中没有发现需要变更调用签名的 API 差异；这不代表整个 Runtime 没有变化。

Desktop ASAR 和旧 `.target-sdk` 运行副本不包含 `.d.ts`。不能把“未扫描到类型文件”误写成“没有接口变化”；最终比较证据来自真实 npm 声明包。

| 检查 | 真实结果 |
| --- | --- |
| Host/Client 常规 Typecheck（项目现有 skipLibCheck=true） | **实际通过**，退出码均 0 |
| 类型感知 Lint | **实际通过**，退出码 0 |
| Client，skipLibCheck=false | **实际通过**，退出码 0 |
| Host，skipLibCheck=false | **实际失败**，退出码 2，3 条官方泛型声明错误 |

剩余诊断位于 `@deepseek-ai/dsh-session-projection/lib/types/index.d.ts:150-151`，为 TS2536、TS2344：`keyof SessionProjectionMap` 中的 `subagent` 没有完整进入 `SessionProjectionStateMap`。Subagent 的 Client map augmentation 被公开入口引入，但对应 Host state augmentation 在未公开导出的 projection 模块中。未使用裸内部路径、私造 map 或改 node_modules 消除报错。

该问题不能归为“科研源码类型已全部严格通过”，也不能仅据本轮结果说它由 rc.5 新引入。`npm run typecheck:sdk` 当前检查 Client；Host 的严格命令单独执行并保留原始输出：

```powershell
node node_modules/typescript/bin/tsc --noEmit --skipLibCheck false -p packages/research-agent/tsconfig.host.json
```

依赖安装曾被可选 LibreOffice WASM 下载卡住。核验官方 libreoffice-kit 的 optionalDependencies 后，仅在开发 workspace 的 `ignoredOptionalDependencies` 中跳过 WASM，并将平台设为 current。声明依赖完整保留，官方 Desktop 自带 Office runtime 未改。没有把这项下载问题与 PDF canvas 混为一谈。

## 6. F19 最小修复及全部自动化测试

先新增 8 个纯合成、内存存储回归，再修改研究状态输入校验。修复前实测 **7 失败、91 通过**；修复后 **14 文件、98 项全部通过**，其中原有 90 项、本轮新增 8 项。

F19 校验拒绝缺失 selected node/active branch、悬空 parent/artifact/branch 引用、key/id 不一致、自环及多节点 parent 环。保留 research domain v1 和历史 legacy web 来源值，不新增必填字段、不迁移正式数据。循环检测使用迭代 Set，避免无界递归。除此之外没有修改科研阶段、模型选择、导出或持久化流程。

最终测试文件统计：

| 文件 | 测试数 | 结果 |
| --- | --- | --- |
| `tests/adapters.spec.ts` | 2 | 实际通过 |
| `tests/compatibility.spec.ts` | 1 | 实际通过 |
| `tests/controller.spec.ts` | 7 | 实际通过 |
| `tests/graph-integrity.spec.ts` | 8 | 实际通过 |
| `tests/migration.spec.ts` | 2 | 实际通过 |
| `tests/refresh.spec.ts` | 1 | 实际通过 |
| `tests/research-coordinator.spec.ts` | 36 | 实际通过 |
| `tests/research.spec.ts` | 13 | 实际通过 |
| `tests/ui-regressions.spec.tsx` | 5 | 实际通过 |
| `tests/legacy-ui/research-branch-list.client.spec.tsx` | 2 | 实际通过 |
| `tests/legacy-ui/research-flow-canvas.client.spec.tsx` | 6 | 实际通过 |
| `tests/legacy-ui/research-panel-styles.client.spec.ts` | 4 | 实际通过 |
| `tests/legacy-ui/research-panel.client.spec.tsx` | 5 | 实际通过 |
| `tests/legacy-ui/research-session-store.client.spec.tsx` | 6 | 实际通过 |

覆盖 Controller、Coordinator、Workflow、DAG、历史续接、PDF/TXT、模型继承、取消、恢复、导出、UI 与 v1 兼容性。历史问题的证据层级如下：

| 问题 | 当前源码自动化 | 真实 Desktop |
| --- | --- | --- |
| F01/F08 状态刷新、revision | 实际通过 | 受控 sidecar 失败后 revision 正确刷新，下一命令成功；reload/重启恢复实际通过 |
| F02 模型继承 | 实际通过 | A→B、effort、默认 token 和 OCR 能力限制实际通过 |
| F04/F05/F06 分支、否决、重复引用 | 实际通过 | 分支显示/历史不变/引用唯一实际通过；Desktop 否决反馈分支未单独执行 |
| F07 PDF 页数 | 实际通过，含上限 | 两页正文检查 2/2 实际通过；Desktop 页数上限截断未单独执行 |
| F09 并行评审失败恢复 | 实际通过 | 成功的三角色并发评审实际通过；失败注入未执行 |
| F10/F11 队列、并发写入 | 实际通过 | 完整流程及 F01 连续命令实际通过；跨 Session 并发压力未执行 |
| F12 多分支计划覆盖 | 实际通过 | 两个独立文件且首文件哈希不变，实际通过 |
| F19 无效图及兼容性 | 8 个回归实际通过 | Desktop 使用有效合成图；未向其数据库写入损坏记录 |
| 子智能体取消 | 实际通过 | Desktop 中断注入未执行 |

## 7. 官方 Desktop 原生界面

以下均为真实 Electron 自动化，不是人工补签，也不是仅有窗口截图：

| 验证项目 | 结果及证据 |
| --- | --- |
| 官方主界面、原生输入框 | **实际通过**，本地 Mock 聊天成功 |
| 原生模型选择器 | **实际通过**，A→B 切换并影响后续实际调用 |
| 原生模型设置 | **实际通过**，进入“设置 → 模型”；未输入或读取 API Key；因真实 provider 禁用，模型配置列表为空 |
| 原生会话列表与切换 | **实际通过**，普通会话与科研会话相互切换，研究节点保持一致 |
| Agent 选择器“自动科研” | **实际通过**，通过原生菜单创建科研会话 |
| 右侧科研面板与 Remote | **实际通过**，上传、执行、选择节点、导出及错误恢复均有真实交互 |
| 正常/窄布局与滚动 | **实际通过**，保存 1440×960、880×760 截图及分支区域截图；聊天输入仍可用 |
| 横向树 | **实际通过**，真实 DOM 的 13 节点坐标中所有 child x 大于 parent x，兄弟分支 y 不同；树保持水平滚动 |
| 移除插件后普通功能 | **实际通过**，官方 CLI 去掉 dependency/Bundle，重新启动，菜单无“自动科研”、无科研面板，普通聊天成功 |

官方 pnpm remove 不接受 `--offline --ignore-scripts` 参数；首次命令实际失败后，改用受支持的无额外参数 remove，并通过 npm_config 指定离线和禁用脚本。pnpm 保留了本地 junction，但 profile dependency 和 Bundle 已移除，实际客户端也不加载科研插件；不能用 junction 的物理存在误判启用状态。首次错误断言和修正后的真实结果均保留。

当前 rc.5 的集成内容/分支/节点详情导航、map/list 与横向树不等于后续 UI V2 的完整三视图。**后续专用分支聚焦/全局概览切换等尚未实现，不记为通过，也未在本轮新增。**

## 8. 科研工作流、DAG、恢复和文件

C 盘成功会话：`session-b3f5e656-3210-41d3-8078-90035726a4ab`，原生标题 `DSH科研验收-final-rc5`。

**实际通过**：合成 TXT 上传 → 读取与摘要 → 问题提炼 → 五来源 Mock 文献 → 创新生成/评分 → 完善 → 定向检索 → method/novelty/reproducibility 多评审 → 计划预览 → 点击人工确认写入。每阶段都经过真实 Desktop Host 和科研 Remote，没有直接写数据库跳过交互。

实际文件在隔离工作区的：

```text
research-projects\session-b3f5e656-3210-41d3-8078-90035726a4ab\plans\branch-1\revision-10\research-plan.md
research-projects\session-b3f5e656-3210-41d3-8078-90035726a4ab\plans\branch-3\revision-15\research-plan.md
```

首份 2704 bytes，第二份路径独立；后续分支写入前后首文件 SHA256 一致。历史节点逐项深比较未改变，每节点 artifactRefs 无重复。这里的“无重复”指实体引用和导出行为；Mock 文本本身故意重复，不能据此宣称真实科研语义去重已验证。

F01 在隔离 sidecar 路径放入受控同名目录触发真实写失败：主状态 revision 11→12 已提交，UI 同步到真实状态；恢复夹具后下一命令成功到 13，无 revision 循环。随后导出至 revision 15。测试只改本轮合成 sidecar，未触碰正式记录。

页面 reload 成功恢复；随后**真正退出整个 EXE、重新启动**，再次从原生会话列表打开，科研 row 与已保存 `persisted-row.json` 深度相等，revision=15，selectedNodeId 一致。该证据独立于仅前端 reload。

首次 D 盘主流程在 node-3 附近出现 `ReplaceFileW EIO (Win32 1175)`：主 research.json 已提交而导出 sidecar 失败。该场景为**实际失败，环境/官方文件系统层原因未定**，不能据 C 盘通过宣布原问题已修复。重建完全独立 C 盘环境后完整流程没有出现自然 EIO；F01 受控错误除外。

## 9. 模型路由与 OCR

| 实测阶段 | Provider / 模型 | reasoningEffort | maxTokens | 结果 |
| --- | --- | --- | --- | --- |
| 初始原生聊天 | research-mock / A | fixture-low | 768 | 实际通过 |
| UI 选择 B 后的 9 个科研子任务 | research-mock / B | fixture-high | 2048 | 实际通过，均为独立 child Session |
| 两页 PDF 文本提取后摘要 | research-mock / B | fixture-high | 2048 | 实际通过，prompt 含合成 PDF 标记且 imageBlockCount=0 |
| 扫描 PDF + B（text only） | 当前 B 能力校验 | — | — | 实际通过：返回可见 PDF_OCR_FAILED / does not support image input，未调用图像模型 |
| 扫描 PDF + A（text/image） | research-mock / A | fixture-low | 768 | 实际通过：真实 OCR child 收到 1 个 image block，之后摘要 child 为文本 |

maxTokens 的正确语义：未显式配置时，A 的 provider 默认 768 不应被当成父 creation options 的显式限制；切 B 后使用 B 默认 2048。官方 `parentAgentOptionsForDelegation` 只传递显式 creation maxTokens，不复制旧模型 materialized 默认。本轮曾错误断言 B 必须继承 768，完整工作流因此被测试断言中止；已修正测试预期，没有为错误断言改业务逻辑。显式 parent maxTokens=512 的继承由现有单测验证，**Desktop 显式 token 上限未单独执行**。

完整流程早期 trace 的 `images` 是字符串检索结果，不能证明存在图像；最终 PDF/OCR 专项改为递归统计真实 `type=image` 内容块并保存模型解析 trace。因此 OCR 证据使用 `native-final/model-routing.jsonl`，不使用旧布尔字段。

所有科研和普通聊天调用均走本地 research-mock。没有调用收费模型。文献响应也是本地合成数据；本轮不评价真实搜索可用性、OCR 识别准确率或科研结论质量。仿真在单测中覆盖，Desktop 此轮选择直接输出计划，没有执行真实科研实验。

## 10. 进程、端口与正式环境不变性

**实际通过。** 每次真实启动/关闭记录测试 EXE 精确路径、所属 Host/renderer 子树和监听端口。原生补充验收及移除后验收的 `processes-after-close.json` 均为 `processes=[]`、`listeners=[]`；最终独立 CIM 复核无本轮测试程序残留。

正式主进程 PID 28428 仍在运行；没有按名称批量结束 Node/Electron。仅在核验完整命令后停止过两次本轮卡住的 pnpm 安装进程。官方测试安装 EXE/ASAR 未被改写，正式安装前后哈希相同：

| 对象 | SHA256 |
| --- | --- |
| 正式 EXE | `fd7d298f4ba03ee9bab1719a892afeaef5c09bf50c574a592a64c85f64574c0c` |
| 正式 ASAR | `04b32e3a872826ba15cfb2081c6a929a8d4ecaa65e09a2543e5a6b30e2eff1f0` |
| 测试 EXE | `7ae939b5a82b220fbd8ad04dfbafaaedb5a49ab43dc884a5db6381f678dd0cc4` |
| 测试 ASAR | `e1b6f25fa937da98086c3e77af77aa14791105963c4d337a1c42179d232c6915` |

启动环境清除了继承的 KEY/TOKEN/SECRET/PASSWORD 和 DSH_* 变量，并禁用真实模型 provider、标题模型。未读取凭据文件、复制真实 API Key、上传私人论文、修改正式 profile 或科研 JSON。官方账号 UI 仍可能显示系统已有账号摘要，独立 DSH_HOME 不等同于系统账号登出隔离；未展开或导出密钥，最终模型页证据不含密钥值。隔离数据、安装副本和原始证据保留供复核，C profile 最终已移除科研 Bundle。

退出时官方程序 stderr 有本地连接关闭的 UND_ERR_SOCKET 日志；正常 close 返回、进程与监听均消失。该日志保留，不用“日志完全无警告”描述本轮。

## 11. 命令与可复核证据

证据根：`D:\dsh-research-agent\.acceptance\desktop-baseline-20261102`。下表路径相对该根；完整 SHA256 索引见 `evidence-index.json`，源码改动及新增文件快照见 `evidence/source-snapshot`。

| 命令 / 操作 | 状态 | 主要证据 |
| --- | --- | --- |
| pnpm install --frozen-lockfile --ignore-scripts --offline | 实际通过 | install-frozen-offline.log |
| node scripts/build.mjs | 实际通过 | build-current.log、final-build-manifest.json |
| node scripts/validate-baseline.mjs delivered | 实际通过 | checks-delivered-command.log、evidence/checks-delivered.json、vitest-delivered.json |
| Client 严格 tsc | 实际通过 | evidence/sdk-current-client.log（空输出）、sdk-current-status.json |
| Host 严格 tsc | 实际失败 | evidence/sdk-current-host.log、sdk-current-status.json |
| node scripts/check-build-guard.mjs | 实际通过 | evidence/build-guard.json、build-guard-current.log |
| 官方 CLI add | 实际通过 | plugin-install-c.log、clean-c/final-rc5/plugin-source-link.json |
| node tests/acceptance/desktop-regression.mjs final-rc5（设置 C context） | 实际通过 | desktop-current-command.log、evidence/clean-c/final-rc5 |
| node tests/acceptance/desktop-native-smoke.mjs | 实际通过 | native-final-command.log、evidence/clean-c/native-final |
| 官方 CLI remove + disabled smoke | 实际通过 | plugin-remove-corrected.log、disabled-final-command.log、evidence/clean-c/plugin-disabled-final |
| 原 D 盘真实流程 | 实际失败 | desktop-regression-command.log、evidence/desktop-regression.log、desktop-failure.png |
| 首次 C 流程错误 tokens 断言 | 实际失败（测试预期错误） | desktop-regression-c-command.log、evidence/clean-c/workflow |
| remove 不支持的 CLI 参数 | 实际失败（参数错误） | plugin-remove.log |
| remove 后 junction 必须消失的首次断言 | 实际失败（判定依据错误） | disabled-smoke-command.log、evidence/clean-c/plugin-removed |
| git diff --check、最终 verify-build | 实际通过 | evidence/final-review.json、final-review.log |

截图索引：

- `evidence/clean-c/final-rc5/native-model-B.png`：原生模型 B。
- `evidence/clean-c/final-rc5/research-plan-first.png`：首次真实计划。
- `evidence/clean-c/final-rc5/research-normal.png`、`research-narrow.png`：正常/窄窗口。
- `evidence/clean-c/native-final/restart-restored.png`：真实 EXE 重启恢复。
- `evidence/clean-c/native-final/settings.png`：官方模型设置页。
- `evidence/clean-c/native-final/branch-tree.png`：原生聊天旁的横向分支画布。
- `evidence/clean-c/native-final/embedded-two-pages.png`：两页 PDF 正文。
- `evidence/clean-c/native-final/scan-model-B.png`：B 图像能力限制。
- `evidence/clean-c/native-final/scan-model-A.png`：A 的真实 OCR 调用。
- `evidence/clean-c/plugin-disabled-final/ordinary-after-removal.png`：移除科研插件后的普通聊天。

## 12. 最终 14 项要求对应结论与未通过门槛

| 用户报告项 | 结论 |
| --- | --- |
| 1 Git Commit、插件版本 | 实际通过，HEAD + 工作树源码哈希双重标识 |
| 2 最新版官方来源 | 实际通过，所选 Nightly rc.5；Stable 入口不可核验已单列 |
| 3 本机与目标差异 | 实际通过，正式 rc.3、隔离目标 rc.5 |
| 4 实际 EXE、Runtime、profile | 实际通过，身份与 Host 命令行均有证据 |
| 5 旧生成文件混用 | 实际通过，干净 staging + fail-closed guard |
| 6 SDK 与 Lint | Lint 和 Client 严格类型实际通过；Host 严格 SDK 实际失败 |
| 7 Build、Typecheck、Lint、Vitest | 常规检查实际通过，14 文件/98 项 |
| 8 真实 Desktop 加载 | 实际通过，官方 EXE + 当前插件真实路径 |
| 9 原生“自动科研”预设 | 实际通过 |
| 10 真实科研流程 | C 盘场景实际通过；D 盘原场景实际失败 |
| 11 A→B 与子智能体继承 | 实际通过；显式 token 上限 Desktop 专项未执行 |
| 12 持久化、DAG、导出 | 实际通过，真实重启、历史不变、双分支文件不覆盖 |
| 13 未通过项与阻塞 | Host SDK 泛型错误；D 盘 EIO 根因未定；Stable 版本无法由已试入口核验 |
| 14 长期验收规范 | 实际通过，已写入 DESKTOP_VALIDATION.md 和 DEVELOPMENT.md |

后续仍需处理 Host 官方 SDK 严格声明错误，以及 D 盘文件替换失败的根因；不通过伪造类型或静默忽略失败降低门槛。本轮不扩展科研功能、不制作正式安装包、不推送或发布。

## 13. 长期规范交付

[DESKTOP_VALIDATION.md](DESKTOP_VALIDATION.md) 已规定：以后每次修改必须在用户所选官方通道的最新版 Desktop 做最终回归；一般修改检查 Build/Typecheck/Lint/Vitest/原生冒烟；模型、工作流、UI、DSH 升级分别增加对应的实际 Desktop 验证。每轮重建隔离环境，记录版本来源、真实 EXE/Host、源码与产物哈希、模型路由、数据/文件、截图、失败和进程清理。

README、DEVELOPMENT 和两份 COMPATIBILITY 已链接本轮基线或指出历史结论不可沿用。历史文档未被改写成本轮成功报告。本轮至此停止。

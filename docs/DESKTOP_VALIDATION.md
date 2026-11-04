# 官方 Desktop 最终回归规范

今后每次修改 dsh-research-agent，都必须在用户所选官方通道的最新版 DSH Desktop 中完成最终回归。当前方向仅为官方 Desktop、对应的官方原生 Web UI 和独立科研 Bundle；独立 Research Web、Mock Host 与组件测试均不能替代真实 Desktop。

## 每轮先确定目标

记录核验日期、官方仓库 Release 和官方更新源。分别记录可核验的 Stable/Nightly 等通道版本与当前安装通道，不凭版本排序或历史报告猜测最新版。沿用已选择通道；变更通道先获得用户选择。记录安装版本、内置 Runtime、Electron、Node、EXE 路径、签名发布者和哈希。目标升级后重新检查 Cordis Bundle、Agent Preset、Remote API、Client 扩展点、Subagent 和 research v1 存储兼容，不得只放宽 engines.dsh。

本轮 2026-11-02 的目标是安装环境原有 Nightly 通道的 0.2.1-rc.5。官方更新源与签名实测证据在 .acceptance/desktop-baseline-20261102；GitHub 的 alpha 发布不能直接当作该通道 Desktop。后续每轮重新核验。

## 可复现构建

运行 pnpm install --frozen-lockfile --ignore-scripts，再执行 npm run build。build 在 .build/stage-* 复制当前源码，隔离旧 lib，重新生成 Host、Client、Typert 与声明，只在全程成功且源码未改变后发布新 lib。失败时旧产物留在 previous-lib，不自动恢复为可用 lib。

lib/build-manifest.json 记录 HEAD、实际工作树输入 SHA256、精确 SDK、构建 Node、时间与全部生成文件哈希。HEAD 可能包含未提交修改，因此同时保留 Git diff 和源码哈希。Typecheck、Lint、Vitest 配置及 verify:build 检查新鲜度；直接运行 Vitest 也会拒绝过期构建。不得使用历史 rc.9 文件或复制旧报告代替当前构建。

## 必须完成的检查

| 修改类型 | 必需检查 |
| --- | --- |
| 一般代码 | Build、Typecheck、Lint、相关 Vitest、真实 Desktop 插件加载和原生聊天冒烟 |
| 模型调用 | 原生模型选择器、A→B 动态切换、真实 Agent/Subagent 路由、reasoningEffort/maxTokens 与 OCR 能力限制 |
| 科研流程 | 真实 Desktop 阶段推进、人工确认、状态保存及重启恢复、DAG 选择、历史续接、错误恢复与取消 |
| UI | 真实窗口正常/窄尺寸截图、右侧面板、滚动/点击/分支展示及官方聊天布局 |
| DSH 升级 | 官方 SDK、注册/预设/Remote/Client/Storage 接口与完整 Desktop 回归 |

运行 npm run typecheck:sdk 单独检查 skipLibCheck=false。SDK 引用了只列为 devDependency 的类型包时，在工作区补齐同版本官方依赖和真实第三方类型；使用正式 Remote augmentation 和构建工具 CSS 类型。不允许伪造声明、any、关闭 Lint 或混用 DSH 版本。上游声明确有缺陷时保留原始诊断并列为阻塞，不能声称完整类型验证通过。

## 真实 Desktop 隔离与证据

通过官方来源取得目标程序，核对更新源 SHA512 和 Authenticode，再解压到独立测试目录。不得运行安装器覆盖正式应用、修改 EXE/ASAR 或迁移正式 profile。

每轮新建独立 DSH_HOME、desktop profile、Electron userData、workspace、科研 JSON 和附件目录。显式固定 workspace-controller.documentsDirectory；不能只改 DSH_HOME。清除继承的凭据环境变量，禁用收费 provider，仅使用合成 TXT/PDF 和本地 Mock。不得复制私人论文、正式 API Key、科研记录或可写 Session。

在第一次启动官方 EXE 前，用 tests/acceptance/desktop-isolation.mjs 创建带归属标识的隔离根目录，完成 DSH_HOME、profile、userData、workspace 及 workspace-controller.documentsDirectory 配置和运行时路径守卫。任何缺失、默认回退或解析后的路径逃逸都拒绝启动或写入。使用官方内置 CLI 的 plugin --profile desktop add <本地插件目录> --ignore-scripts 安装插件；CLI 同样使用隔离 DSH_HOME。支持的开发链接优先；若只能用临时测试包，包只用于隔离验收，不发布。保存 CLI 安装记录、profile 包与 Bundle 元数据、插件真实路径和 build manifest。若链接无法按官方共享包机制解析 peer，改用受支持的 file 包方式并重新核验。

验证原生输入框、模型选择器/设置、会话切换、“自动科研”预设和科研面板。执行上传、摘要、问题、文献、创新评估、完善、定向检索、评审、计划预览与确认导出；核验无重复、历史不变、多分支文件不覆盖、重新加载和真实退出重启恢复。单独验证禁用插件后普通功能。UI V2 未实现项逐项标注，不借相似功能宣布通过。

保存实际启动版本/EXE/Host 来源、隔离路径、命令与退出码、模型真实路由、日志和截图。窗口截图不等于插件加载成功，组件 Mock 也不等于 Desktop 通过。保留首次失败及重试记录，文件系统错误不能静默忽略。退出后按本轮精确进程树/可执行路径检查端口和孤儿 Host；禁止按名称杀掉所有 Node/Electron 或正式 Desktop。

## 验收结论

每项只标注“实际通过 / 实际失败 / 未执行 / 因环境阻塞无法验证”。自动化和人工辅助分别记录。最新版无法获取、启动或存在未跨越的真实流程门槛时，先完成可执行部分，再明确报告未完整通过。只有当前源码、完整检查、已核验最新官方 EXE、插件/Agent/科研流程/状态/DAG/模型继承均验证成功，且未改正式环境时，才可宣布完整通过。

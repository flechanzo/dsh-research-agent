# 独立开发

使用 D:\dsh-research-agent 开发，不修改 D:\deepseek-harness 或 F:\deepseek。工程已初始化 Git，没有远程仓库。把 .isolated、.target-sdk、node_modules、.env、dist 和本地备份留在 Git 外；科研数据不进入源码仓库。

## 构建与测试

需要 PowerShell 7、Node 22.19+ 和 pnpm。依赖锁定于 pnpm-lock.yaml，官方 DSH 包均为目标 0.2.1-rc.3。

```powershell
Set-Location D:\dsh-research-agent
pnpm install --frozen-lockfile
pnpm run build
pnpm run typecheck
pnpm test
pnpm run pack
```

本次实测构建命令为 node scripts/build.mjs，测试命令为 node node_modules/vitest/vitest.mjs run --reporter=dot，打包命令为 npm pack ./packages/research-agent --pack-destination dist --json。pnpm scripts 映射到同一实现。测试依赖先构建：控制器测试导入 lib，协议声明由构建生成。

build 从公开 npm 协议声明生成临时 packages/.protocol-sdk 镜像，让目标 WorkspaceTypertGenerator 发现 Remote/RemoteError 符号，然后严格检查 Host/Client 并生成声明，输出 Host ESM 和目标 ModuleLoader 客户端 bundle。镜像和 .target-sdk 都不发布；当前构建不依赖安装目录或旧仓库。

## 代码导航

| 位置 | 职责 |
| --- | --- |
| packages/research-agent/src/workflows/research.ts | 不可变 DAG、阶段、分支、记忆 |
| research-coordinator.ts | PDF/OCR、五索引、模型角色、评分和计划 |
| research-simulation.ts | 固定 OLS 示例 |
| subagent-adapter.ts | 0.2 activation 与取消清理 |
| src/controller.ts、types.ts | 配置、RPC、revision、存储和导出 |
| src/client/ | 面板、图、正文、locale |
| presets/research.patch.yml | 原研究 Prompt 和工具组成 |
| scripts/manage-plugin.ps1 | 官方 CLI 的事务备份、安装和回滚 |
| scripts/migrate-data.mjs | 幂等科研 sidecar 复制 |
| tests/ | 54 项行为、PDF、存储、取消、迁移测试及 Mock |

本次提取审计工具 extract-source.mjs、extract-target-sdk.mjs、backup-initial.mjs 是迁移记录工具，含本机审计路径，不属于日常构建。不要用 extract-source 覆盖继续开发的源码。

## 开发部署

优先将预构建包安装到独立的 .isolated/home，使用目标内置 CLI。管理脚本的 -PackagePath 也可以传构建后的 packages/research-agent 本地目录，交由官方 CLI 处理本地包；本次已实际验证的是 tgz 方式。修改源码后必须 build，发布新 tgz 时增加 package.json version，随后运行 update.ps1。没有为独立包承诺 HMR；可靠方式是更新后重启该隔离 Host，再刷新浏览器。

scripts/start-isolated.ps1 从 tests/support 生成 Mock overlay，禁用真实模型提供者、删除本进程中的常见凭据环境变量，使用本地合成模型/五索引数据和浏览器目录选择器。先给 .isolated/home/profiles/web 安装插件再启动；本机验收 home 已配置好。不要把真实 profile 的 .env 或凭据复制进去。它会把带访问令牌的本地 URL 写入被忽略的 .isolated/url.txt，不要共享该文件。

```powershell
.\update.ps1 -InstallDir F:\deepseek -DshHome D:\dsh-research-agent\.isolated\home -Profile web -PackagePath D:\dsh-research-agent\dist\dsh-research-agent-0.1.4.tgz
.\scripts\start-isolated.ps1
# 在另一个 PowerShell 中执行：
node scripts/full-flow.mjs
node scripts/stage-flow.mjs
node scripts/branch-flow.mjs
```

浏览器脚本使用 Playwright + 已安装 Edge 的临时上下文，不读取用户浏览器资料。full-flow 创建新任务；stage-flow 推进其检查点并明确点击写入；branch-flow 对该计划执行恢复和分支仿真。分支脚本针对这套合成流程的节点编号，不适用于任意用户任务。测试输出工作区以实际 Session cwd 为准，不等于 DSH_HOME；给新隔离实例指定专用工作区后再做新验收。

## 使用 Codex 继续开发

可给 Codex 这样的任务：“在这个独立工程中修改某个科研阶段，先读 MIGRATION_REPORT.md 和对应测试，保持 research v1 兼容，不改旧仓库或 Desktop ASAR。增加与行为匹配的测试，构建新的版本包，在隔离 profile 验证后更新实际 desktop。”

改持久化字段时保留已有 v1 记录兼容并增加迁移测试；改 Remote 后重生成 Typert；改 UI 同时更新 locales.ts；改子代理必须测试模型继承、取消和清理；改 PDF/索引要保留混合页和部分来源失败处理。真实模型验收应使用明确允许的测试材料，不能将私人论文或凭据放入测试包。

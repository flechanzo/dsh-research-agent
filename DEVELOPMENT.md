# 独立开发

使用 D:\dsh-research-agent 开发。旧仓库 D:\deepseek-harness 和 F:\deepseek 安装文件只读。源码不包含科研数据、模型凭据或正式 profile；.acceptance、.isolated、.target-sdk、node_modules、.env、dist 和本地备份不进入 Git。

## 构建与测试

需要 Node 22.19+ 和 pnpm，目标 DSH SDK 精确为 0.2.1-rc.3。未获网络许可时只能使用已安装依赖或离线缓存，不能静默联网补包。

```powershell
Set-Location D:\dsh-research-agent
node scripts/build.mjs
npm run typecheck
node node_modules/vitest/vitest.mjs run
npm run lint
npm pack ./packages/research-agent --pack-destination dist --offline --json
```

测试必须先构建：controller、migration 和兼容性测试导入 lib。build 生成临时 packages/.protocol-sdk、Typert 协议和声明，再输出 Host ESM 与目标 ModuleLoader 客户端 bundle；不依赖旧仓库。最终验收运行 13 个文件、89 项测试，具体状态以 TEST_REPORT.md 为准。当前 lint 因缺失目标 dockkit SDK 声明失败，不要关闭类型规则掩盖它。

UI 单测的宿主 primitives 是明确的替身，插件组件实际运行。真实宿主 UI 由 tests/acceptance/electron-candidate.mjs 验证。旧 74 项、新 54 项与当前断言对照可由 tests/acceptance/coverage-map.mjs 重新生成；该工具只读取旧仓库和独立仓库的 4245985 提交。

## 代码导航

| 位置 | 职责 |
| --- | --- |
| packages/research-agent/src/workflows/research.ts | 不可变 DAG、阶段、分支、反馈 |
| research-coordinator.ts | PDF/OCR、五索引、模型角色、评分、计划 |
| research-simulation.ts | 固定五点 OLS 示例 |
| subagent-adapter.ts | 0.2 activation、取消与清理 |
| src/controller.ts、types.ts | 配置、RPC、revision、存储和导出 |
| src/client/ | 面板、图、正文、共享缓存、locale |
| tests/legacy-ui/ | 恢复及适配的旧 UI/样式回归 |
| tests/acceptance/ | 正式 Electron、五条 v1 副本、基线与覆盖证据工具 |
| scripts/manage-plugin.ps1 | 官方 CLI 的备份、安装和回滚 |
| scripts/migrate-data.mjs | 默认 dry-run 的科研 sidecar 复制 |

## 隔离验收

本轮目录为 .acceptance/run-20261027-RV7z7X。home、electron-user、workspace 分离；home/profiles/desktop/cordis.patch.yml 禁用真实模型与标题生成，加载 tests/support/mock.mjs，使用 research-mock 模型和 research-fixture 文献 provider。workspace-controller.documentsDirectory 显式指向专用 workspace，不能只设 DSH_HOME 就假定 Session cwd 已隔离。

当前可在已准备的隔离环境重跑：

```powershell
$c = Get-Content .acceptance/current.json -Raw | ConvertFrom-Json
$env:DSH_HOME = $c.home
$env:npm_config_offline = 'true'
& 'F:\deepseek\resources\runtime\cli\bin\dsh.cmd' plugin --profile desktop add D:\dsh-research-agent\dist\dsh-research-agent-0.1.5-rc.3.tgz --ignore-scripts
node tests/acceptance/electron-candidate.mjs
node tests/acceptance/legacy-records.mjs
```

这些脚本仅针对本机隔离布局和合成节点编号。Electron 脚本清除凭据环境变量，使用独立 userData，退出时关闭自己启动的实例；F01 只临时遮挡新建合成 Session 的导出文件，并在 finally 恢复。真实 v1 测试只修改新建副本。路径与前提见 tests/acceptance/README.md；不得将 current.json 改指向正式 home 或现有用户工作区。

早期 scripts/start-isolated.ps1 及 Web 流程是上一轮迁移工具，不能直接作为本轮隔离保证：它们未显式固定 Session 工作区。新的验收使用上述正式 Electron 路径。extract-source.mjs、extract-target-sdk.mjs、backup-initial.mjs 也是一次性迁移工具，不要用它们覆盖持续开发的源码。

## 持久化与发布

改持久化值域时同步 Host、Remote 声明及兼容文档；research v1 的历史 web 值必须读后保留，在搜索执行层展开。改子代理要覆盖 pending 模型选择、OCR、取消和清理；改 PDF/索引要保留混合页、检查页数和部分来源失败测试。固定 OLS 不等于科研验证。

新版本先构建、测试、生成 tgz，再用官方 CLI 安装到隔离 profile。验收结果与当前候选对应，不自动更新正式 profile。本次 0.1.5-rc.3 仍有 lint、F19 和外部服务验证缺口；保持正式 0.1.4 的现状不代表它已经通过最终验收。后续部署应在这些缺口得到明确处理后单独决定。

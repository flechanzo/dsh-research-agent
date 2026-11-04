# 开发与验证

唯一方向为最新版官方 DSH Desktop + 对应的官方原生 Web UI + 独立自动科研 Bundle。不得重建独立 Research Web。后续每次修改均遵守 [官方 Desktop 最终回归规范](docs/DESKTOP_VALIDATION.md)，以真实 Electron 运行作为最终验收。

当前插件为 0.1.6-rc.1，官方 SDK 与目标 Nightly Desktop 精确匹配 0.2.1-rc.5。本轮状态见 docs/UI_DESKTOP_RELEASE_2026-11-03.md。兼容性结论和未通过门槛以 docs/DEVELOPMENT_BASELINE_2026-11-02.md 为准，不沿用历史 TEST_REPORT.md 的通过结论。

使用 Node 22.19+、pnpm 11.7.0 与锁文件：

~~~powershell
pnpm install --frozen-lockfile --ignore-scripts
npm run build
npm run typecheck
npm run typecheck:sdk
npm run lint
npm test
npm run verify:build
~~~

build 先隔离旧 lib，再在 .build/stage-* 干净编译。失败不会回退到旧产物。Typecheck/Lint/Vitest 会拒绝源码或 SDK 与 manifest 不符的构建。新声明来源于精确版本官方 SDK，不编辑 node_modules 掩盖错误。

每次源码更新完成后，必须重新构建并打包，先用 `update.ps1 -DryRun` 核对正式 Desktop 目标，再安装到对应 Desktop profile；安装验证完成后提交并推送当前 Git 分支到 GitHub。安装和推送都属于更新完成条件。

官方安装目录只读。本地验收目录、缓存、.build、node_modules 与凭据不进入 Git。不得用历史 .acceptance/current.json 重用 profile 作为新一轮验证。新轮次创建独立目录，记录来源、哈希、EXE、Runtime、profile、真实插件路径、模型路由、测试日志与截图。现有日期脚本属于本轮证据工具，重新用于另一轮前须创建新 context 并重新核验目标版本。

research domain 仍为 v1，保留历史 web 来源值。F19 校验只拒绝引用损坏或含环的记录，不新增必填字段、不迁移或写入正式数据。涉及持久化的后续变更必须先有隔离兼容回归用例，再最小修复。

默认仅做隔离验证；用户明确授权安装或推送后，可以通过官方安装器、插件 CLI 与 Git 执行相应操作。禁止手工修改 EXE/ASAR，禁止把凭据、缓存和私人科研数据提交到 Git。本轮未授权付费模型调用。

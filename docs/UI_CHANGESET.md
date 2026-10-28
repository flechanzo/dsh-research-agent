# UI rc.5 变更追踪

- 基线提交：`4245985`（独立候选工作区已有迁移修复）。
- UI 交付包：`dist/dsh-research-agent-0.1.5-rc.5.tgz`。
- 主要 UI 源码：`ResearchPanel.tsx`、`ResearchPanel.module.css`、`ResearchFlowCanvas.tsx`、`ResearchFlowCanvas.module.css`、`locales.ts`。
- 回归测试：`tests/ui-regressions.spec.tsx` 新增 F19 环图渲染用例。
- 验收文档：`docs/UI_AUDIT.md`、`docs/UI_DESIGN.md`、`docs/UI_TEST_REPORT.md`、`docs/UI_CHANGELOG.md`。
- 真实截图：`docs/ui-screenshots/after-electron-rc5.png`、`docs/ui-screenshots/after-electron-rc5-running.png`。

当前执行环境对 `.git/refs` 只有读权限，创建 `codex/` 分支被 Git 拒绝；因此没有伪造 commit 或覆盖已有候选历史。本文件和上述固定版本包、测试证据提供了可独立追踪的交付边界。

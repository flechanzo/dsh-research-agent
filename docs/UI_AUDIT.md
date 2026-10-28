# DSH Research Workspace UI 审计

日期：2026-10-28（Asia/Shanghai）

对象：dsh-research-agent@0.1.5-rc.5，目标 DSH Desktop 0.2.1-rc.3。审计读取了 packages/research-agent/src/client/ 的 ResearchPanel、ResearchTitle、ResearchTranscriptMain、ResearchFlowCanvas、ResearchBranchList、research-session-store、CSS Modules 与中英文 locale，并在隔离 DSH_HOME、Electron userData 和 Session workspace 中启动真实 Electron。

改造前证据：

- [空态截图](ui-screenshots/before-electron-start.png)
- [完成态截图](ui-screenshots/before-electron-completed.png)
- 原隔离 DOM：[electron-final-dom.txt](ui-screenshots/after-electron-rc5-dom.txt)

## 真实问题

1. ResearchPanel 以单列连续放置标题、主会话投影、分支图、历史时间线、节点详情和阶段控件。长计划完成后，确认/写入按钮位于内容尾部，首屏无法判断下一步。
2. 顶部只有阶段和状态，缺少当前分支、选中节点的阶段路径以及“内容/分支/详情”的面板内导航。普通视图切换和科研状态操作在视觉上距离过近。
3. ResearchFlowCanvas 在窄右侧面板中使用较大的固定画布，画布、Markdown 和根面板同时滚动时容易产生双重滚动感；列表视图虽可用，但缺少明确的安全降级提示。
4. Markdown 已接入宿主 MarkdownText，但完成态长内容仍以单列展开，标题、段落、表格和代码块之间的阅读节奏不统一，长文时需要频繁滚动寻找阶段边界。
5. 加载状态主要通过 aria-busy 表达，失败反馈位于节点详情末尾；真实操作中错误和进行中状态不在当前视口附近。
6. DAG 的父节点深度、折叠祖先和选中路径遍历在异常自环/环数据上缺少访问集合，前端存在递归或卡死风险。该问题不等于权威 parser 已修复。

## 已实施的优先改造

- 面板顶部增加当前阶段状态条、活动分支摘要、阶段路径和面板内导航。
- 增加 sticky 当前阶段操作区；上传、确认/写入、反馈、拒绝和节点查看保持原 Remote 语义并集中到可见区域。
- 画布遍历增加访问集合；异常图数据在前端安全降级，不修改 research domain v1 或持久化协议。
- 增强窄面板响应式规则、按钮焦点、长标题折行和 Markdown 内容边界。

## 宿主边界

没有修改 F:\deepseek 的 EXE、ASAR、DockKit、Sidebar 核心，也没有修改 D:\deepseek-harness。docs/acceptance/COVERAGE.md 中两项旧 DockKit 布局断言仍属于宿主边界，本轮保持未验证。


改造后证据还包括窄窗口运行态截图：[after-electron-rc5-running.png](ui-screenshots/after-electron-rc5-running.png)。截图可见右侧面板在较窄宽度下仍保留阶段标题、状态、sticky 当前操作、长摘要和分支视图入口。

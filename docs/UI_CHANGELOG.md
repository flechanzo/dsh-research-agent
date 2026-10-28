# Research Workspace UI 变更记录

日期：2026-10-28（Asia/Shanghai）

- ResearchPanel.tsx：增加状态条、活动分支摘要、阶段路径、面板内导航和 sticky 当前阶段操作区；上传、确认/写入、反馈、拒绝仍调用原有 Remote 方法。普通导航不会修改科研状态。
- ResearchPanel.module.css：增加窄面板/小窗口响应式布局、按钮焦点、阶段路径、操作区、状态反馈和长内容折行规则；继续复用 DSH 主题变量。
- ResearchFlowCanvas.tsx：为节点深度、折叠祖先、选中路径和自动布局增加访问集合，异常图数据不会在前端无限递归。
- locales.ts：增加中文/英文的加载、执行中、当前路径、操作区和工作台导航文案。
- tests/ui-regressions.spec.tsx：增加 F19 自环图渲染回归，确保画布可以安全降级。
- packages/research-agent/package.json：发布版本提升为 0.1.5-rc.5，保留 0.1.5-rc.3 和 0.1.5-rc.4 原包。

兼容处理：没有修改 research domain v1、JSON 持久化结构、RPC、Preset、子代理模型继承、正式 profile、DockKit 或 Sidebar 核心。F19 只在前端展示遍历层做保护，权威 parser 风险继续在测试报告中明确标记。

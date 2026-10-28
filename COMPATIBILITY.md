# 兼容性

| 项目 | 本次确认 |
| --- | --- |
| 旧代码 | DSH 0.1.7-rc.2，2cf8f5ae37af3acee9546190b0cdc78f1359365e，含未提交科研修复和仿真源码 |
| 桌面应用 | 官方有效签名 Electron Desktop 0.2.1-rc.3，F:\deepseek |
| 目标内核 | 0.2.1-rc.3，be72761ee1a6736ebcdf4f3739363b083ae53c98 |
| 安装入口 | 内置 resources/runtime/cli/bin/dsh.cmd plugin --profile desktop add/remove |
| 兼容声明 | engines.dsh 精确为 0.2.1-rc.3 |
| 数据 | research domain v1；默认复用已有路由；可选择独立 JSON 目录 |
| 桌面验收 | 正式 Electron 0.2.1-rc.3 的独立 home/userData/工作区中，候选完整 Mock 流程通过；正式 profile 保持 0.1.4 |

此范围不承诺 0.2.1 的其他候选版、未来桌面版本、社区 Tauri 版、Linux 或 macOS。管理脚本对版本不匹配直接拒绝安装。包要求 Node >=22.19，目标自带 Node 24.21.0；开发构建在本机 Node 22.20.0 执行。

旧核心中的专有聊天槽位由公开右侧面板代替；旧界面的正文、方案选择、图和阶段操作都保留在面板。subagent、Typert 和客户端模块加载适配细节见 MIGRATION_REPORT.md。不要将旧 lib、核心包或整个旧 web-app 安装到新 Desktop。

目标升级前保留当前 tgz 与安装事务，先在独立 DSH_HOME 使用新版本运行 build/typecheck、行为测试和 Mock 浏览器流程。检查公开声明、协议生成、Preset 实例化、客户端加载和存储兼容后，再改 engines.dsh 和各官方 peerDependencies。不要只放宽版本字符串。

扫描 PDF 的 OCR 需要图像模型；索引请求和外部工具由目标现有权限及网络配置控制。固定数值仿真不依赖 Python。真实模型、第三方 MCP 和全部 Office 运行时不在本次离线覆盖范围。

候选的 research v1 持久化兼容说明见 packages/research-agent/COMPATIBILITY.md；本次验收状态见 TEST_REPORT.md。Lint 和真实外部服务验证尚未通过，不应扩大兼容声明。

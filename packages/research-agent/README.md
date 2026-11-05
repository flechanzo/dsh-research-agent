# 自动科研插件

版本：0.1.6-rc.13。精确目标：官方 Nightly DeepSeek Harness Desktop 0.2.1-rc.5。保留 research Preset、论文读取、文献检索、多角色评审、分支 DAG 与人工确认后的研究计划。科研内容、分支关系、节点详情使用三个独立切换的视图；隐藏视图保留草稿。科研流程可以保存为新的会话；最终科研方案去除论文摘要、问题总结和文献原文，只保留创新方案、技术路线、审查修订和验证设计。自动科研流程不再运行 Rubric 数值评分；历史会话中的 Rubric 字段仅用于兼容读取。候选生成阶段的普通创新性评估仍然开启。

通过官方 dsh plugin 命令安装 Bundle。可变状态保存在 DSH_HOME/storages/research.json 或显式 dataDirectory；导出保存在独立 Session 工作目录。新计划使用 research-projects/<sessionId>/plans/<branchId>/revision-<revision>/<planPath>，已有文件不搬移。

状态先提交，项目导出可能随后失败。客户端显示失败并重新读取权威 revision；提交不会因导出失败回滚。重新打开面板或恢复窗口焦点会刷新状态。多个 Host 同时写同一个 JSON 域没有原子 CAS 保证，应只用一个写入者。

科研和 OCR 子代理优先继承已记录但尚未用于父代理下一轮请求的模型选择；没有待生效选择时继承父代理最近请求的模型。不会消费或修改该选择事件。远程模型质量及图像能力仍需另行验证。

research domain 保持 v1。读取历史 web 来源时保留原值，执行检索才展开为五个显式索引并去重；新配置不能选择 web。拒绝候选会记录原节点的 rejected 状态和理由，新分支保留反馈。继续历史节点会创建分支并保留原节点、分支和成果。加载时检查损坏引用及环，不更改有效历史记录的 v1 格式。

固定五点 OLS 只用于示例与流程测试，不验证用户科研方法。完整运行证据、开发与升级流程见独立工程的 TEST_REPORT.md、MIGRATION_REPORT.md 和 DEVELOPMENT.md。

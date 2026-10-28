# 兼容性与持久化变更

此候选精确面向 DSH Desktop/内核 0.2.1-rc.3，不承诺其他版本或平台。公开 SDK、Typert 和客户端 ModuleLoader 按该版本构建。

research domain version 仍为 1，没有新增必填持久字段，也没有搬移、覆盖或删除旧代数据。ResearchLiteratureSourceId 的 Host 与 Remote 声明重新纳入历史 web 值；这是恢复已发布 v1 数据的可读值域。解析器保留历史值，搜索执行层才把 web 展开为五个显式索引，新建配置仍只接受显式索引。五条真实记录在副本中读取、分支后，所有原节点、原分支和原成果均保持不变。

新增 processedPageCount 只用于临时 PDF 提取结果，不是 research v1 的必填字段。pageCount 表示 PDF 总页数。否决状态、反馈和 planPath 仍使用已有字段；新计划按分支和 revision 分目录，旧路径保持可读且不被迁移。

完整流程通过正式 Electron 承载，但使用本地 Mock 模型和文献。真实服务调用未获许可；类型感知 lint 受缺失的目标 dockkit SDK 声明阻塞。不得将此候选视为已通过全部发布门槛。

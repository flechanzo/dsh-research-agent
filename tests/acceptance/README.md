# 本机验收工具

这些工具在 D:\dsh-research-agent 执行。所有 Electron 入口必须通过 desktop-isolation.mjs 启动，显式传入已准备好的 DSH_ACCEPTANCE_CONTEXT。root、home、profile、workspace、userData、附件及 evidence 必须属于同一本轮新建隔离根目录（仓库 .acceptance 或系统临时目录），不得指向正式数据或用户工作区。

第一次启动 EXE 或官方 CLI 前，调用 prepareDesktopIsolation 创建全部路径、归属标识和 workspace-controller.documentsDirectory 配置，并加入 desktop-isolation-guard.mjs。启动器验证配置、userData 与环境一致，运行时守卫再验证解析后的真实路径；缺失配置、F 盘默认回退、路径遍历、同前缀目录和 junction 逃逸都拒绝。通过官方 dsh.cmd plugin --profile desktop add 安装本地插件目录，显式使用隔离 DSH_HOME。不要复制正式 profile、凭据或私人论文；离线缓存缺失时停止，不静默联网。

- electron-candidate.mjs：实际正式 EXE；新建合成 Session，A→B、完整计划、F01 文件写入故障、F12 双分支、页面恢复。模型及文献是 Mock；启动参数带隔离 userData，finally 关闭该实例。
- legacy-records.mjs：需要 root/legacy/research.json 的只读快照；先读五条，再在 mkdtemp 副本中执行分支续接，比较全部旧节点、分支、成果。源码真实数据哈希为本次验收基准；真实数据变化时应重新建立有记录的基准，不删除断言以“修好”测试。
- check-baseline.mjs：从 4245985 暂时恢复独立插件源码并运行聚焦回归，finally 恢复当前文件并重建。禁止与编辑、构建或其他源码测试同时运行；内层 Vitest exit 1 表示已复现基线缺陷，脚本自身完成清理后可 exit 0。产物为 baseline-confirmed.json。
- coverage-map.mjs：读取旧仓库测试、4245985 测试和当前测试，生成 74→54→89 逐断言对照；不会修改旧仓库。
- graph-risk.mjs：只对隔离合成状态执行 parser，不遍历损坏图，记录 F19 已知缺口；输出 FAIL 不是测试基础设施故障。
- electron-flow.mjs：原 0.1.4 的历史流程脚本；最终候选以 electron-candidate.mjs 为准。

不得同时启动两个使用同一隔离 home 的 Host。不要将脚本成功退出等同于所有功能通过，应读取逐项结果。仅清理带本轮归属标识且已验证路径的测试资源。docs/acceptance 只保存合成日志、脱敏统计与哈希；会话访问令牌留在忽略目录。

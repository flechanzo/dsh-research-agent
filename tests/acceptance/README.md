# 本机验收工具

这些工具在 D:\dsh-research-agent 执行；.acceptance/current.json 指向专用 root、home、workspace、userData、evidence。目录均须位于独立仓库的 .acceptance 内，home/profiles/desktop 必须安装待验收包并配置本地 Mock。任何路径不得指向正式数据或用户工作区。

新建隔离实例时使用新的空目录，创建 desktop profile 的 package.json（bundles 为 @deepseek-ai/dsh-base、@deepseek-ai/dsh-web-app）和空 cordis.yml，然后通过官方 dsh.cmd plugin --profile desktop add 安装本地 tgz。使用 tests/support/mock.patch.yml 替换 __RESEARCH_MOCK__ 为 mock.mjs 的绝对路径，加入 workspace-controller.documentsDirectory 指向专用 workspace，再写入 current.json。不要复制正式 profile 的凭据。离线缓存缺失时停止安装，不静默联网。

- electron-candidate.mjs：实际正式 EXE；新建合成 Session，A→B、完整计划、F01 文件写入故障、F12 双分支、页面恢复。模型及文献是 Mock；启动参数带隔离 userData，finally 关闭该实例。
- legacy-records.mjs：需要 root/legacy/research.json 的只读快照；先读五条，再在 mkdtemp 副本中执行分支续接，比较全部旧节点、分支、成果。源码真实数据哈希为本次验收基准；真实数据变化时应重新建立有记录的基准，不删除断言以“修好”测试。
- check-baseline.mjs：从 4245985 暂时恢复独立插件源码并运行聚焦回归，finally 恢复当前文件并重建。禁止与编辑、构建或其他源码测试同时运行；内层 Vitest exit 1 表示已复现基线缺陷，脚本自身完成清理后可 exit 0。产物为 baseline-confirmed.json。
- coverage-map.mjs：读取旧仓库测试、4245985 测试和当前测试，生成 74→54→89 逐断言对照；不会修改旧仓库。
- graph-risk.mjs：只对隔离合成状态执行 parser，不遍历损坏图，记录 F19 已知缺口；输出 FAIL 不是测试基础设施故障。
- electron-flow.mjs：原 0.1.4 的历史流程脚本；最终候选以 electron-candidate.mjs 为准。

不得同时启动两个使用同一隔离 home 的 Host。不要将脚本成功退出等同于所有功能通过，应读取它的逐项结果。docs/acceptance 只保存合成日志、脱敏统计与哈希；真实记录副本和会话访问令牌留在忽略目录。真实外部调用当前未获许可。

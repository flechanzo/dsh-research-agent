# 自动科研插件

这是从旧 DSH 0.1.7-rc.2 提取、适配官方 Desktop 0.2.1-rc.3 的独立 Bundle。源码位于 packages/research-agent/src，保留 research Preset、论文读取、五索引文献检索、创新评审、多角色协作、分支 DAG、固定数值仿真和人工确认后的 Markdown 计划写入。

## 当前安装

正式安装包：D:\dsh-research-agent\dist\dsh-research-agent-0.1.4.tgz。已安装到 D:\DeepSeekHarness\data\profiles\desktop。用户已确认重启 F:\deepseek\DeepSeek Harness.exe 后，新会话 Agent 菜单能看到“自动科研”。完整离线流程由该安装目录内置的同版本运行时执行，结果见 TEST_REPORT.md。

新建会话，在 Agent 选择菜单选择“自动科研”，发送任务后点击会话标题旁的“自动科研流程”。上传 PDF 或 TXT，查看摘要并逐步确认；在问题提炼处调整研究方向、权重和索引，在后续节点查看创新评分、补充文献、选择评审角色。最后先预览计划，再点击“确认并写入 Markdown 文件”。旧会话也可通过标题按钮查看对应科研状态。

历史节点可以“从这里继续（新分支）”；树状视图、列表视图、科研正文和方案选择都在右侧科研面板内。面板可滚动。分支切换不会删除原路径。

## 安装和更新

使用 PowerShell 7。脚本会检查目标内置 CLI 和精确内核版本，备份 profile 配置，通过官方插件命令操作，不修改安装目录。明确参数可避免本机多个 DSH 实例混淆。

```powershell
Set-Location D:\dsh-research-agent
.\install.ps1 -InstallDir F:\deepseek -DshHome D:\DeepSeekHarness\data -Profile desktop -PackagePath D:\dsh-research-agent\dist\dsh-research-agent-0.1.4.tgz
.\update.ps1 -InstallDir F:\deepseek -DshHome D:\DeepSeekHarness\data -Profile desktop -PackagePath D:\dsh-research-agent\dist\dsh-research-agent-0.1.4.tgz
```

加 -DryRun 可仅检查目标。不传路径时脚本会尝试识别唯一正在运行的官方 Desktop Host；识别不唯一会拒绝操作。更新新代码时先增加包版本，构建新的 tgz，再传入新路径。安装依赖可能需要 npm 网络；不向 npm 发送论文或模型凭据。完成后在任务空闲时正常退出并重开桌面端。重复安装不会追加重复 Bundle。

## 卸载和回滚

```powershell
.\uninstall.ps1 -InstallDir F:\deepseek -DshHome D:\DeepSeekHarness\data -Profile desktop
.\rollback.ps1 -InstallDir F:\deepseek -DshHome D:\DeepSeekHarness\data -Profile desktop -Transaction D:\dsh-migration-backup\plugin-20261027-005232-208-8bf9494f\transaction.json
```

上面的事务是首次正式安装；回滚它会卸载本插件。每次更新会打印自己的 transaction.json；回滚更新使用对应事务和保留的旧 tgz。回滚只调整本插件依赖与 Bundle 登记，不整体覆盖 profile。卸载和回滚不删除科研状态、论文附件或计划文件。不要用很早的事务撤销后来已主动完成的插件更新。

## 数据和配置

默认继续读取 D:\DeepSeekHarness\data\storages\research.json，已有 5 条科研记录无需复制。聊天在独立 sessions 目录，未迁移或重建。计划及 DAG 导出位于该会话工作目录的 research-projects/<sessionId>/。备份清单见 docs/backup-location.json；完整性结果见 docs/data-integrity.json。

如需单独保存科研数据，先迁移再配置。迁移默认 dry-run，不合并或覆盖不同目标文件；重复运行相同快照为 unchanged。

```powershell
node scripts/migrate-data.mjs D:\DeepSeekHarness\data\storages\research.json D:\MyResearchData
node scripts/migrate-data.mjs D:\DeepSeekHarness\data\storages\research.json D:\MyResearchData --apply
```

在 profile 的现有 cordis.patch.yml 中合并下面这一项，保留其他配置，然后重启 Host。不要把示例覆盖到整个文件。迁移时应停止科研任务以获得一致快照。

```yaml
- id: research-agent-controller
  config:
    dataDirectory: 'D:/MyResearchData'
```

控制器其他可配置项包括 subagentProvider、planPath、maxPaperBytes、maxLiteratureResults、literatureSources、innovationScoreThreshold、maxIdeaAttempts、maxPdfPages、ocrScale、maxOcrPixels；类型与默认值以 src/controller.ts 的 Config 为准。

## 常见问题

Agent 菜单没有更新：确认运行 F:\deepseek 这套应用，确认 DSH_HOME 和 profile，重启后再看新会话菜单。菜单可见但面板打不开：保存报错并核对 COMPATIBILITY.md；不要替换 ASAR 或重建聊天数据库。

扫描 PDF 需要当前模型支持图像输入。网络索引可能限流；插件保留来源失败信息。真实模型、索引和私人论文的质量或连通性未通过此次离线测试证明。简单仿真仅为旧版已实现的固定五点 OLS 示例，不是通用 Python 实验执行器。

继续开发见 DEVELOPMENT.md；功能对照见 MIGRATION_REPORT.md；实际测试及未验收项见 TEST_REPORT.md。

# UI 与 Desktop 交付验证 — 2026-11-03

插件：0.1.6-rc.1。目标：官方 Nightly Desktop 0.2.1-rc.5，Electron 44.7.0 / Node 24.21.0。

## 界面变更

- 科研内容、分支关系、节点详情现在是三个互斥的 tabpanel；只显示当前视图，保留隐藏视图中的草稿和分支状态。
- 科研内容收纳正文、上传、目标任务确认和阶段配置；分支关系收纳 DAG、列表、方案选择和历史路径；节点详情收纳节点元数据、内容摘要、评估与续接操作。
- 分栏支持方向键、Home、End，正确关联 aria-selected / aria-controls / aria-labelledby；“查看完整科研内容”切换回正文视图。
- 评估表单按侧栏宽度从双列调整为单列，统一按钮、评分、审计和焦点样式。长审计 JSON 局部滚动。
- 内容展开使用独立标题按钮；选择正文、点击链接和操作审计不再触发整张卡片折叠。
- 安装脚本使用插件 engines.dsh 校验目标版本，避免继续写死旧 rc.3。

## 实际验证

- 锁文件安装：pnpm 11.7.0，frozen-lockfile、ignore-scripts、offline，成功。
- Build、常规 Host/Client Typecheck、Client skipLibCheck=false、Lint：通过。
- Vitest：22 个文件，249 项全部通过，包含独立分栏与键盘切换回归。
- 官方 EXE：原生聊天、自动科研预设、上传、目标范围确认、完整阶段推进、人工确认导出计划：通过；推理与检索使用显式本地合成夹具。
- 正常窗口 1440px、窄窗口 880px：侧栏无横向溢出；三个视图逐项验证只有一个可见。
- 真实 Electron 退出并重启：持久化科研状态逐字结构比较一致。
- 本轮只对一般 Typecheck 与 Client 完整 SDK 声明检查作通过声明，不追加声称历史 Host 上游声明缺陷已修复；没有调用收费模型或完成新的专家科学校准。

## 来源与证据

2026-11-03 从 https://download.deepseek.com/dsh-desk/feeds/win-x64/nightly.yml 实时核验通道版本。
官方安装包 SHA512 Base64：
gu2dH+aTr678c0P8DGAH/h4B1GaWfQIjpsPrLjl/ukLrQIh6DLVq/MhX4FZvJ8o1GCMocOhix6XbLa6KmtjXXg==

安装包 Authenticode 有效，发布者 Hangzhou DeepSeek Artificial Intelligence Co., Ltd.。
测试使用独立 DSH_HOME、workspace、userData 和科研数据，实际程序来自官方安装包的解压副本。

原始证据保留于本地 .acceptance/ui-refresh-20261103/，不进入 Git：
- official-source.json、nightly.yml：实时官方来源与哈希。
- test-tabs.log、typecheck-tabs.log、typecheck-sdk-tabs.log、lint-final.log：检查日志。
- ui-tabs-final/results.json、build-manifest.json：真实运行与构建记录。
- ui-tabs-final/01-upload.png、02-target-form.png、03-narrow.png、05-branches.png、05-details.png、06-restarted.png：真实界面截图。

首次截图超时、内存压力下 Electron 启动超时、分栏重组的缩进诊断均保留在各自首次运行目录/日志中；修复后串行重跑通过。最终代码格式修正不改变功能，最终发布构建在提交后重建以绑定 Git 提交。

## 安装

用经过签名与哈希核对的官方安装器升级既有 Nightly Desktop，再执行：

~~~powershell
npm run build
npm pack ./packages/research-agent --pack-destination dist
./install.ps1 -InstallDir F:/deepseek -DshHome D:/DeepSeekHarness/data -Profile desktop -PackagePath D:/dsh-research-agent/dist/dsh-research-agent-0.1.6-rc.1.tgz
~~~

插件 CLI 事务备份保存在 D:/dsh-migration-backup。安装完成后的本机版本、插件哈希和 UI 加载结果另保留在本地交付证据目录；不提交私人 profile、凭据、会话或运行缓存。

# 实际测试报告

验收日期：2026-10-27，Windows，目标安装目录 F:\deepseek，Desktop/内核 0.2.1-rc.3。发布包 dsh-research-agent@0.1.4。除用户确认的桌面菜单外，GUI 自动化使用目标自带 CLI 启动的隔离 Web Host、Playwright 1.58.2 与系统 Edge。没有使用旧源码 Host 代替目标内核。

## 已执行且通过

| 检查 | 命令或操作 | 结果 |
| --- | --- | --- |
| Host/Client 构建和严格类型检查 | node scripts/build.mjs | 协议生成、两端声明编译、Host/Client bundle 成功 |
| 行为测试 | node node_modules/vitest/vitest.mjs run --reporter=dot | 5 个文件，54 项通过；最近完整运行 00:43:22 |
| 发布包 | npm pack ./packages/research-agent --pack-destination dist --json | 0.1.4；33 文件；176110 字节；清单 docs/pack.json |
| 包内容审核 | 检查发布清单和 bundle 路径 | 无数据、凭据、测试、node_modules、旧源码路径；docs/package-audit.json |
| 原生安装/更新 | install.ps1 / update.ps1 指向隔离 web profile | 0.1.1→0.1.2→0.1.3→0.1.4 的适配迭代；最终版本正常加载 |
| Preset 与新科研会话 | node scripts/full-flow.mjs | 选择自动科研、Mock 响应、科研面板可见；回滚后的重测通过，docs/final-smoke.log |
| 多阶段科研 | node scripts/stage-flow.mjs | TXT 上传、摘要、问题、五索引、创新生成/评分、完善、针对性检索、多角色评审、计划预览和明确确认写入；docs/stage-flow.log |
| 恢复、分支和仿真 | node scripts/branch-flow.mjs | 重新加载已落盘计划，从 node-9 新建分支，固定 OLS 仿真成功；docs/branch-flow.log |
| 卸载后默认 Agent | uninstall.ps1 + node scripts/default-smoke.mjs | 无科研插件时默认 Agent 完成 Mock 对话；docs/default-without-plugin.png |
| 管理周期 | install.ps1 → uninstall.ps1 → rollback.ps1 | Bundle 恢复；全过程 research.json SHA256 一致；重复卸载安全退出 |
| 正式安装 | install.ps1 指向 D:\DeepSeekHarness\data / desktop | 成功；事务 plugin-20261027-005232-208-8bf9494f |
| 正式登记 | 内置 dsh.cmd plugin --profile desktop list | 列出 dsh-research-agent@0.1.4，与其他 4 个插件共存 |
| 真实 Electron 菜单 | 用户正常退出重开后检查 | 用户回复“已重启，能看到自动科研”；人工确认，非自动化窗口测试 |
| 安装数据完整性 | 安装前后只读 SHA256 比较 | 194 个会话/科研/补丁文件未变；296 个审计范围内旧源码文件未变；5 条旧科研记录保留 |
| 数据复制工具 | migration.spec.ts，真实源 dry-run | 默认无写入、同内容幂等、冲突拒绝、无效 domain 拒绝；真实 5 条记录有效 |
| 独立目录与取消 | adapters.spec.ts | 独立 JSON 目录关闭/重开保持 revision，共享路由不打开；取消 dispose 一次且保留清理失败 |
| PDF | research-coordinator.spec.ts | 实际 PDF.js 提取文本；实际渲染扫描/混合页到 OCR 夹具；缺失 OCR 明确失败 |
| Python 识别 | python --version | D:\Anaconda3\python.exe，Python 3.11.7；未运行科研 Python 实验 |

54 项测试还覆盖不可变分支、历史节点写保护、revision 冲突、创新评分不通过重试、无检索证据拒绝、各文献源解析及部分失败、父模型路由继承、最终计划文件权限与写入次序。它们不是旧仓库全套 CI，也不是目标官方平台矩阵。

## 证据和测试副作用

截图：docs/preset-menu.png、docs/full-flow-progress.png、docs/research-completed.png、docs/research-simulation.png、docs/default-without-plugin.png。日志中全部论文、索引和模型输出都是本地合成数据。截图只显示验收会话。

隔离 DSH_HOME 为 D:\dsh-research-agent\.isolated\home。合成计划实际位置为 F:\Documents\deepseek-harness\default-workspace\research-projects\session-531bec1e-fef9-4217-86eb-2e85cfb9aea4\research-plan.md；该路径来自目标的默认工作区配置。只新增验收会话的项目文件，没有覆盖用户项目；最终回滚后重跑又生成 session-7a726755-3d87-4a7d-9870-78b3ed7bf7cf/research-plan.md，日志见 docs/final-stage-flow.log。离线流程真实执行了 DSH 子代理、RPC、状态持久化、文件上传和文件写入；模型与文献网络响应为 Mock。

最初的隔离启动继承了 API 环境变量，触发过模型列表元数据请求；未用于科研推理或上传论文。后续启动清除凭据环境变量并禁用真实模型提供者。本次没有调用真实收费科研推理、没有上传私人论文。模型名单获取和 npm 依赖获取不应被描述成整个迁移期间完全零网络。

## 遇到并解决的失败

客户端首次未挂载外部 RPC，随后又缺少 Cordis remote.research 显式依赖，导致面板加载失败；0.1.4 已包含挂载和注入修复。原 Persona {{cwd}} 在目标无定义，已移除该后缀。Mock 最初只检查最后一条消息，创新专家返回了非 JSON；夹具现检查完整请求。管理脚本移除了 pnpm remove 不支持的参数，并处理卸载后 dependencies 字段缺失。浏览器脚本修正了按钮无障碍名称、重复导航、重复节点选择器与新会话菜单重挂载竞态。

这些失败发生在隔离环境；正式安装使用修复后已通过行为和完整流程验收的版本。

## 未执行和剩余人工验收

Windows Computer Use 的 Node helper 多次启动失败，错误为 windows sandbox failed: helper_unknown_error: setup refresh had errors。正常重试和重置后仍失败，没有规避权限。真实 Electron 窗口内的完整多阶段任务未自动执行；桌面菜单由用户确认。历史聊天文件未改，用户迁移前已能读取，但本次没有逐条在真实桌面重新打开所有历史对话。

没有用真实模型判断论文质量，没有联网验证五个论文平台当日响应，没有验证私人扫描论文的 OCR 质量，也没有逐个执行用户的 MCP、Office、Shell 工具。模型选择、收费和网络权限保留目标配置。固定 OLS 模板仅验证原有实际能力，不能代表通用实验环境。

补验步骤：在实际桌面选择自动科研，先用公开或合成 TXT 创建任务，打开科研面板，确认摘要和检查点；打开一个已有科研会话，确认原分支可见；选择可用图像模型后用公开扫描 PDF 检查 OCR；按需批准真实模型调用。未授权上传私人数据时不要拿私人论文作验收材料。

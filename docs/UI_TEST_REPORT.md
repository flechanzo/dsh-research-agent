# Research Workspace UI 测试报告

日期：2026-10-28（Asia/Shanghai）。所有 Electron 测试使用隔离 DSH_HOME、Electron userData 和 Session workspace；模型、文献和测试文件均为本地合成数据。

## 结果

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| Build | 通过 | npm run build |
| Host/Client typecheck | 通过 | npm run typecheck |
| 行为测试 | 89/89 通过 | npm test -- --run --reporter=dot |
| UI 组件与样式测试 | 通过，含新增 F19 环图渲染回归 | tests/ui-regressions.spec.tsx、tests/legacy-ui/ |
| 真实 Electron 完整流程 | 通过 | acceptance/electron-ui-rc5-final.txt |
| Electron 真实截图 | 已保存 | [after-electron-rc5.png](ui-screenshots/after-electron-rc5.png) |
| Electron DOM 证据 | 已保存 | [after-electron-rc5-dom.txt](ui-screenshots/after-electron-rc5-dom.txt) |
| Lint | 仍失败 15 项 | docs/acceptance/lint-final.json；均为缺失 DockKit 类型声明导致的 error-typed 诊断 |
| F19 权威 parser | 仍失败 | docs/acceptance/graph-risk.json；本轮只增加前端遍历保护 |
| 旧 DockKit 两项布局场景 | 未验证 | 宿主 Sidebar/DockKit 边界，未修改宿主核心 |

## Electron 真实流程

隔离 Electron 运行确认了：新建自动科研任务、A→B 模型切换后的本地 Mock 路由、论文上传、阶段确认、多角色审查、最终计划写入、导出失败后 revision 刷新、分支计划文件隔离和页面刷新恢复。证据中的 provider 为 research-mock，没有真实模型或在线文献请求。

改造前截图：[before-electron-start.png](ui-screenshots/before-electron-start.png)、[before-electron-completed.png](ui-screenshots/before-electron-completed.png)。改造后截图：[after-electron-rc5.png](ui-screenshots/after-electron-rc5.png)。改造后截图可见顶部阶段身份和 sticky 当前操作区；阶段路径、导航和完整长内容保存在对应 DOM 证据中。

## 未验证与限制

- 两项旧 DockKit 宽度/垂直 flex 场景仍未验证，原因是它们属于宿主公开扩展接口之外的核心布局。
- Lint 的 15 项 SDK 类型感知诊断未通过；没有关闭规则或伪造声明。
- F19 权威 parser 仍接受缺失选择节点/自环；前端画布和列表遍历已避免无限递归，但没有改变持久化协议。
- 一次历史 Windows 文件替换 EIO 的根因仍未查明；本轮 Electron 完整流程通过，但不宣称该运行时风险消失。

正式安装 profile 未更新，正式插件 0.1.4 保持不变。


补充：本轮总测试输出为 13 个文件、90 项通过；其中原有 89 项行为测试全部保持通过，新增 1 项 F19 前端环图回归。窄窗口真实截图为 [after-electron-rc5-running.png](ui-screenshots/after-electron-rc5-running.png)，对应运行日志保存在 [electron-ui-rc5-narrow.txt](acceptance/electron-ui-rc5-narrow.txt)。
最终重打包 rc.5 的完整 Electron 日志已保存为 [electron-ui-rc5-final.txt](acceptance/electron-ui-rc5-final.txt)；该次完整流程通过，使用的隔离 workspace 为 `.acceptance/run-20261027-RV7z7X/workspace`。
最终包的追加 Electron 重跑在真实界面已渲染新错误提示条，但在 node-4 持久化时再次遇到已知 ReplaceFileW EIO；详见 [electron-ui-rc5-eio-rerun.txt](acceptance/electron-ui-rc5-eio-rerun.txt)。此前同一最终 rc.5 包的完整流程通过日志仍保留在 [electron-ui-rc5-final.txt](acceptance/electron-ui-rc5-final.txt)，因此该追加失败按已知环境间歇性文件替换风险记录，不归因于 UI 交互回归。

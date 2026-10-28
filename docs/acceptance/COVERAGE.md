# 旧 74 项、新 54 项与最终候选断言对照

日期：2026-10-27。旧测试只读取自 D:\deepseek-harness；0.1.4 测试取自独立仓库提交 4245985。逐条断言原文和文件位置保存在 [coverage-final.json](coverage-final.json)，执行结果见 [tests-after.json](tests-after.json)。

旧 74 项共 250 个直接 expect 调用点；0.1.4 的 54 项共 181 个。0.1.4 按名称迁移了 50 项，缺少 24 项 UI/样式测试，另增 4 项存储、取消和迁移测试。最终候选 89 项、301 个调用点，全部执行通过；旧测试 72 项已有对应覆盖，2 项旧核心布局断言未验证。数字是静态调用点，包含 expect.soft，不是运行断言次数或行覆盖率，也不证明测试等价。

当前恢复 22 项 UI/样式用例，其中面板根布局改为目标插件滚动方式。React、插件组件和状态转换实际运行；宿主 Tooltip、MarkdownText 与图标使用 tests/support/ui-primitives.tsx 的显式替身。正式 Electron 的另一路验收使用真实宿主组件。旧模型继承用例中的子代理接口从 start 适配为 startActivation；仅保持原断言不足以覆盖动态选择，新增 F02 用例和桌面路由日志补足该缺口。

| # | 旧测试行为 | 旧断言 | 0.1.4 断言 | 候选断言 | 候选状态 | 说明 |
| --- | --- | ---: | ---: | ---: | --- | --- |
| 1 | keeps generated branch labels unique beyond the alphabet | 6 | 6 | 6 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 2 | keeps stage outputs visible and confirms them before continuation | 2 | 2 | 2 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 3 | marks the displayed final plan as written only after a valid path is returned | 5 | 5 | 5 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 4 | stores at least one selected research focus in branch memory | 2 | 2 | 2 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 5 | rejects an idea into a new branch while preserving the original branch | 5 | 5 | 5 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 6 | continues from history without mutating the source node | 3 | 3 | 3 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 7 | records feedback and enforces an explicit innovation claim | 3 | 3 | 3 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 8 | preserves feedback as the decision when confirming a refinement | 2 | 2 | 2 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 9 | keeps the source status when continuing from history | 2 | 2 | 2 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 10 | continues any selected node without rewriting the source branch | 9 | 9 | 9 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 11 | selects a historical node without changing the active branch | 2 | 2 | 2 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 12 | copies a recorded Session boundary into a continuation branch | 5 | 5 | 5 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 13 | keeps a copied future node bound to its source Session | 3 | 3 | 3 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 14 | runs the built-in numerical adapter and reports computed metrics | 5 | 5 | 5 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 15 | rejects an empty idea before computing any result | 1 | 1 | 1 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 16 | honors cancellation before the fixed experiment starts | 1 | 1 | 1 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 17 | reads several uploaded papers in one comparative stage | 5 | 5 | 5 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 18 | asks the problem extractor to retain every distinct question | 3 | 3 | 3 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 19 | executes every confirmed stage and renders a final plan | 24 | 24 | 24 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 20 | gives the isolated innovation reviewer all branch evidence and candidate search results | 6 | 6 | 6 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 21 | passes the resolved sandbox policy to the final plan writer | 2 | 2 | 2 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 22 | mounts the fixed numerical adapter in the Host factory | 4 | 4 | 4 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 23 | leaves research state untouched when a simulation adapter fails | 2 | 2 | 2 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 24 | refuses to run a stage whose output is still awaiting confirmation | 1 | 1 | 1 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 25 | requires an innovation claim before multi-agent review | 1 | 1 | 1 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 26 | generates a new idea from a rejected branch while retaining literature evidence | 4 | 4 | 4 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 27 | appends uploaded supplemental papers to either literature checkpoint | 3 | 3 | 3 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 28 | discards low-score or overlapping candidates before exposing a passing idea | 2 | 2 | 2 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 29 | reports the innovation threshold when every candidate is rejected | 1 | 1 | 1 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 30 | fails closed when candidate-specific literature search has no results | 1 | 1 | 1 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 31 | queries arXiv machine-learning categories and merges duplicate URLs | 3 | 3 | 3 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 32 | does not call the native Web Search capability | 2 | 2 | 2 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 33 | retries transient timeouts once and keeps the successful source result | 2 | 2 | 2 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 34 | does not retry a non-public address block and reports failure categories | 2 | 2 | 2 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 35 | keeps index results when another index is unavailable | 1 | 1 | 1 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 36 | reports the selected indexes when every fetch fails | 1 | 1 | 1 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 37 | classifies a proxied connection failure separately from DNS and address blocks | 1 | 1 | 1 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 38 | bounds encoded queries so long problem summaries reach the indexes | 2 | 2 | 2 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 39 | parses explicit conference and citation indexes without native search | 3 | 3 | 3 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 40 | inherits the selected parent model route and Chinese output instruction | 2 | 2 | 2 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 41 | extracts a PDF text layer with PDF.js | 3 | 3 | 3 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 42 | renders a scanned PDF and delegates the pages to OCR | 3 | 3 | 3 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 43 | OCRs sparse pages in a mixed PDF while retaining embedded page text order | 3 | 3 | 3 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 44 | reports a clear error when a scanned PDF has no OCR adapter | 1 | 1 | 1 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 45 | advertises the fixed numerical simulation adapter | 1 | 1 | 1 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 46 | creates a same-Session branch, commits a revision, and reloads it | 11 | 11 | 11 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 47 | rejects stale continuation without changing the durable row | 2 | 2 | 2 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 48 | rejects a repeated continuation with the old revision | 3 | 3 | 3 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 49 | keeps history mutation errors separate from continuation | 3 | 3 | 3 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 50 | commits the durable state before a project projection failure | 4 | 4 | 4 | 通过 | 0.1.4 已迁移；具体断言见 JSON。 |
| 51 | keeps the newest revision when an older read completes later | 3 | 缺失 | 3 | 通过 | 恢复旧 UI 测试；宿主 primitives 为显式替身。 |
| 52 | does not replace a snapshot with a different state at the same revision | 2 | 缺失 | 2 | 通过 | 恢复旧 UI 测试；宿主 primitives 为显式替身。 |
| 53 | publishes a remote read to every projection and returns the shared snapshot | 3 | 缺失 | 3 | 通过 | 恢复旧 UI 测试；宿主 primitives 为显式替身。 |
| 54 | keeps completed ancestors visible while viewing a historical node | 12 | 缺失 | 12 | 通过 | 恢复旧 UI 测试；宿主 primitives 为显式替身。 |
| 55 | keeps every completed stage visible after the final plan is selected | 4 | 缺失 | 4 | 通过 | 恢复旧 UI 测试；宿主 primitives 为显式替身。 |
| 56 | uses the research DAG branch action without opening a Conversation fork | 1 | 缺失 | 1 | 通过 | 恢复旧 UI 测试；宿主 primitives 为显式替身。 |
| 57 | shows and calls continueFromNode for the current branch tail | 2 | 缺失 | 2 | 通过 | 恢复旧 UI 测试；宿主 primitives 为显式替身。 |
| 58 | shows and calls continueFromNode for historical and final-plan nodes | 3 | 缺失 | 3 | 通过 | 恢复旧 UI 测试；宿主 primitives 为显式替身。 |
| 59 | keeps the action after a continue request fails | 3 | 缺失 | 3 | 通过 | 恢复旧 UI 测试；宿主 primitives 为显式替身。 |
| 60 | disables simulation when the Host does not advertise an adapter | 3 | 缺失 | 3 | 通过 | 恢复旧 UI 测试；宿主 primitives 为显式替身。 |
| 61 | lays out shared ancestors once and connects every dynamic branch | 3 | 缺失 | 3 | 通过 | 恢复旧 UI 测试；宿主 primitives 为显式替身。 |
| 62 | keeps the branch root and hides descendants when a branch is collapsed | 3 | 缺失 | 3 | 通过 | 恢复旧 UI 测试；宿主 primitives 为显式替身。 |
| 63 | pans the canvas without selecting a node | 3 | 缺失 | 3 | 通过 | 恢复旧 UI 测试；宿主 primitives 为显式替身。 |
| 64 | keeps a node click intact until the drag threshold is crossed | 3 | 缺失 | 3 | 通过 | 恢复旧 UI 测试；宿主 primitives 为显式替身。 |
| 65 | moves a node and suppresses selection for a drag while keeping clicks selectable | 4 | 缺失 | 4 | 通过 | 恢复旧 UI 测试；宿主 primitives 为显式替身。 |
| 66 | restores automatic positions after a manual node move | 1 | 缺失 | 1 | 通过 | 恢复旧 UI 测试；宿主 primitives 为显式替身。 |
| 67 | renders parent-child rows from node relationships and keeps shared ancestors | 3 | 缺失 | 3 | 通过 | 恢复旧 UI 测试；宿主 primitives 为显式替身。 |
| 68 | supports independent collapse, search, status filtering, and node actions | 8 | 缺失 | 8 | 通过 | 恢复旧 UI 测试；宿主 primitives 为显式替身。 |
| 69 | lets the DockKit pane body measure the full workflow before scrolling | 1 | 缺失 | 1 | 通过 | 适配为插件面板自身滚动断言；不再证明旧 DockKit 内容测量策略。 |
| 70 | makes only the research tab body content-sized so confirmation stays reachable | 1 | 缺失 | — | 未验证 | 旧核心 Sidebar/DockKit 样式不属于插件；目标窗口尺寸矩阵未验证。 |
| 71 | gives tab bodies a definite vertical flex track inside DockKit | 3 | 缺失 | — | 未验证 | 旧核心 Sidebar/DockKit 样式不属于插件；目标窗口尺寸矩阵未验证。 |
| 72 | keeps the relationship view readable inside the narrow sidebar | 3 | 缺失 | 3 | 通过 | 恢复旧 UI 测试；宿主 primitives 为显式替身。 |
| 73 | uses full-width step controls with a readable marker and copy column | 2 | 缺失 | 2 | 通过 | 恢复旧 UI 测试；宿主 primitives 为显式替身。 |
| 74 | renders the alternate view as a connected node tree | 8 | 缺失 | 8 | 通过 | 恢复旧 UI 测试；宿主 primitives 为显式替身。 |

## 独立插件新增用例

- persists an explicit data directory across controller disposal without opening the shared route（3 个调用点，tests/adapters.spec.ts）。
- cancels a published activation once and observes teardown failures（3 个调用点，tests/adapters.spec.ts）。
- preserves the legacy v1 web alias and ancestors when parsing a durable row（2 个调用点，tests/compatibility.spec.ts）。
- F06 exports a shared artifact once and F12 preserves plans from two branches（5 个调用点，tests/controller.spec.ts）。
- dry-runs, copies once, and rejects conflicting research state（5 个调用点，tests/migration.spec.ts）。
- refuses non-research data before creating a destination（2 个调用点，tests/migration.spec.ts）。
- F01/F08 refreshes a cached revision after a committed command fails during export（2 个调用点，tests/refresh.spec.ts）。
- F03 retains candidate keywords in the actual bounded index URL with a long problem（3 个调用点，tests/research-coordinator.spec.ts）。
- F05 records rejection on the old node and sends its reason to the next generator（5 个调用点，tests/research-coordinator.spec.ts）。
- F07 reports inspected and total pages separately when PDF reading is capped（6 个调用点，tests/research-coordinator.spec.ts）。
- F02 pending B selection overrides both creation A and the last A request for research and OCR（2 个调用点，tests/research-coordinator.spec.ts）。
- expands legacy web into five explicit indexes once without native search（3 个调用点，tests/research-coordinator.spec.ts）。
- F04 gives the owned branch root a badge and keeps it when collapsed（4 个调用点，tests/ui-regressions.spec.tsx）。
- F06 renders inherited artifact text only once while keeping the continuation node（2 个调用点，tests/ui-regressions.spec.tsx）。
- F08 shows branch selection failure without hiding existing branches（2 个调用点，tests/ui-regressions.spec.tsx）。
- F08 reloads the authoritative revision on remount and window focus（4 个调用点，tests/ui-regressions.spec.tsx）。
- F01 refreshes the committed revision after export failure and permits the next command（2 个调用点，tests/legacy-ui/research-panel.client.spec.tsx）。

## 未等价迁移的两项

旧核心“makes only the research tab body content-sized so confirmation stays reachable”和“gives tab bodies a definite vertical flex track inside DockKit”不再由本插件拥有。桌面完整流程的确认操作可达，但这不替代小窗口、窗口缩放与宿主 DockKit 布局矩阵，状态保留为未验证。没有修改旧核心 CSS 以让这些断言通过。

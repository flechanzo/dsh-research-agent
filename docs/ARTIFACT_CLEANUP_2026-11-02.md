# 历史发布产物实际清理报告

日期：2026-11-02（Asia/Shanghai）。项目：D:\dsh-research-agent。

实际删除 **28 个文件**，逻辑释放 **2,096,025,737 字节（1.952 GiB）**。保留 **14 个有依赖依据的 TGZ**。结果：completed_verified。

## 1. 清理前状态

HEAD：f8f3ddfe0b4677815905760ee44e90a2c56c7c86；插件源码：0.1.5-rc.5。173 个 Git 跟踪文件无差异。受控扫描共 37 个压缩包（10 ZIP、27 TGZ），2,098,324,253 字节。扫描覆盖根目录、dist、archive、旧运行目录和明确的验收发布输出，排除 node_modules、pnpm store、依赖缓存、用户 home、workspace 和独立 Git 仓库。
正式 Desktop 仍安装 0.1.4；正式 web profile 没有科研插件。另有 .isolated/web-preview-rc5-20261102 下的隔离 rc.5 Web profile，不能将其视为正式 web 已安装。
packages/research-agent/lib 的五个主要 JS 与 .web-runtime 和 .native-web-runtime 中的 rc.9 文件逐字节相同；当前生成文件仍有版本混用，本次保持不变。

## 2. 实际删除清单

| 完整路径 | 类型 | 字节 | 删除原因 |
| --- | --- | ---: | --- |
| D:\dsh-research-agent\.acceptance\run-20261027-RV7z7X\dsh-research-agent-0.1.5-rc.4.tgz | TGZ | 179,184 | 无当前安装、运行、测试读取或回滚依赖的历史插件包／冗余副本；保留必要的同 SHA256 安装副本及冻结基线。历史报告提及不视为当前执行依赖。 |
| D:\dsh-research-agent\.acceptance\run-ui-v2-20261029-a563b7ce\release\59BD8E70DECB\dsh-research-agent-0.1.5-rc.7.tgz | TGZ | 187,623 | 无当前安装、运行、测试读取或回滚依赖的历史插件包／冗余副本；保留必要的同 SHA256 安装副本及冻结基线。历史报告提及不视为当前执行依赖。 |
| D:\dsh-research-agent\.acceptance\run-ui-v2-20261029-a563b7ce\release\686163927867\dsh-research-agent-0.1.5-rc.7.tgz | TGZ | 187,625 | 无当前安装、运行、测试读取或回滚依赖的历史插件包／冗余副本；保留必要的同 SHA256 安装副本及冻结基线。历史报告提及不视为当前执行依赖。 |
| D:\dsh-research-agent\.acceptance\run-ui-v2-20261029-a563b7ce\release\F38FA6BDB089\dsh-research-agent-0.1.5-rc.8.tgz | TGZ | 191,513 | 无当前安装、运行、测试读取或回滚依赖的历史插件包／冗余副本；保留必要的同 SHA256 安装副本及冻结基线。历史报告提及不视为当前执行依赖。 |
| D:\dsh-research-agent\.acceptance\run-ui-v2-20261029-a563b7ce\release\dsh-research-agent-0.1.5-rc.7.tgz | TGZ | 187,395 | 无当前安装、运行、测试读取或回滚依赖的历史插件包／冗余副本；保留必要的同 SHA256 安装副本及冻结基线。历史报告提及不视为当前执行依赖。 |
| D:\dsh-research-agent\.acceptance\stability-20261029-dO8P90\release\0D7F7058EE79\dsh-research-agent-0.1.5-rc.8.tgz | TGZ | 191,836 | 无当前安装、运行、测试读取或回滚依赖的历史插件包／冗余副本；保留必要的同 SHA256 安装副本及冻结基线。历史报告提及不视为当前执行依赖。 |
| D:\dsh-research-agent\dist\dsh-native-research-web-0.2.0-rc.1-win32-x64-20261102T025243Z.zip | ZIP | 234,857,412 | 废弃原生 Web 候选 ZIP；使用 rc.9 插件，非当前 rc.5 源码基线；项目文件已有 CRC 一致的解压副本，无当前安装依赖。 |
| D:\dsh-research-agent\dist\dsh-native-research-web-0.2.0-rc.1-win32-x64-20261102T025243Z\plugin\dsh-research-agent-0.1.5-rc.9.tgz | TGZ | 197,573 | 废弃原生 Web 候选目录中的打包 TGZ；只在该旧发布清单中被使用，4 个验收 profile 实际引用的是另一个保留的 .acceptance 副本。 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.0.tgz | TGZ | 90,819 | 无当前安装、运行、测试读取或回滚依赖的历史插件包／冗余副本；保留必要的同 SHA256 安装副本及冻结基线。历史报告提及不视为当前执行依赖。 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.5-rc.1.tgz | TGZ | 176,651 | 无当前安装、运行、测试读取或回滚依赖的历史插件包／冗余副本；保留必要的同 SHA256 安装副本及冻结基线。历史报告提及不视为当前执行依赖。 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.5-rc.2.tgz | TGZ | 178,691 | 无当前安装、运行、测试读取或回滚依赖的历史插件包／冗余副本；保留必要的同 SHA256 安装副本及冻结基线。历史报告提及不视为当前执行依赖。 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.5-rc.7.tgz | TGZ | 187,625 | 无当前安装、运行、测试读取或回滚依赖的历史插件包／冗余副本；保留必要的同 SHA256 安装副本及冻结基线。历史报告提及不视为当前执行依赖。 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.5-rc.8.tgz | TGZ | 191,836 | 无当前安装、运行、测试读取或回滚依赖的历史插件包／冗余副本；保留必要的同 SHA256 安装副本及冻结基线。历史报告提及不视为当前执行依赖。 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.5-rc.9.tgz | TGZ | 196,347 | 无当前安装、运行、测试读取或回滚依赖的历史插件包／冗余副本；保留必要的同 SHA256 安装副本及冻结基线。历史报告提及不视为当前执行依赖。 |
| D:\dsh-research-agent\dist\dsh-research-web-0.1.0-rc.1-win32-x64-20261030T014411Z.zip | ZIP | 206,464,872 | 已放弃的独立 Research Web Windows 发布 ZIP；项目文件与保留的解压副本 CRC 一致，没有唯一源码或用户数据，未发现当前安装或入口依赖。 |
| D:\dsh-research-agent\dist\dsh-research-web-0.1.0-rc.2-win32-x64-20261030T064620Z.zip | ZIP | 206,480,557 | 已放弃的独立 Research Web Windows 发布 ZIP；项目文件与保留的解压副本 CRC 一致，没有唯一源码或用户数据，未发现当前安装或入口依赖。 |
| D:\dsh-research-agent\dist\dsh-research-web-0.1.0-rc.2-win32-x64-20261030T065243Z.zip | ZIP | 206,480,842 | 已放弃的独立 Research Web Windows 发布 ZIP；项目文件与保留的解压副本 CRC 一致，没有唯一源码或用户数据，未发现当前安装或入口依赖。 |
| D:\dsh-research-agent\dist\dsh-research-web-0.1.0-rc.3-win32-x64-20261030T091216Z.zip | ZIP | 206,512,922 | 已放弃的独立 Research Web Windows 发布 ZIP；项目文件与保留的解压副本 CRC 一致，没有唯一源码或用户数据，未发现当前安装或入口依赖。 |
| D:\dsh-research-agent\dist\dsh-research-web-0.1.0-rc.3-win32-x64-20261030T122754Z.zip | ZIP | 206,517,422 | 已放弃的独立 Research Web Windows 发布 ZIP；项目文件与保留的解压副本 CRC 一致，没有唯一源码或用户数据，未发现当前安装或入口依赖。 |
| D:\dsh-research-agent\dist\dsh-research-web-0.1.0-rc.3-win32-x64-20261030T143630Z.zip | ZIP | 206,520,582 | 已放弃的独立 Research Web Windows 发布 ZIP；项目文件与保留的解压副本 CRC 一致，没有唯一源码或用户数据，未发现当前安装或入口依赖。 |
| D:\dsh-research-agent\dist\dsh-research-web-0.1.0-rc.3-win32-x64-20261030T160438Z.zip | ZIP | 206,520,592 | 已放弃的独立 Research Web Windows 发布 ZIP；项目文件与保留的解压副本 CRC 一致，没有唯一源码或用户数据，未发现当前安装或入口依赖。 |
| D:\dsh-research-agent\dist\dsh-research-web-0.1.0-rc.3-win32-x64-20261030T160932Z.zip | ZIP | 206,520,708 | 已放弃的独立 Research Web Windows 发布 ZIP；项目文件与保留的解压副本 CRC 一致，没有唯一源码或用户数据，未发现当前安装或入口依赖。 |
| D:\dsh-research-agent\dist\dsh-research-web-0.1.0-rc.3-win32-x64-20261030T162657Z.zip | ZIP | 206,521,363 | 已放弃的独立 Research Web Windows 发布 ZIP；项目文件与保留的解压副本 CRC 一致，没有唯一源码或用户数据，未发现当前安装或入口依赖。 |
| D:\dsh-research-agent\archive\research-web\apps\research-web\dist\app.css | CSS | 34,924 | archive 中仅存的前端生成文件；与保留的旧 Windows 解压发布目录内 web 文件 SHA256 相同，无当前脚本引用；源文件另存于 .acceptance/native-web-20261102/source-before，非唯一源码。 |
| D:\dsh-research-agent\archive\research-web\apps\research-web\dist\app.js | JS | 248,277 | archive 中仅存的前端生成文件；与保留的旧 Windows 解压发布目录内 web 文件 SHA256 相同，无当前脚本引用；源文件另存于 .acceptance/native-web-20261102/source-before，非唯一源码。 |
| D:\dsh-research-agent\archive\research-web\apps\research-web\dist\index.html | HTML | 344 | archive 中仅存的前端生成文件；与保留的旧 Windows 解压发布目录内 web 文件 SHA256 相同，无当前脚本引用；源文件另存于 .acceptance/native-web-20261102/source-before，非唯一源码。 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.5-rc.7.tgz.sha256 | SHA256 | 101 | 仅对应本轮删除的 dist 历史 TGZ；未被当前安装或脚本读取，校验信息已完整记入本审计。 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.5-rc.8.tgz.sha256 | SHA256 | 101 | 仅对应本轮删除的 dist 历史 TGZ；未被当前安装或脚本读取，校验信息已完整记入本审计。 |

10 个 ZIP 的项目文件（排除第三方 node_modules 和 node 运行时）已逐包与保留解压副本核对 CRC，均相同，未见项目用户数据。archive 中三个前端生成文件与保留发布副本的 SHA256 相同，src/main.tsx 和 build-web.mjs 另有完整源码备份。

## 3. 保留文件

| 完整路径 | 类型 | 字节 | 保留原因 |
| --- | --- | ---: | --- |
| D:\dsh-research-agent\.acceptance\native-web-production-I9znjB\unpacked\plugin\dsh-research-agent-0.1.5-rc.9.tgz | TGZ | 197,573 | 4 个已存在的原生 Web 验收 profile 的依赖与锁文件直接引用；不破坏其重装链路。 |
| D:\dsh-research-agent\.acceptance\run-20261027-RV7z7X\baseline-0.1.4.tgz | TGZ | 176,110 | .acceptance/final-integrity.mjs 直接读取的冻结基线包。 |
| D:\dsh-research-agent\.acceptance\run-ui-v2-20261029-a563b7ce\release\0D7F7058EE79\dsh-research-agent-0.1.5-rc.8.tgz | TGZ | 191,836 | run-ui-v2 验收 desktop profile 的依赖和锁文件直接引用。 |
| D:\dsh-research-agent\.acceptance\stability-20261029-dO8P90\release\250c021b69b7\dsh-research-agent-0.1.5-rc.9.tgz | TGZ | 196,347 | stability 验收 desktop profile 及 candidate.json 直接引用。 |
| D:\dsh-research-agent\.acceptance\web-plugin-veFFKg\bundle\dsh-research-agent-0.1.5-rc.9.tgz | TGZ | 197,437 | web-plugin-veFFKg 验收 desktop profile 的依赖和锁文件直接引用。 |
| D:\dsh-research-agent\.acceptance\web-rc3-plugin-dSalqm\bundle\dsh-research-agent-0.1.5-rc.9.tgz | TGZ | 197,573 | web-rc3-plugin-dSalqm 验收 desktop profile 的依赖和锁文件直接引用。 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.1.tgz | TGZ | 175,866 | 回滚事务 plugin-20261027-001949-978-309d0e67 的 previousSpec 仍引用此路径。 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.2.tgz | TGZ | 176,049 | 回滚事务 plugin-20261027-003621-973-785e0413 的 previousSpec 仍引用此路径。 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.3.tgz | TGZ | 176,097 | 回滚事务 plugin-20261027-004326-578-28d4fd6d 的 previousSpec 仍引用此路径。 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.4.tgz | TGZ | 176,110 | 正式 Desktop、隔离 web profile 的 package.json 与锁文件直接引用；安装、回滚基线。 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.5-rc.3.tgz | TGZ | 178,689 | 当前 README、DEVELOPMENT 仍给出安装命令；.acceptance/package-audit.mjs 直接读取该文件。 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.5-rc.4.tgz | TGZ | 179,184 | 回滚事务 plugin-20261028-155700-704-1f76c1cc 的 previousSpec 仍引用此路径。 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.5-rc.5.tgz | TGZ | 180,997 | 与当前源码同版本的既有交付证据；隔离 web-preview-rc5-20261102 profile 直接引用。尚未宣称当前源码可复现此包。 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.5-rc.6.tgz | TGZ | 182,395 | .acceptance/run-20261027-RV7z7X/home/profiles/desktop 仍安装并直接引用。 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.4.tgz.sha256 | SHA256 | 95 | 正式 Desktop 0.1.4 安装包的现有 SHA256 校验文件；内容已核实与保留 TGZ 一致。 |

全部保留文件重新计算 SHA256，均与执行前一致。rc.5 TGZ 是既有交付证据及隔离预览依赖，尚未证明当前源码能逐字节复现它。

## 4. 未清理的旧目录

| 完整路径 | 归属与结论 | 后续建议 |
| --- | --- | --- |
| D:\dsh-research-agent\.web-runtime | 旧独立工作台运行副本；当前根脚本无启动入口，但 .acceptance/debug-web-question.mjs 仍引用 server.mjs。需要进一步核实。 | 审计历史调试依赖及全部本地文件后再退役，整体保留。 |
| D:\dsh-research-agent\.native-web-runtime | origin.json 记录来自 F:\deepseek\resources\app.asar 的旧原生 Web 候选副本，科研插件 rc.9；不是当前 rc.5 构建。需要进一步核实。 | 保留版本混用证据，核验来源和调用关系后另行清理。 |
| D:\dsh-research-agent\.research-web | 有 home/profiles、研究状态和 workspace；仍有数据保留用途。 | 保留整个目录，未来先明确数据归档要求。 |
| D:\dsh-research-agent\archive\research-web | 现场仅三个旧前端生成文件，确认无用且有重复副本，已逐个删除；没有删除目录。 | 目录结构保留，未删除任何源码归档。 |
| D:\dsh-research-agent\progress-repo | 独立嵌套 Git 仓库，HEAD ffe11483414669f81ef4f56cb59f7e8d40ebbcf7；仍有保留用途。 | 完整保留。 |
| D:\dsh-research-agent\.isolated | 历史测试数据及独立 rc.5 Web 预览；仍有用途。 | 全部保留。 |
| D:\dsh-research-agent\.acceptance | 测试 home、Session、workspace、验收证据、源码备份和仍被 profile 引用的 TGZ；仍有用途。 | 只删除明确列出的六个冗余 TGZ，其余保留。 |
| D:\dsh-research-agent\.acceptance\native-web-20261102\source-before | 包含旧工作台 src/main.tsx、构建脚本和其他历史源码；属于源码备份。 | 完整保留。 |
| D:\dsh-research-agent\dist 下 9 个旧独立工作台解压目录、1 个旧原生 Web 解压目录 | 解压发布副本，包含运行时、启动脚本、依赖和历史证据；未完成逐文件来源和数据审计，需要进一步核实。 | 整体保留。本轮仅删除其中一个无当前依赖的 TGZ；这些目录不能作为 rc.5 基线使用。 |
| D:\dsh-research-agent-backups\before-github-reset-20261102T045907Z；Git 备份分支；D:\dsh-migration-backup | Git 回退、源码和插件事务备份。 | 完整保留。 |
| D:\DeepSeekHarness\data；F:\deepseek；项目缓存与 node_modules | 正式 DSH_HOME、正式安装、开发依赖。 | 全部保留。 |

## 5. 数据完整性

- HEAD 未变：True；173 个跟踪文件内容未变：True。
- lib、正式 EXE、app.asar 和关键 profile 配置的 SHA256 未变：True。
- 所有删除文件确实不存在：True；所有保留文件内容未变：True。
- 删除后重新扫描，压缩包集合与保留清单完全一致：True。
- 正式 desktop 安装版本：0.1.4；正式 web 存在科研插件：False。

| 受保护路径 | 文件数 | 前后整体哈希一致 |
| --- | ---: | --- |
| D:\dsh-research-agent\.isolated\web-preview-rc5-20261102\home | 11 | True |
| D:\dsh-research-agent\packages\research-agent\lib | 31 | True |
| D:\dsh-research-agent\.git | 1159 | True |
| D:\DeepSeekHarness\data\profiles\desktop\node_modules\dsh-research-agent | 33 | True |
| D:\dsh-research-agent\.research-web\home | 8 | True |
| D:\dsh-research-agent\.research-web\workspace | 0 | True |
| D:\dsh-research-agent\.isolated\home | 72 | True |
| D:\dsh-research-agent\progress-repo | 44 | True |
| D:\DeepSeekHarness\data\sessions | 192 | True |
| D:\DeepSeekHarness\data\storages | 194 | True |
| D:\DeepSeekHarness\data\profiles | 21 | True |
| D:\dsh-migration-backup | 396 | True |

数据树核验不输出会话、研究记录或凭据正文；依赖目录不作为用户数据遍历。正式已安装科研插件另作完整哈希核验。删除前检查相关进程命令行，未命中待删路径；28 个候选均通过排他只读打开检查。未启动或结束正式 Desktop，未修改配置、模型、API Key、插件、Session、源码、Electron 或远程 Git。
正式 Desktop 原有进程仍存在：True。

## 6. 清理成果

- 删除 10 个 ZIP、13 个 TGZ、2 个校验边车和 3 个旧前端构建文件，共 28 文件。
- 精确逻辑释放量：2,096,025,737 字节，约 1.952 GiB。
- 剩余 14 个 TGZ，共 2,582,263 字节；其中 dist 8 个、验收目录 6 个。
- 扫描范围内旧独立工作台 ZIP 和旧原生 Web 候选 ZIP 均为 0；无依赖的历史发布 TGZ 已按清单删除。
- NTFS 删除前净可用空间未持久化，故不声称实测净可用空间差；以上数字依据已验证删除的文件原始长度。
- 清理只解决废弃发布文件问题，不代表 rc.5 构建可信、版本混用已消除或代码质量问题已解决。

## 7. 下一阶段（本次未执行）

1. 在隔离目录固定 f8f3ddf、rc.5 和锁文件，处理已知 SDK 类型依赖问题，建立可复现构建；对照既有 rc.5 TGZ 记录差异，先验证，再替换混用 lib。
2. 用独立 DSH_HOME 验证“官方原生 Web + 当前源码构建的科研插件”；明确正式 web 仍缺插件，后续部署单独处理。
3. 建立 rc.5 的类型检查、lint、单测和必要隔离验收基线，再按新证据排序代码问题。本次没有运行构建或功能测试。
4. 安装脚本当前仍按修改时间自动选择 dist 包，清理后会落到保留的 rc.6。下一阶段应显式指定经验证的包路径，并考虑修正默认选择逻辑。
5. 明确旧测试 profile 和回滚事务的退役条件，解除真实引用后再清剩余包；逐目录审计解压发布副本和两个旧运行时，先保障数据与源码备份。

## 完整文件哈希及执行日志

同名 JSON 记录所有候选的完整路径、类型、版本／阶段、大小、SHA256、分类、profile 引用、实际删除时间、排他读检查，以及执行前后 Git、lib 和数据树快照。

| 完整路径 | 状态 | SHA256 |
| --- | --- | --- |
| D:\dsh-research-agent\.acceptance\native-web-production-I9znjB\unpacked\plugin\dsh-research-agent-0.1.5-rc.9.tgz | retained_verified | d43635c5c1b7c13d8931daec09a01e3febce91a99723389be9c51441948f58b8 |
| D:\dsh-research-agent\.acceptance\run-20261027-RV7z7X\baseline-0.1.4.tgz | retained_verified | 57904ecfc84b4af9a9f925ac2e1d7d662fc8d6707c1b5d62ae2f515b1fbf78f6 |
| D:\dsh-research-agent\.acceptance\run-20261027-RV7z7X\dsh-research-agent-0.1.5-rc.4.tgz | deleted | fe3686e1f9eb23462d2b2692599e53c1b3440bcf268a2fff92a5e59aa9a96a7e |
| D:\dsh-research-agent\.acceptance\run-ui-v2-20261029-a563b7ce\release\0D7F7058EE79\dsh-research-agent-0.1.5-rc.8.tgz | retained_verified | 0d7f7058ee79a971ae18a16ee0384634efc93f83e48480ff0f11920505fa1e9b |
| D:\dsh-research-agent\.acceptance\run-ui-v2-20261029-a563b7ce\release\59BD8E70DECB\dsh-research-agent-0.1.5-rc.7.tgz | deleted | 59bd8e70decb1655c8fd12d4d3ae048a2d805cd86b3c042782086f82a2fea52d |
| D:\dsh-research-agent\.acceptance\run-ui-v2-20261029-a563b7ce\release\686163927867\dsh-research-agent-0.1.5-rc.7.tgz | deleted | 686163927867bca6ac6995172faaf8d14def80f102f28149106d35584a979256 |
| D:\dsh-research-agent\.acceptance\run-ui-v2-20261029-a563b7ce\release\F38FA6BDB089\dsh-research-agent-0.1.5-rc.8.tgz | deleted | f38fa6bdb0897e44524e98848140380791bf5f1aada6f8219b756dd70f1f2716 |
| D:\dsh-research-agent\.acceptance\run-ui-v2-20261029-a563b7ce\release\dsh-research-agent-0.1.5-rc.7.tgz | deleted | 3c425977cf5ad178c43a485f7ce888b7c1be1fb2ab0445f93bacf5755b093291 |
| D:\dsh-research-agent\.acceptance\stability-20261029-dO8P90\release\0D7F7058EE79\dsh-research-agent-0.1.5-rc.8.tgz | deleted | 0d7f7058ee79a971ae18a16ee0384634efc93f83e48480ff0f11920505fa1e9b |
| D:\dsh-research-agent\.acceptance\stability-20261029-dO8P90\release\250c021b69b7\dsh-research-agent-0.1.5-rc.9.tgz | retained_verified | 250c021b69b7613614e09137d63b774a803e3ec5f311777e660f6b8f63a0d3af |
| D:\dsh-research-agent\.acceptance\web-plugin-veFFKg\bundle\dsh-research-agent-0.1.5-rc.9.tgz | retained_verified | ce35931a92d1d81777297bab5fe3edf11f97a87390ce5ca78a4bcfe0e84be0dc |
| D:\dsh-research-agent\.acceptance\web-rc3-plugin-dSalqm\bundle\dsh-research-agent-0.1.5-rc.9.tgz | retained_verified | d43635c5c1b7c13d8931daec09a01e3febce91a99723389be9c51441948f58b8 |
| D:\dsh-research-agent\dist\dsh-native-research-web-0.2.0-rc.1-win32-x64-20261102T025243Z.zip | deleted | 8f82444ef947e21b08377d182a445a6ee14b0cae16e985f01f54c59068ca75a1 |
| D:\dsh-research-agent\dist\dsh-native-research-web-0.2.0-rc.1-win32-x64-20261102T025243Z\plugin\dsh-research-agent-0.1.5-rc.9.tgz | deleted | d43635c5c1b7c13d8931daec09a01e3febce91a99723389be9c51441948f58b8 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.0.tgz | deleted | 8e26cb3c17433c8fda345d399f74d8ed24dad9a788dc6c9ae1f9a00ee9d445e8 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.1.tgz | retained_verified | 6444792e158525d4a4094cc6b9bafba2f923a3bef72377968edf155301a98a05 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.2.tgz | retained_verified | 678a44c4439a9a39efb58f241505cdaeb410a0cb8c713508262219b56ee0de03 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.3.tgz | retained_verified | da2edd750abc97ec2c4c88249456b0ca2d76f63d453de887a2c397ce6fd9621c |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.4.tgz | retained_verified | 57904ecfc84b4af9a9f925ac2e1d7d662fc8d6707c1b5d62ae2f515b1fbf78f6 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.5-rc.1.tgz | deleted | 62aa060ff1b8d6473c14070d33b83caa5df74e8e6f927fc34d07d974af7d53e5 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.5-rc.2.tgz | deleted | 859cdec3089e2d5a42e99dc227e1e439693c3de8aead4744d09291255686b537 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.5-rc.3.tgz | retained_verified | 254d151e9157ee3f8e35ff8e092d56c37d9956617f3c982cddefa2a1a52f8bd6 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.5-rc.4.tgz | retained_verified | fe3686e1f9eb23462d2b2692599e53c1b3440bcf268a2fff92a5e59aa9a96a7e |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.5-rc.5.tgz | retained_verified | c03fab04702513a7745fc3c652416f7eb21ed8beb7f02d3941811b1ae1bdaeb1 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.5-rc.6.tgz | retained_verified | 99cf22c941f0b67fc9187320ce05d631da8f80da3ad2200bab94e535ffbd4f46 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.5-rc.7.tgz | deleted | 686163927867bca6ac6995172faaf8d14def80f102f28149106d35584a979256 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.5-rc.8.tgz | deleted | 0d7f7058ee79a971ae18a16ee0384634efc93f83e48480ff0f11920505fa1e9b |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.5-rc.9.tgz | deleted | 250c021b69b7613614e09137d63b774a803e3ec5f311777e660f6b8f63a0d3af |
| D:\dsh-research-agent\dist\dsh-research-web-0.1.0-rc.1-win32-x64-20261030T014411Z.zip | deleted | b22286ba903a39334ac6b976888164c90bd6272df8cf8f31e617cb0da5cd1a05 |
| D:\dsh-research-agent\dist\dsh-research-web-0.1.0-rc.2-win32-x64-20261030T064620Z.zip | deleted | da3f9ed350618fb7234bc6d73596cebba93311ff308931e4276138fca5886e18 |
| D:\dsh-research-agent\dist\dsh-research-web-0.1.0-rc.2-win32-x64-20261030T065243Z.zip | deleted | a77e58a889fbbe1e6051609ebc2517386082ae0cd72463601df1c1ff4f8e1899 |
| D:\dsh-research-agent\dist\dsh-research-web-0.1.0-rc.3-win32-x64-20261030T091216Z.zip | deleted | 991b5321dd001a0c3ea53df7474b61c68c6f66abc58e93a8c386121827736d91 |
| D:\dsh-research-agent\dist\dsh-research-web-0.1.0-rc.3-win32-x64-20261030T122754Z.zip | deleted | ac12353949576caebed2b801e712858a9c5d112f93e009170d5cda100a7c7354 |
| D:\dsh-research-agent\dist\dsh-research-web-0.1.0-rc.3-win32-x64-20261030T143630Z.zip | deleted | 9484976a90b25490324f68110c192e32f46b9710aa67f32cb79c0fa651798dc6 |
| D:\dsh-research-agent\dist\dsh-research-web-0.1.0-rc.3-win32-x64-20261030T160438Z.zip | deleted | 4f90619feeccf7c15e5434d1ed9cfebef4ccfd060a3d8c10fb4768ba1b3d09de |
| D:\dsh-research-agent\dist\dsh-research-web-0.1.0-rc.3-win32-x64-20261030T160932Z.zip | deleted | 8099ab4efbf5426769ec3b147f8bbc663925b17a7c13b1ae3e0c16ffddfb98f4 |
| D:\dsh-research-agent\dist\dsh-research-web-0.1.0-rc.3-win32-x64-20261030T162657Z.zip | deleted | 39ecd8611fda3787b58efca1f7509563feacc37a3bc998a646a3934e1e8e85df |
| D:\dsh-research-agent\archive\research-web\apps\research-web\dist\app.css | deleted | 992feb89e6c9147b87d9d1fc16ed35a526d86c99722e2fc84a3cceabc6d8e6b6 |
| D:\dsh-research-agent\archive\research-web\apps\research-web\dist\app.js | deleted | edf42963311545174e5e7f31f783a6f772553d6228b2a392cd44f54d2cf339fc |
| D:\dsh-research-agent\archive\research-web\apps\research-web\dist\index.html | deleted | 059a88c1bc469f904dcdf8bbd3ad0c5f8bc90279d2a87729acfa3ea80801392a |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.5-rc.7.tgz.sha256 | deleted | fa433aae74b0f3d2eb44efaa307de334d0dec228245fb15d1083ed549e6fea15 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.5-rc.8.tgz.sha256 | deleted | 0970c594f4de564b8b3b696f7d789bc033548a112cc3b01caac99b7a81abc8f4 |
| D:\dsh-research-agent\dist\dsh-research-agent-0.1.4.tgz.sha256 | retained_verified | 590ebbf1767caa57a7f5c0a27a2a69aaff2584fd1231bbaf47e961ae8884ba92 |

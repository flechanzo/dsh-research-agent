# ReplaceFileW EIO 调查（2026-11-02）

结论：在未修改的官方 Nightly 0.2.1-rc.5 ASAR 中，独立调用 LocalFileSystem.writeText 可在 D 盘串行合成文件替换时复现 Win32 1175。插件协调器、侧车并发和科研数据均不参与这个最小复现。故插件不能通过修改自己的写入时序保证修复该错误；不声称官方库自身缺陷或具体过滤驱动已获证明。

证据目录：`.acceptance/rubric170-20261102`，完整脚本、原始输出、官方抽取源码与 ACL 保留于该目录。

| 场景 | 串行150 | 同目标并发80（官方锁串行化） | Node读句柄60 |
| --- | --- | --- | --- |
| D盘普通路径 | 4次1175 | 1次1175 | 3次1175 |
| C盘本地Temp | 0 | 0 | 0 |
| D盘中文长路径 | 0 | 0 | 0 |

三组故意用不共享删除的Win32读句柄占用目标，均返回32（sharing violation），不是1175；共享删除的句柄均成功。关闭句柄后均可再次写入。未关闭其他应用句柄、未修改安全软件和索引器配置。

C、D均为本地NTFS且空间充足。官方写入在目标同级创建私有临时目录，先复制DACL、写入和sync，再await close，最后ReplaceFileW；故此实现没有跨卷临时目录，也没有遗漏关闭该临时写句柄。普通路径在不带主动读取时已失败，不能据此归因于读句柄。D盘长路径未失败也不证明长路径能治愈问题。微软官方系统错误文档将1175定义为ERROR_UNABLE_TO_REMOVE_REPLACED / Unable to remove the file to be replaced。

Defender查询返回Not running、实时防护关闭；WinDefend停止、WSearch运行。不能把错误归咎于Defender；尚无内核级handle/filter追踪来归属外部进程或索引器。本轮不关闭安全设施、不安装驱动。历史首次失败的进程瞬时状态不可追溯。

恢复边界：权威research domain提交与侧车导出不同事务。保留原始失败；增加显式重同步当前revision的科研文件操作，串行、检查expectedRevision、不再调用模型、不递增revision。重同步失败继续显示，成功可观察。该操作恢复投影，不是修复ReplaceFileW根因，也不加入自动重试。

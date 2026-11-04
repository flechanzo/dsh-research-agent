# 科研流程修复与真实运行结果（2026-11-04）

正式 Desktop 已安装 **0.1.6-rc.12**。主流程已完成并保存科研方案；**真实 Rubric 数值评分尚未完成，当前为证据不足，S=null**。

## 已完成

- 创新提出、定向检索、仅创新性评审、方案生成和文件保存；主流程 revision 13，node-12，状态 completed。
- 本次修复候选辅助引用误判、第三轮策略标签、Windows 检查点保存、首次模型身份与恢复复用等故障。342 项测试、类型检查和 Lint 通过。
- 隔离 Desktop 验证三轮查新及计分可完成；重启前 6 个模型阶段全部复用，恢复仅调用剩余 11 个。该 S=0 为本地夹具负对照，不能作为真实候选评分。
- Rubric 仅运行 originality-only。未安排数据质量、实验结果或复现审查；未运行仿真或实际训练。

## 正式模型实测

- 模型：原生选择器 gpt-6-sol；沿用原账号。
- 审计：`8c2064de-5303-4e07-b166-cd1e7cb338e0`；检查点：`333be567-57d0-4065-b000-57154b43d728`。
- 三轮查询均已发起；前两轮审查通过，第三轮未通过证据充分性门槛。13 次模型调用、35 次网络操作。
- 已取得完整原文：DoRA: Weight-Decomposed Low-Rank Adaptation（23 页）；BiDoRA: Bi-level Optimization-Based Weight-Decomposed Low-Rank Adaptation（25 页）；BoRA: Bi-dimensional Weight-Decomposed Low-Rank Adaptation（13 页）；Understanding and Guiding Layer Placement in Parameter-Efficient Fine-Tuning of Large Language Models（29 页）；NormTune: Norm-Guided Parameter-Efficient Fine-Tuning for Reasoning-Intensive Tasks（22 页）。
- 第三轮停止原因：三轮查询后关键材料/替代解释仍未解决，不能以次数代替充分性。
- 旧流程 72/100 与 Rubric 0–10 不是同一量表，不将旧分数充作 Rubric 分数。

## 尚需补齐的创新性证据

- `https://openreview.net/forum?id=rPqBKvqITW`：缺少动态秩分配方法正文，无法核对评分及选择对象。
- `https://arxiv.org/abs/2609.25058v1`：缺少ChainDoRA方法正文。
- `https://arxiv.org/abs/2510.04331v2`：缺少DoRAN方法正文，且本轮获取记录缺失。
- `https://openreview.net/forum?id=3n9nfmmLmI`：该页面正文未取得，与已读NormTune arXiv版本的对应关系未核实。
- 前轮新发现的梯度重要性及自适应秩分配技术近邻缺少方法正文；若其机制影响矩阵选择或梯度路径归属，仍须补核。

OpenReview 的动态秩论文正文多次返回 403，未绕过站点挑战。NormTune 已通过 arXiv 取得 22 页正文，但模型仍要求核验与候选所引 OpenReview 版本的对应关系。DoRAN 曾读至 30 页上限，随后重取 PDF 又超时；ChainDoRA 未被本轮选入读取来源。以上均是先例方法/版本证据缺口，不是数据审查。

继续时需提供或取得上述原文和版本对应证据。有效检查点仍在；不要直接修改分数或把缺口当作已经排除。

## 文件与验证记录

- 最终科研方案：`F:/Documents/deepseek-harness/default-workspace/research-projects/session-c60b0266-5320-4cf4-9733-73edc6fd530c/plans/branch-2/revision-13/research-plan.md`。
- 本次结构化结果：[innovation-real-2026-11-04.json](validation/innovation-real-2026-11-04.json)。
- 完整修复说明：[IDEATION_FIX_2026-11-04.md](IDEATION_FIX_2026-11-04.md)。
- 已安装源码 SHA256：`d5a6f03f7bc296c9f04c772e157ccd4d12b6d7e98bbcca9ab5fc507e25ead812`。
- 真实模型报告输入 256354 tokens、输出 13939 tokens；费用尚无可靠货币统计。

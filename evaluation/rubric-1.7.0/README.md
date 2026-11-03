# Rubric 1.7.0 公开验证材料

cases.json 包含重复、A/B/C/D/E/P 边界及证据不足/冲突材料，涉及参数适配、语言理解、检索问答、机器翻译、对抗鲁棒性等领域。boundaryFocus 是待检验问题，绝非金标准类别。所有公开论文均无预设科学分数。

运行 `node --experimental-strip-types scripts/acquire-rubric-corpus.mjs <新的输出目录> [逗号分隔caseId]`。程序使用真实公开HTTPS，限制来源、字节数、页面数、请求和超时，保存原始响应、PDF、正文、哈希、获取日志和评分盲审资料。独立采集的HTML传输明确标为public-web，不能冒充Desktop官方Web或pipeline已完成科学审查。资料采集三轮只是待复核材料，不满足科学查新完成声明，也不会生成分数。

historical-exploratory 必须核实实际版本日期；后来的正式版本只可对照版本差异，不能倒推早期原创性。modern-reproduction 则检验今天复述公开方法的重复性，不能等同论文发表时原创性。

`innovation/reviews.ts` 提供实名来源声明、任务/日期/版本一致性约束和配对分歧分析。分歧区分检索证据、类别、贡献独立性及旧体系。不以同源模型数量冒充专家。未取得实际独立专家审查；当前没有专家校准结论。

独立审查收齐后，可运行 `node --experimental-strip-types scripts/compare-rubric-reviews.mjs reviews.json report.json` 生成配对分歧报告。输入必须是同一 case、target_task 摘要、比较日期和 Rubric 哈希的 JSON 数组；数值审查必须提供当前确定性 scorer 输入。独立性声明仍需外部核验。

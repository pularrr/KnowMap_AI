# Step 3：接续确认的 MVP 完整研究

输入：隔离任务目录中的 mvp.json 与用户对该版本的明确确认。输出：同一隔离目录中的 full.json。读取 [完整开发提示词](../prompts/full-development-prompt.md)。

只有在用户明确验收 MVP 及预算后，宿主 LLM 才能接续 MVP 编写完整 `{phase:"full",topic,profile,network,generatedBy:"host-llm",confirmedMvp:true,mvpConfirmation:{confirmed:true,approvedBudget:{durationMinutes,visitTopicCount,maxModelCalls},...}}`。缺少任一预算项或明确验收时必须停留在 MVP 展示阶段。禁止调用 `knowmap.mjs full`、项目 KnowledgeGenerator、DeepSeek 配置或任何项目内 Provider。只调用确定性校验：
```sh
node scripts/knowmap.mjs validate --input <隔离任务目录>/full.json --output <隔离任务目录>/full-validation.json
```

full 必须继承已确认 Profile 和 MVP，不重新初始化知识树。宿主可分批编写节点、卡片和关系，但每批先按 [先总后分的层级构造法](../references/hierarchy-construction.md) 审查无卡片骨架，再按 [知识卡语义与内容判定](../references/knowledge-card-semantics.md) 扩写卡片并保存到隔离目录，最后统一合并校验。

维护明确的待扩展节点队列。取出任一节点时，把它作为新的局部根，重新分配完整的观察/推理轮次、静默计数和局部新增节点额度；祖先或前序节点的消耗不得减少它的扩展额度。新增孩子必须加入队列。整次任务的时间、调用和访问主题预算是安全停止条件，不是树深或单节点扩展上限；停止时列出未访问队列。不得用从总根累计的 `maxDepth` 截断，完整网络的主要域通常应有不少于6层的代表路径，并以“再拆分是否仍产生独立知识实体”判断是否继续。

`confirmedMvp` 必须是用户对当前 MVP 与预算的明确确认。执行使用已批准预算：时间或非叶父主题数任一达到即保存检查点并停止；默认上限300，确认没有下级节点的拓扑叶子不计数。调用数使用批准的宽松保险丝，默认4096。如果 Profile、域、根节点、主题范围或预算发生变化，原确认失效，必须重新生成并验收 MVP。

80–150是知识节点建议目标，不是截断上限。卡片栏目数量由任务语义决定，不要求每节点5项或填满13项；空泛栏目应省略。未覆盖内容作为 gaps 交付审查。

失败：保留隔离目录中的已完成批次，修复后写新文件并重跑 validate。不得向 KnowMap 项目的 data/runtime/research 写构建检查点。

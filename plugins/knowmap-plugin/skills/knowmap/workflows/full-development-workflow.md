# Step 3：接续确认的 MVP 完整研究

输入：隔离任务目录中的 mvp.json 与用户对该版本的明确确认。输出：同一隔离目录中的 full.json。读取 [完整开发提示词](../prompts/full-development-prompt.md)。

用户确认后，宿主 LLM 直接接续 MVP 编写完整 `{topic,profile,network,generatedBy:"host-llm"}`。禁止调用 `knowmap.mjs full`、项目 KnowledgeGenerator、DeepSeek 配置或任何项目内 Provider。只调用确定性校验：
```sh
node scripts/knowmap.mjs validate --input <隔离任务目录>/full.json --output <隔离任务目录>/full-validation.json
```

full 必须继承已确认 Profile 和 MVP，不重新初始化知识树。宿主可分批编写节点、卡片和关系，但每批先按 [先总后分的层级构造法](../references/hierarchy-construction.md) 审查无卡片骨架，再扩写卡片并保存到隔离目录，最后统一合并校验。

80–150是知识节点建议目标，不是截断上限。卡片栏目数量由任务语义决定，不要求每节点5项或填满13项；空泛栏目应省略。未覆盖内容作为 gaps 交付审查。

失败：保留隔离目录中的已完成批次，修复后写新文件并重跑 validate。不得向 KnowMap 项目的 data/runtime/research 写构建检查点。

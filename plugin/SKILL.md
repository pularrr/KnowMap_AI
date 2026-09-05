---
name: knowmap-plugin
description: 从主题创建可交互的知识图谱 AI 应用：设计 Profile、生成 MVP 并确认、研究完整网络、校验后复制应用模板并注入数据。用于新建主题知识网络；已有图谱内的提问和资料接入使用应用运行时。
metadata:
  compatibility: 需要本地文件和命令工具、Node.js >=22.13.0；模型生成使用项目配置的 Responses 协议提供商。
---

# KnowMap：构建应用的插件

工作目录为包含 package.json、scripts/、templates/app/ 的完整项目根目录。宿主 LLM 执行本文件；应用内部 Agent 执行另一套运行时工作流。不要要求模型重写已有 UI 或研究引擎。

## 入口与发现

先执行 `node scripts/knowmap.mjs discover` 获取机器可读能力描述。宿主可以导入 `discoverKnowmap()`（plugin/discovery.mjs），注册其 name、description、inputSchema，并把工具执行映射到 `runKnowmap({ action, input, output })`（scripts/knowmap.mjs）。宿主需要自行适配工具协议、解析绝对文件路径并执行本地命令。此函数不会自动安装插件或使未接入工具的聊天模型获得执行能力。

第一次运行先 `npm install`。命令写新文件，输出已存在时失败，避免覆盖检查点。所有 Key 只从环境 LLM_API_KEY / LLM_BASE_URL / LLM_MODEL 或当前目录 data/runtime/llm-config.json 读取；不写入请求、Profile 或生成应用。

## 两层工作流

| 层 | 执行者与产物 | 入口 |
| --- | --- | --- |
| 插件构建层 | 宿主 LLM → Profile + network → 独立 Next.js 应用 | scripts/knowmap.mjs、scripts/create-app.mjs |
| 应用运行层 | Node.js Agent → 回答、研究候选与确认后的图谱更新 | /api/agent/chat、/api/agent/jobs、/api/knowledge/ingest |

两层共用 provider、collectAdaptiveResearch、validateKnowledgeDataset。构建阶段 ProfileDesigner 也会用 Key；若宿主直接编写 Profile，则无需额外调用设计器。发现入口与运行时 API 协议兼容性相互独立。

## 七步构建流程

确认主题和输出目录，有信息时直接使用，不重复追问。所有示例在项目根执行。详细请求 JSON 和失败处理见下列工作流。

| 步骤 | 调用 / 输入 | 输出 | 验证 |
| --- | --- | --- | --- |
| 1 Profile | [设计工作流](workflows/profile-design-workflow.md)，design 或宿主编写 JSON | work/profile.json | validate-profile：字段、引用和当前引擎支持范围 |
| 2 MVP | [MVP 工作流](workflows/mvp-generation-workflow.md)，mvp，topic + profile | work/mvp.json：profile、network、统计、warnings | validate；展示域树、节点和2–3张卡，请用户确认方向 |
| 3 完整开发 | [完整工作流](workflows/full-development-workflow.md)，full，确认过的 MVP 加 confirmedMvp:true | work/full.json | 接续原网络；研究最多35分钟；报告未解决缺口 |
| 4 合并审查 | [审查工作流](workflows/validation-workflow.md)，validate + 宿主语义审查 | work/reviewed.json、校验报告 | 修复结构错误；逐项审查粒度 warning；重跑校验 |
| 5 脚手架 | create-app.mjs --profile-file work/profile.json --name my-map --output work/my-map | 应用代码、激活的 Profile、空运行时目录 | Profile ID、真实 root ID、依赖完整 |
| 6 注入 | knowmap.mjs inject --input work/reviewed.json --output work/my-map | data/runtime/knowledge-state.json | 使用 RuntimeKnowledgeRepository 生成封装和 checksum，并回读比较 |
| 7 交付 | 产物目录 npm install、npm run type-check、npm test、npm run build、npm run dev | 可启动应用、验收记录 | 图谱、聊天、卡片、LaTeX、字号、资料入口；区分离线检查和真实提供商验收 |

MVP 未确认时停在展示阶段；用户已经确认则继续，不重复索要确认。调整域、根或主题范围后重新展示 MVP。confirmedMvp 是宿主传递的用户确认标记，不是自动生成的审批证据。

## 质量与预算

- 域数、节点数、类型数、栏目数是建议，不按固定数量凑内容。MVP 建议15–30节点，完整建议80–150节点；不设输出节点数硬上限。
- 当前引擎支持基础11种节点类型、12种边类型、13种栏目；可选子集。新类型或新栏目不能只靠 JSON 获得 UI 和工具支持，需要扩展引擎。配色使用 foundation/signal/data/system/ai，语义域 ID 可自定义。
- MVP 在根主题上执行2–3轮，最多2次浅搜索，禁用拆分子调用；只保留 definition。完整模式逐主题重置轮次，按时间、调用、访问主题预算停止。“访问主题预算”不是输出节点上限。
- 35分钟约束研究阶段；安装、构建、人工审查额外计时。不把预算耗尽称为收敛，不把模拟输出称为真实检索。
- 多概念、名称>20字、摘要>80字、problem 混入方法由共享校验产生 warning。拆分应同步修复父级、卡片和边；不要机械截断名字或凭字符串命中删除知识。
- KnowledgeNetwork 是 nodes/cardBlocks/relations（可带 evidence）；KnowledgeDataset 是 nodes/cards/edges/domains/formulas；runtime 文件还有 state、schemaVersion、checksum。不可将裸 network 直接改名成 knowledge-state.json。

## 应用运行时

只在已有应用中研究节点时读[深搜工作流](workflows/deep-search-workflow.md)；导入资料时读[资料工作流](workflows/knowledge-ingest-workflow.md)。运行时研究结果经过应用现有审查/确认机制写入，不使用构建层 inject 覆盖已有状态。

## 故障与恢复

模型格式错误由共享 provider/research 输出模块有限重试、修复和截断恢复。结构转换失败时保留结果文件，修复 JSON 后重新 validate。研究批次存于 data/runtime/research；当前不承诺自动从这些批次恢复遍历队列。完整模式可以从一个已审查的网络重新发起研究，此操作是新一轮研究。

生成产物包含本插件说明和命令，但不递归包含 templates/app。若要再次创建应用，调用原始完整插件项目中的脚手架。不要宣称单个生成应用能够无限自举。

参考基准提交 b45dd0c。开发审查与验证记录见 ../docs/plugin-audit-plan.md 和 ../docs/plugin-audit-results.md。

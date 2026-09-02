# FMCW 雷达 AI 知识图谱

这是一个可独立运行、可通过交互持续生长的 FMCW 雷达知识图谱应用。未配置任何 AI API Key 时，它仍是完整的离线知识可视化应用；后续接入模型时，知识写入会经过提案、审查、差异预览和用户确认。

## Windows 本地运行

需要 Node.js 22.13 或更高版本。在包含 `package.json` 的目录打开 PowerShell：

```powershell
npm.cmd ci
npm.cmd run dev
```

浏览器打开终端显示的地址，通常为 `http://localhost:3000`。生产构建与启动：

```powershell
npm.cmd run build
npm.cmd run start
```

默认命令使用标准 Next.js，不依赖 Sites、Cloudflare、数据库或 API Key。原 Sites/Vinext 入口只作为兼容命令保留：`dev:sites`、`build:sites`、`start:sites`。

## 当前架构

- `app/`：页面入口与 P0.4 原始知识数据，保留原 SVG 设计基线。
- `core/knowledge/`：节点、卡片、公式、typed edge、校验与同层优先遍历。
- `data/knowledge/`：98 节点零损迁移、11 个语义域和首批深度知识切片。
- `data/repositories/`：可替换的知识仓库接口与离线静态实现。
- `features/knowledge-graph/`：树、SVG 图谱、知识卡片、LaTeX 公式与视图适配。
- `core/agent/`、`server/agent/`：离线四 Agent 合约、审查门禁、GraphPatch、确认、回滚与审计重放。

## 知识关系与卡片

节点和连线只表达知识之间的关系，包括父子、相似/替代、依赖、输入输出等。右侧卡片承载定义、原理、假设、步骤、工程取舍、失效条件、验证、对比、应用、研究主题和短代码等内容。局部图谱采用有界的关系优先遍历：显式相似/替代关系优先，其次是可比较同级、子级、依赖和输入输出关系。

首个扩展切片已纠正并展开 LS、ML、MAP、MMSE 以及统计门控、马氏距离、GNN、JPDA、Hungarian、PDA 的层次和关系。此处 GNN 明确区分 Global Nearest Neighbor 与 Graph Neural Network。

## Agent 写入规则

离线工作流为：对话摘要和当前节点 → Knowledge Agent 候选与证据 → Review Agent 结构审查 → Build Agent 生成确定性 GraphPatch 和 SVG 差异预览 → Development Agent 编排 → 用户确认、要求修订或拒绝。未经确认不写入；支持幂等提交、追加式回滚和审计重放。

## 验证

```powershell
npm.cmd test
npm.cmd run build
```

测试覆盖原 98 节点零损往返、领域和层级校验、同层优先遍历、可见图投影、公式/UI 契约，以及四 Agent 的确认与回滚安全链路。

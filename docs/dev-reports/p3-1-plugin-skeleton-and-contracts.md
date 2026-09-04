# P3-1 开发报告：插件骨架与契约

**日期**：2026-09-04
**阶段**：P3-1 插件骨架与契约
**状态**：已完成
**提交**：待提交

## 一、开发目标

建立插件的目录结构、契约 schema 和基本文档，不动当前项目代码。为 P3-2（Profile 抽取与加载机制）提供契约基础。

## 二、交付物清单

### 1. 目录结构

```
plugin/
├── SKILL.md              # 插件核心文档
├── plugin.json           # 插件元数据
├── README.md             # 插件说明
├── contracts/            # 4 个核心契约 schema
│   ├── index.ts          # 统一导出
│   ├── task-profile.ts   # TaskProfile 契约
│   ├── research-candidate.ts  # ResearchCandidate 契约
│   ├── mvp-output.ts     # MvpOutput 契约
│   └── plugin-state.ts   # PluginState 契约
├── workflows/            # 工作流文档（P3-5 完善）
├── prompts/              # 提示词模板（P3-5 完善）
└── examples/             # 示例（P3-5 完善）

profiles/                 # Profile 定义目录（P3-2 开发）
docs/dev-reports/         # 开发报告备份目录
```

### 2. 4 个核心契约 schema

#### 2.1 TaskProfile（主题配置契约）
**文件**：`plugin/contracts/task-profile.ts`

**核心字段**：
- `id` / `name` / `description` / `version`：基本信息
- `domains: DomainDef[]`：域定义（FMCW=11 个）
- `visualBranches: string[]`：视觉分支（FMCW=5 个）
- `nodeTypes: NodeTypeDef[]`：节点类型定义，每种类型含 `singular`（只放一个什么）和 `forbidden`（禁止什么）
- `edgeTypes: EdgeTypeDef[]`：边类型定义，含方向（directed/symmetric）
- `cardSections: CardSectionDef[]`：知识卡栏目定义
- `validation: ValidationConfig`：审查规则配置（域数量、视觉分支数量从 Profile 读取）
- `prompts: PromptConfig`：提示词配置（react/review/finalResponse/ingest）
- `initialization: InitializationConfig`：初始化策略（MVP vs 完整开发的参数）

**内置基础类型**：
- `BASE_NODE_TYPES`：11 种基础节点类型（含节点粒度语义）
- `BASE_EDGE_TYPES`：12 种基础边类型（含方向定义）

#### 2.2 ResearchCandidate（知识候选契约）
**文件**：`plugin/contracts/research-candidate.ts`

**核心字段**：
- `summary` / `rationale`：本批研究摘要和理由
- `coverageAssessment`：覆盖度评估（已覆盖/缺少栏目）
- `gaps: ResearchGap[]`：仍需探索的缺口（含优先级）
- `converged: boolean`：是否收敛
- `proposal.newNodes: ProposedNode[]`：新节点候选
- `proposal.cardBlocks: ProposedCardBlock[]`：新卡片块候选
- `proposal.relations: ProposedRelation[]`：新关系候选
- `proposal.evidence: Evidence[]`：证据（含 verified 标记）

**辅助类型**：
- `CandidateValidationResult`：候选验证结果（含节点粒度统计）
- `CandidateIssue`：验证问题（含修复建议）
- `BatchMergeResult`：批量合并结果

#### 2.3 MvpOutput（MVP 输出契约）
**文件**：`plugin/contracts/mvp-output.ts`

**核心字段**：
- `phase: "mvp"`：阶段标识
- `profileSummary: ProfileSummary`：Profile 设计摘要（域/节点类型/根节点）
- `mvpGraph.nodes: MvpNode[]`：MVP 节点（15-30 个，只含核心信息）
- `mvpGraph.edges: MvpEdge[]`：MVP 关系
- `mvpGraph.stats`：统计信息（按域/类型统计、最大深度）
- `sampleCards: MvpSampleCard[]`：示例卡片（2-3 个完整卡片）
- `generation`：生成信息（ReAct 轮次、耗时、模型、是否收敛）
- `nextSteps.fullDevelopmentEstimate`：完整开发预估（节点数/时间/轮次）
- `nextSteps.suggestedAdjustments: AdjustmentDirection[]`：建议调整方向（3-5 个）

**辅助类型**：
- `AdjustmentDirection`：调整方向（类型/具体操作/原因/预期效果）
- `MvpConfirmation`：MVP 确认结果（含锁定设计）

#### 2.4 PluginState（插件状态契约）
**文件**：`plugin/contracts/plugin-state.ts`

**核心字段**：
- `phase: PluginPhase`：当前阶段（idle/profile-design/mvp-generation/mvp-confirmation/full-development/completed/failed）
- `userRequest`：用户原始输入和解析后的任务
- `currentProfile: TaskProfile | null`：当前加载的 Profile
- `mvpOutput: MvpOutput | null`：MVP 输出
- `mvpConfirmation: MvpConfirmation | null`：MVP 确认记录
- `checkpoint: ResearchCheckpoint`：研究检查点（候选批次/已访问主题/调用数/停止原因）
- `userConfirmations`：用户确认记录（含锁定设计和调整历史）
- `tasks: TaskRecord[]`：任务记录（支持后台任务）
- `config: PluginConfig`：插件配置（LLM/输出/预算/验证）
- `lastError` / `recoveryInfo`：错误与恢复信息
- `stats`：统计信息（总调用数/token/生成节点数）

**辅助类型**：
- `PluginStateStore`：状态持久化接口（save/load/list/delete）
- `PHASE_TRANSITIONS`：合法阶段转换路径

### 3. plugin.json（插件元数据）

**文件**：`plugin/plugin.json`

包含：
- 基本信息（name/version/description/schemaVersion）
- 入口配置（skill/contracts/workflows/prompts/examples）
- 契约文件映射
- Profile 列表（fmcw-radar，状态 in-development）
- 能力列表（10 项能力）
- MVP 机制配置（三阶段参数）
- 节点粒度配置（规则 + 审查规则）
- 共享基础设施列表
- 开发状态（P3-1 in-progress）

### 4. SKILL.md（插件核心文档）

**文件**：`plugin/SKILL.md`

其他 LLM 通过阅读此文档使用插件。包含：
- 概述和核心理念
- 何时使用/不使用
- 输入要求
- MVP 先行机制完整流程（三阶段）
- 节点粒度硬约束（6 条规则 + 4 条自动审查）
- 4 个契约说明
- Profile 机制（什么是 Profile / 什么不是 Profile）
- FMCW 基准 Profile 说明
- 验证标准（MVP/完整开发/FMCW 基线回归）
- 生成产物
- 恢复方式（中断恢复/回退）
- 故障排查表
- 开发阶段状态

### 5. README.md（插件说明）

**文件**：`plugin/README.md`

面向开发者的说明文档。包含快速开始、目录结构、契约说明、MVP 机制、节点粒度约束、Profile 机制、FMCW 基准、开发阶段。

## 三、技术决策

### 3.1 契约设计原则
1. **与现有实现对齐**：ResearchCandidate 与当前 research-output.ts 的 ResearchDocument 对齐，不引入不兼容的新概念
2. **可扩展**：所有配置都有可选字段，Profile 可以追加主题特定内容
3. **可验证**：所有字段都有明确类型，支持 TypeScript 编译时检查
4. **可持久化**：PluginState 支持中断恢复，checkpoint 包含所有必要状态

### 3.2 节点粒度约束的契约化
- NodeTypeDef 包含 `singular`（只放一个什么）和 `forbidden`（禁止什么），将约束从提示词提升到类型系统
- `isGranularSensitive` 标记哪些类型受节点粒度审查（concept/method/algorithm/problem/model）
- CandidateValidationResult 包含 `multiConceptNodes` 和 `problemNodesWithSolution` 统计

### 3.3 MVP 机制的契约化
- MvpOutput 明确区分 MVP 和完整开发的参数（节点数/轮次/栏目/时间）
- AdjustmentDirection 结构化调整建议（类型/操作/原因/预期效果），不是自由文本
- MvpConfirmation 包含锁定设计，确保 Phase 3 不改变核心设计

### 3.4 阶段转换的显式定义
- PHASE_TRANSITIONS 定义合法的阶段转换路径，防止非法状态转换
- failed 状态可以从 mvp-generation 或 full-development 进入，可以恢复到 idle 或重新开始

## 四、验证结果

### 4.1 TypeScript 类型检查
```
npx tsc --noEmit plugin/contracts/index.ts
→ 退出码 0，无错误
```

### 4.2 契约完整性检查
- [x] TaskProfile：包含域/节点类型/边类型/栏目/审查/提示词/初始化 7 大配置
- [x] ResearchCandidate：包含节点/卡片/关系/证据/覆盖度/缺口 6 类候选
- [x] MvpOutput：包含 Profile 摘要/MVP 图谱/示例卡片/调整方向/生成信息 5 部分
- [x] PluginState：包含阶段/Profile/MVP/检查点/确认/任务/配置/错误/统计 9 部分
- [x] 4 个契约通过统一导出（contracts/index.ts）

### 4.3 文档完整性检查
- [x] SKILL.md：包含完整使用流程、契约说明、验证标准、故障排查
- [x] README.md：包含快速开始、目录结构、开发阶段
- [x] plugin.json：包含元数据、能力、MVP 配置、节点粒度配置

## 五、与现有代码的关系

P3-1 **不动当前项目代码**，只创建插件骨架和契约。现有代码的对应关系：

| 契约 | 现有实现 | P3-2 计划 |
| --- | --- | --- |
| TaskProfile.domains | knowledge-state.json 的 dataset.domains + schema.ts 的 SemanticDomainId | 抽取为 profiles/fmcw-radar.ts |
| TaskProfile.nodeTypes | schema.ts 的 NodeType + NODE_TYPE_SEMANTICS | 抽取为 Profile，基础类型共享 |
| TaskProfile.edgeTypes | schema.ts 的 EdgeType | 抽取为 Profile |
| TaskProfile.cardSections | card-section-catalog.ts 的 CARD_SECTION_CATALOG | 抽取为 Profile |
| TaskProfile.validation | validation.ts 的 DOMAIN_COUNT/VISUAL_BRANCH_COUNT | 改为从 Profile 读取 |
| TaskProfile.prompts | adaptive-research.ts / online-agent-service.ts / ingest/route.ts | 抽取为 Profile |
| ResearchCandidate | research-output.ts 的 ResearchDocument | 对齐契约，逐步迁移 |
| PluginState.checkpoint | adaptive-research.ts 的 checkpoint | 对齐契约，逐步迁移 |

## 六、风险与限制

1. **契约尚未被实际使用验证**：P3-1 只定义了契约，P3-2 才会实际使用。如果契约设计有缺陷，会在 P3-2 暴露。
2. **PluginState 持久化尚未实现**：定义了 PluginStateStore 接口，但没有具体实现。P3-2 或 P3-5 实现。
3. **MVP 机制尚未实现**：契约定义了 MvpOutput 和 MvpConfirmation，但实际的 MVP 生成逻辑在 P3-4 实现。
4. **Profile 设计器尚未实现**：P3-3 实现 LLM 驱动的 Profile 自动设计。

## 七、下一步

进入 **P3-2：脚手架模板 + FMCW 第一个 Profile + Profile 加载机制**（4-6 天，核心）。

7 步逐步抽取（每步独立 commit 验证，FMCW 零退化红线）：
1. Step 1：域定义抽取
2. Step 2：节点类型与边类型抽取
3. Step 3：栏目目录抽取
4. Step 4：审查规则配置化
5. Step 5：提示词抽取
6. Step 6：根节点与初始数据策略抽取
7. Step 7：Profile 加载机制与脚手架

---

**报告完成时间**：2026-09-04
**报告作者**：knowmap-agent

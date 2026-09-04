---
name: knowmap-plugin
description: "可插拔的通用 LLM 能力插件——将知识图谱应用的构建过程沉淀为插件。用户说'使用本插件生成关于 XX 的知识网络'，插件通过 MVP 先行机制（快速生成最小骨架→用户确认方向→完整开发），自动设计 Profile 并生成可独立运行、继续生长的知识图谱应用。适用于任意主题的知识网络生成、技术路线梳理、学习网络构建等场景。"
compatibility: "需要 LLM 支持工具调用（function calling）和长上下文。FMCW 毫米波雷达作为第一个 Profile 基准模板。"
---

# KnowMap Plugin —— 可插拔的知识图谱生成插件

## 概述

本插件将"一个知识图谱应用"的构建过程沉淀为可插拔的 LLM 能力。核心思想：

- **从"一个应用"到"一种能力"**：不是只生成 FMCW 雷达图谱，而是让任意主题都能生成类似架构的知识图谱应用
- **Profile 驱动**：主题相关的配置（域、节点类型、提示词、根节点）封装为 Profile，应用架构和 Agent Loop 通用共享
- **MVP 先行**：不直接做 30 分钟深度检索，先 2-5 分钟生成最小骨架，用户确认方向后才完整开发
- **节点粒度硬约束**：一个节点只放一个概念/方法/问题，由节点类型硬编码决定，审查规则自动检测

## 何时使用

使用本插件当用户：
- 要求生成某个主题的知识网络/知识图谱/技术路线
- 要求"像 FMCW 雷达图谱那样"生成其他主题的图谱
- 要求梳理某个领域的知识结构
- 要求构建可交互的学习网络

不使用当用户：
- 只需要简单的文本总结或问答
- 只需要单张概念图（不需要可交互应用）
- 主题已经有现成的知识图谱，只需要查询

## 输入要求

### 必填
- **主题描述**：用户想要生成什么主题的知识网络（如"激光雷达技术路线"、"Mamba 模型在雷达中的应用"）

### 可选
- **Profile 偏好**：用户对域划分、节点类型、深度的偏好
- **参考资料**：用户提供的文档、论文、对话摘要等（作为知识来源）
- **输出目录**：生成的应用放在哪里

---

## 端到端使用指引（其他 LLM 必读）

当用户说"使用本插件生成关于 XX 的知识网络"时，按照以下步骤执行：

### Step 0：确认主题和输出目录

1. 确认用户的主题描述
2. 确认输出目录（默认当前目录下的 `<topic>-knowledge-graph`）
3. 告知用户将使用 MVP 先行机制，先生成最小骨架确认方向

### Step 1：设计 Profile（不需要 API Key）

根据主题，参考 FMCW Profile 结构，设计一个完整的 TaskProfile。

**Profile 必须包含**：
- `id`：kebab-case，如 `lidar-tech-route`
- `name`：中文名称，如"激光雷达技术路线"
- `version`：`"0.1.0"`
- `schemaVersion`：`"task-profile/1"`
- `domains`：3-8 个语义域，每个含 id/name/description/visualBranch/order
- `visualBranches`：3-5 个视觉分支（字符串数组）
- `nodeTypes`：8-15 种节点类型，优先复用基础 11 种
- `edgeTypes`：8-15 种边类型，优先复用基础 12 种
- `cardSections`：13 个基础栏目（可新增主题特定栏目）
- `validation`：domainCount/visualBranchCount/rootNodeRequired
- `prompts`：react/review/finalResponse/ingest/topicAppendix
- `initialization`：rootNode/mvp/full 参数
- `createdAt`/`updatedAt`：ISO 时间戳

**基础节点类型（11种，所有 Profile 共享）**：
```
domain, problem, concept, method, algorithm, model, component, artifact, parameter, metric, application
```

**基础边类型（12种，所有 Profile 共享）**：
```
SIMILAR_TO, ALTERNATIVE_TO, PREREQUISITE_OF, PART_OF, INPUT_TO, OUTPUT_OF, USES_MODEL, IMPLEMENTS, DERIVED_FROM, AFFECTS, MITIGATES, EVALUATED_BY
```

**基础栏目（13个，所有 Profile 共享）**：
```
definition(core), principle(core), assumptions(conditional), comparison(conditional), inputs_outputs(conditional), procedure(core), engineering_tradeoff(core), failure_mode(conditional), validation(core), application(optional), research_topic(optional), code(optional), misconception(optional)
```

### Step 2：生成项目骨架（不需要 API Key）

在输出目录创建以下文件结构：

```
<topic>-knowledge-graph/
├── app/
│   ├── api/
│   │   ├── agent/
│   │   │   ├── chat/route.ts          # SSE 流式聊天
│   │   │   ├── deep-search/route.ts   # 深度检索
│   │   │   └── generate/route.ts      # 知识生成（MVP/完整）
│   │   ├── knowledge/
│   │   │   ├── ingest/route.ts         # 资料接入（对话/摘要/论文/文档）
│   │   │   └── state/route.ts          # 知识状态读写
│   │   └── profile/
│   │       └── design/route.ts         # Profile 设计器
│   ├── layout.tsx                       # 根布局
│   └── page.tsx                         # 主页面（图谱+聊天）
├── components/
│   ├── GraphCanvas.tsx                  # SVG 图谱画布
│   ├── KnowledgeTree.tsx                # 知识树侧边栏
│   ├── KnowledgeCard.tsx                # 知识卡详情
│   ├── AgentPanel.tsx                   # Agent 聊天面板
│   └── TypographySettings.tsx          # 字号设置
├── core/
│   └── knowledge/
│       ├── schema.ts                    # 知识图谱 schema（节点/边/卡片类型）
│       ├── validation.ts                # 验证规则（含节点粒度4条规则）
│       └── card-section-catalog.ts      # 栏目目录
├── data/
│   └── runtime/
│       ├── knowledge-state.json         # 知识数据（运行时生成）
│       └── llm-config.json              # LLM 配置（用户填写）
├── profiles/
│   └── <topic>.ts                       # 本主题的 Profile（Step 1 设计的）
├── server/
│   ├── agent/
│   │   ├── adaptive-research.ts         # 自适应 ReAct 深度检索
│   │   ├── knowledge-generator.ts       # 知识生成器（MVP/完整）
│   │   └── online-agent-service.ts      # 在线 Agent 服务
│   └── profile/
│       ├── profile-loader.ts            # Profile 加载器
│       └── profile-designer.ts          # Profile 设计器
├── plugin/                               # 本插件的副本（用于自举）
│   ├── SKILL.md
│   ├── plugin.json
│   └── contracts/
├── scripts/
│   └── create-app.mjs                   # 脚手架脚本
├── tests/
│   └── agent-reliability.test.mjs       # 自动化测试
├── docs/
│   └── dev-reports/
│       └── <topic>-<date>.md            # 开发报告
├── package.json
├── tsconfig.json
├── next.config.js
└── README.md
```

### Step 3：实现核心代码（不需要 API Key）

按照以下优先级实现核心文件：

#### 3.1 package.json
```json
{
  "name": "<topic>-knowledge-graph",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "type-check": "tsc --noEmit",
    "test": "node --test tests/"
  },
  "dependencies": {
    "next": "^16.2.6",
    "react": "^19.2.6",
    "react-dom": "^19.2.6"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "@types/node": "^22.13.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0"
  }
}
```

#### 3.2 core/knowledge/schema.ts
定义 KnowledgeNode、KnowledgeEdge、KnowledgeCard、KnowledgeDataset 等类型，以及 NODE_TYPE_SEMANTICS 常量（每种节点类型的"只放一个什么"和"禁止什么"）。

#### 3.3 core/knowledge/validation.ts
实现 validateKnowledgeDataset 函数，包含：
- 结构性规则（根节点唯一、边端点存在、域数量校验）
- 节点粒度 4 条规则（MULTI_CONCEPT_NODE、NODE_NAME_TOO_LONG、SHORTFACT_TOO_LONG、PROBLEM_NODE_HAS_SOLUTION）
- 支持从 Profile 读取域数量/视觉分支数量

#### 3.4 profiles/<topic>.ts
导出 Profile 对象（Step 1 设计的），格式：
```typescript
import type { TaskProfile } from "../plugin/contracts/task-profile";

export const <TOPIC>_PROFILE: TaskProfile = { ... };
export default <TOPIC>_PROFILE;
```

#### 3.5 server/profile/profile-loader.ts
实现 ProfileLoader 类，支持加载/缓存/获取 Profile 所有配置（domains/nodeTypes/edgeTypes/cardSections/prompts/initialization）。

#### 3.6 server/agent/knowledge-generator.ts
实现 KnowledgeGenerator 类，包含：
- MVP 模式（15-30节点，只填definition，2-3轮ReAct）
- 完整开发模式（80-150节点，5+栏目，6-24轮ReAct）
- ReAct 循环（Observe→Act→批量合并→收敛判断）
- 分布式子调用（gaps>3时拆分）
- 节点粒度硬约束

#### 3.7 server/agent/adaptive-research.ts
实现自适应 ReAct 深度检索，包含：
- 逐节点 ReAct 计数重置
- 预算自适应（稀疏图谱更多轮次）
- 批量合并而非逐个查重
- 上下文管理（compactObservation + rollingContext）

#### 3.8 app/api/agent/generate/route.ts
实现 POST /api/agent/generate，参数：topic、profileId、mode(mvp/full)、writeToFile。

#### 3.9 app/page.tsx
实现主页面，包含：
- SVG 图谱画布（可拖动、缩放、点击节点）
- 知识树侧边栏（按域分组）
- 知识卡详情面板（Markdown/LaTeX 渲染）
- Agent 聊天面板（SSE 流式输出）

#### 3.10 data/runtime/llm-config.json
模板（用户填写 API Key）：
```json
{
  "apiKey": "your-api-key-here",
  "baseUrl": "https://api.deepseek.com",
  "model": "deepseek-chat",
  "schemaVersion": "fmcw-llm-config/1"
}
```

### Step 4：生成 MVP 知识网络（需要 API Key）

1. 让用户填写 data/runtime/llm-config.json
2. 调用 POST /api/agent/generate，mode=mvp
3. 生成 15-30 个节点，只填 definition 栏目
4. 展示 MVP 骨架给用户确认

### Step 5：用户确认与调整

1. 展示 Profile 设计（域划分、节点类型、根节点）
2. 展示 MVP 知识网络骨架（节点列表 + 层级关系）
3. 展示 2-3 个示例卡片
4. 如果用户不满意，给出 3-5 个调整方向，重新生成 MVP
5. 如果用户满意，锁定 Profile 核心设计，进入完整开发

### Step 6：完整开发（需要 API Key）

1. 调用 POST /api/agent/generate，mode=full
2. 生成 80-150 个节点，5+ 栏目
3. 自适应 ReAct 深度检索
4. 分布式子调用
5. 语义审查 + 结构校验
6. 写入 data/runtime/knowledge-state.json

### Step 7：验证与交付

1. 运行 npm run type-check 验证类型
2. 运行 npm test 验证自动化测试
3. 运行 npm run dev 启动应用，人工验证功能
4. 编写开发报告 docs/dev-reports/<topic>-<date>.md
5. 交付完整的可运行应用

---

## 核心流程：MVP 先行机制

### Phase 1：MVP 快速生成（2-5 分钟）

**目标**：快速生成最小骨架，让用户判断方向是否正确。

**参数**：
- 节点数：15-30 个（完整开发 80-150 个）
- 深度：根节点 + 一级域 + 每域 2-3 个核心概念
- 栏目：只填 definition（完整开发 5+ 栏目）
- ReAct 轮次：2-3 轮（完整开发 6-24 轮）
- 不调用 web_search，仅用模型知识
- Profile 设计：简化版 3-5 个域

**步骤**：
1. 分析用户主题，参考 FMCW Profile 作为模板
2. 设计简化版 Profile（3-5 个域、基础节点类型、根节点）
3. 从根节点开始，按域生成一级域节点
4. 每域生成 2-3 个核心概念节点，只填 definition 栏目
5. 生成父子关系和必要的跨节点语义关系
6. 输出 MvpOutput（Profile 摘要 + MVP 知识网络骨架 + 2-3 个示例卡片）

**输出契约**：`MvpOutput`（见 contracts/mvp-output.ts）

### Phase 2：用户确认与调整

**目标**：让用户判断 Profile 设计和知识生成方向是否正确。

**展示给用户**：
1. Profile 设计（域划分、节点类型、根节点）
2. MVP 知识网络骨架（节点列表 + 层级关系）
3. 示例卡片（2-3 个完整卡片，展示知识粒度和质量）

**如果用户不满意**：
1. 说明当前设计的理由
2. 给出 3-5 个具体调整方向，每个方向包含：
   - 调整类型（domain / nodeType / cardSection / rootNode / granularity / scope）
   - 具体操作
   - 原因
   - 预期效果
3. 示例："域划分过粗，建议将'信号处理'拆分为'波形生成'和'谱处理'两个域，预期效果是知识组织更精细"
4. 用户选择调整方向后，重新生成 MVP（回到 Phase 1）

**如果用户满意**：
- 锁定 Profile 核心设计（域划分、节点类型、栏目、根节点）
- 进入 Phase 3

**锁定机制**：
- 用户确认后，Profile 核心设计被锁定
- Phase 3 只完善知识内容，不改变核心设计
- 中途需要改变核心设计时，需重新走 MVP 流程

### Phase 3：完整开发（25-40 分钟）

**目标**：基于锁定的 Profile 设计，生成完整的知识网络。

**参数**：
- 节点数：80-150 个
- 自适应深度检索（逐节点 ReAct 计数重置、预算自适应）
- 根节点预算：25-35 分钟，最多 360 次模型调用，80 个访问主题
- 完整知识卡（5+ 栏目：definition + principle + engineering_tradeoff + validation 等）
- 批量合并 + 分布式子调用

**步骤**：
1. 加载锁定的 Profile
2. 从根节点开始，按域划分生成一级域节点
3. 对每个域节点，调用自适应 ReAct 生成子节点：
   - 逐节点 ReAct 计数重置（每个新节点重新计算预算）
   - 预算自适应（稀疏图谱更多轮次，较完整图谱较少轮次）
   - 连续两轮收敛且新增很少时结束该节点
4. 批量合并而非逐个查重（收集所有候选后统一比对）
5. 分布式子调用：单轮 gaps>3 或 newNodes>8 时，拆分为多组降低单次负荷
6. 语义审查 + 结构校验（含节点粒度 4 条规则）
7. Build 预览 → 用户确认 → 写入图谱
8. 生成完整的可运行应用

**输出**：完整的知识图谱应用（可独立运行、继续生长）

---

## 节点粒度硬约束（必须遵守）

这是本插件的核心质量规则，由节点类型硬编码决定，不是提示词灵活解释：

### 规则
1. **一个节点只放一个东西**，由 nodeType 决定：
   - `concept` = 一个概念
   - `method` / `algorithm` = 一个解决方案
   - `problem` = 一个问题或现象
   - `model` = 一个模型
   - `parameter` = 一个参数
   - `metric` = 一个指标
2. **禁止多个并列概念放一个节点**
   - 反例："CV、CA、CTRV、CTRA 描述不同机动"（4 个概念混在一起）
   - 正例：父节点"运动模型" + 子节点"CV模型"、"CA模型"、"CTRV模型"、"CTRA模型"
3. **problem 节点只描述问题/现象本身**，禁止混入解决方法或子问题
   - 解决方法必须是独立的 method/algorithm 节点，通过 `MITIGATES` 关系关联
   - 子问题必须拆分为独立 problem 子节点
4. **多个方法/概念必须有一个共性问题作为父节点**
5. **节点名称 ≤20 字**，禁止包含"、""/"和"等并列连词
6. **shortFact ≤80 字**，是一句话定义；详细内容放知识卡栏目

### 自动审查规则（validation.ts）
- `MULTI_CONCEPT_NODE`：名称含并列连词的粒度敏感类型节点 → warning
- `NODE_NAME_TOO_LONG`：名称 >20 字 → warning
- `SHORTFACT_TOO_LONG`：shortFact >80 字 → warning
- `PROBLEM_NODE_HAS_SOLUTION`：problem 节点 shortFact 含方法/算法/解决等词 → warning

---

## 契约说明

本插件定义 4 个核心契约（TypeScript interface）：

| 契约 | 文件 | 用途 |
| --- | --- | --- |
| `TaskProfile` | contracts/task-profile.ts | 主题配置：域、节点类型、边类型、栏目、审查规则、提示词、根节点、初始化策略 |
| `ResearchCandidate` | contracts/research-candidate.ts | 知识候选：新节点、卡片块、关系、证据、覆盖度评估 |
| `MvpOutput` | contracts/mvp-output.ts | MVP 输出：Profile 摘要 + 最小知识网络骨架 + 示例卡片 + 调整方向 |
| `PluginState` | contracts/plugin-state.ts | 插件状态：当前阶段、Profile、检查点、用户确认记录、任务记录 |

所有生成的输出必须符合对应契约的 schema。

---

## Profile 机制

### 什么是 Profile
Profile 是主题相关的配置集合，决定了知识图谱的"长什么样"：
- 域划分（有哪些知识领域）
- 节点类型（有哪些类型的节点）
- 边类型（有哪些类型的关系）
- 栏目目录（知识卡有哪些栏目）
- 审查规则（主题特定的校验规则）
- 提示词（ReAct、Review、资料接入的提示词）
- 根节点（图谱的根）
- 初始化策略（MVP vs 完整开发的参数）

### 什么不是 Profile（通用共享）
以下基础设施所有 Profile 共享，不随主题变化：
- 应用架构（Next.js + React + TypeScript）
- Agent Loop（ReAct + 自适应预算 + 批量合并）
- 审查框架（语义审查 + 结构校验 + fail-open）
- UI 组件（SVG 图谱画布 + 知识树 + 知识卡 + Agent 面板）
- SSE 流式聊天 + Markdown/LaTeX 渲染
- 后台任务管理
- 分布式子调用
- 节点粒度 4 条审查规则
- 结构性规则（树/图/公式/卡片）

### FMCW 基准 Profile
FMCW 毫米波雷达知识网络是第一个 Profile，作为基准模板：
- 11 个域（按信号处理链路划分）
- 11 种节点类型（合并 phenomenon 到 problem）
- 12 种边类型
- 13 个知识卡栏目
- 根节点：fmcw

其他主题的 Profile 参考 FMCW 的结构，根据主题特点调整域划分和提示词。

---

## 验证标准

### MVP 验证
- [ ] 节点数在 15-30 范围内
- [ ] 每个节点只填 definition 栏目
- [ ] 节点符合"一个节点一个概念"约束
- [ ] Profile 设计合理（域划分有逻辑，根节点明确）
- [ ] 示例卡片展示了知识粒度和质量
- [ ] 生成时间在 2-5 分钟内

### 完整开发验证
- [ ] 节点数在 80-150 范围内
- [ ] 知识卡栏目完整（5+ 栏目）
- [ ] 节点符合"一个节点一个概念"约束
- [ ] problem 节点无解决方法混入
- [ ] 关系合理（父子关系 + 跨节点语义关系）
- [ ] 语义审查和结构校验通过
- [ ] 应用可以独立运行
- [ ] 应用支持问答、深度检索、资料整理
- [ ] 生成时间在 25-40 分钟内

### FMCW 基线回归（P3-2 每步必验）
- [ ] tsc 类型检查通过
- [ ] 6 项自动化测试全通过
- [ ] FMCW 应用所有现有功能正常
- [ ] 域显示不变
- [ ] 节点类型不变
- [ ] 知识卡栏目不变
- [ ] Agent 生成质量不下降

---

## 生成产物

### MVP 阶段
- `MvpOutput` JSON 文件（Profile 摘要 + MVP 知识网络骨架 + 示例卡片）
- 简化版 Profile 文件

### 完整开发阶段
- 完整的可运行知识图谱应用（Next.js 项目）
- Profile 文件（`profiles/<topic>.ts`）
- 知识数据文件（`data/runtime/knowledge-state.json`）
- 开发报告（`docs/dev-reports/<topic>-<date>.md`）

---

## 恢复方式

### 中断恢复
插件支持中断恢复，通过 `PluginState` 持久化：
- 服务重启后，可以从 PluginState 恢复当前阶段
- MVP 阶段中断：从 mvpOutput 恢复，重新展示给用户确认
- 完整开发阶段中断：从 checkpoint 恢复，继续未完成的研究
- 检查点包含：已生成的候选批次、已访问的主题、调用数、开始时间

### 回退
- P3-2 每步独立 commit，可以单独回退某一步
- Profile 设计不满意：重新走 MVP 流程（Phase 1 → Phase 2）
- 知识内容不满意：在应用内手动编辑，或重新运行深度检索

---

## 故障排查

| 问题 | 原因 | 解决方案 |
| --- | --- | --- |
| LLM 输出不符合契约 schema | 模型不理解契约结构 | 反馈具体错误给模型，最多 3 次修复；仍失败则保留有效部分 |
| 节点包含多个概念 | 模型违反节点粒度约束 | 语义审查标记 MULTI_CONCEPT_NODE，反馈模型拆分 |
| problem 节点混入解决方法 | 模型违反 problem 约束 | 语义审查标记 PROBLEM_NODE_HAS_SOLUTION，反馈模型分离 |
| 单次调用输入超限 | 上下文过大 | 触发分布式子调用，拆分为多组 |
| 研究不收敛 | 模型持续生成低质量内容 | 连续两轮新增很少时自动结束该节点；触及预算时停止 |
| 语义审查格式失败 | 模型输出非 JSON | fail-open：降级为 warning，不阻塞合并 |
| 配置 AI 时报 Unexpected token '<' | dev 服务器未重启，路由未注册 | 重启 npm run dev，Turbopack 路由缓存不自动热重载 |

---

## 开发阶段

| 阶段 | 状态 | 说明 |
| --- | --- | --- |
| P3-1 插件骨架与契约 | ✅ 已完成 | 目录结构、4 个契约 schema、plugin.json、SKILL.md、README |
| P3-2 脚手架 + FMCW Profile + 加载机制 | ✅ 已完成 | 7 步逐步抽取，FMCW 零退化红线 |
| P3-3 Profile 设计器 | ✅ 已完成 | LLM 驱动，自动设计 TaskProfile |
| P3-4 知识生成器 | ✅ 已完成 | LLM 驱动，含分布式生成 |
| P3-5 工作流文档与插件完善 | 🔄 进行中 | 6 个工作流文档、提示词模板、示例 |
| P3-6 端到端验证与自举测试 | ⏳ 待开始 | 激光雷达应用完整生成 + 自举测试 |

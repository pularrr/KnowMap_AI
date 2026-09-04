# KnowMap Plugin

可插拔的通用 LLM 能力插件——将知识图谱应用的构建过程沉淀为插件，由通用 LLM 根据生成任务对不同 Profile 进行设计和主题内容生成。

## 核心理念

- **从"一个应用"到"一种能力"**：不是只生成 FMCW 雷达图谱，而是让任意主题都能生成类似架构的知识图谱应用
- **Profile 驱动**：主题相关的配置封装为 Profile，应用架构和 Agent Loop 通用共享
- **MVP 先行**：先 2-5 分钟生成最小骨架，用户确认方向后才完整开发（25-40 分钟）
- **节点粒度硬约束**：一个节点只放一个概念/方法/问题，由节点类型硬编码决定

## 快速开始

### 作为 LLM 插件使用

1. 将本插件目录导入支持插件的 LLM 宿主
2. 阅读 `SKILL.md` 了解使用流程
3. 对 LLM 说："使用本插件生成关于 XX 的知识网络"
4. 等待 MVP 生成（2-5 分钟），确认方向
5. 等待完整开发（25-40 分钟），获得可运行的知识图谱应用

### 作为开发者使用

```bash
# 安装依赖
npm install

# 运行 FMCW 基准应用（当前唯一可用的 Profile）
npm run dev

# 查看插件契约
ls plugin/contracts/

# 查看工作流文档
ls plugin/workflows/
```

## 目录结构

```
plugin/
├── SKILL.md              # 插件核心文档（LLM 阅读此文档使用插件）
├── plugin.json           # 插件元数据
├── README.md             # 本文件
├── contracts/            # 4 个核心契约 schema
│   ├── index.ts          # 统一导出
│   ├── task-profile.ts   # TaskProfile 契约（主题配置）
│   ├── research-candidate.ts  # ResearchCandidate 契约（知识候选）
│   ├── mvp-output.ts     # MvpOutput 契约（MVP 输出）
│   └── plugin-state.ts   # PluginState 契约（插件状态）
├── workflows/            # 工作流文档（P3-5 完善）
├── prompts/              # 提示词模板（P3-5 完善）
└── examples/             # 示例（P3-5 完善）

profiles/                 # Profile 定义目录
└── fmcw-radar.ts         # FMCW 基准 Profile（P3-2 开发）

docs/
└── dev-reports/          # 开发报告备份
    ├── p3-1-*.md         # P3-1 开发报告
    └── p3-2-*.md         # P3-2 开发报告
```

## 4 个核心契约

| 契约 | 用途 | 关键字段 |
| --- | --- | --- |
| `TaskProfile` | 主题配置 | domains, nodeTypes, edgeTypes, cardSections, validation, prompts, initialization |
| `ResearchCandidate` | 知识候选 | newNodes, cardBlocks, relations, evidence, coverageAssessment, gaps |
| `MvpOutput` | MVP 输出 | profileSummary, mvpGraph, sampleCards, suggestedAdjustments |
| `PluginState` | 插件状态 | phase, currentProfile, mvpOutput, checkpoint, userConfirmations, tasks |

## MVP 先行机制

### Phase 1：MVP 快速生成（2-5 分钟）
- 节点数：15-30 个
- 只填 definition 栏目
- 2-3 轮 ReAct
- 简化版 3-5 个域
- 不调用 web_search

### Phase 2：用户确认与调整
- 展示 Profile 设计 + MVP 骨架 + 示例卡片
- 不满意：给出 3-5 个调整方向，重新生成 MVP
- 满意：锁定 Profile 核心设计，进入 Phase 3

### Phase 3：完整开发（25-40 分钟）
- 节点数：80-150 个
- 完整知识卡（5+ 栏目）
- 自适应深度检索（逐节点 ReAct 计数重置）
- 批量合并 + 分布式子调用
- 应用构建验证交付

## 节点粒度硬约束

1. **一个节点只放一个东西**，由 nodeType 决定：
   - concept = 一个概念
   - method/algorithm = 一个解决方案
   - problem = 一个问题或现象
2. **禁止多个并列概念放一个节点**——必须拆分为子节点，共享共性父节点
3. **problem 节点只描述问题/现象本身**——解决方法必须是独立节点，通过 MITIGATES 关系关联
4. **节点名称 ≤20 字**，shortFact ≤80 字

自动审查规则：`MULTI_CONCEPT_NODE`、`NODE_NAME_TOO_LONG`、`SHORTFACT_TOO_LONG`、`PROBLEM_NODE_HAS_SOLUTION`

## Profile 机制

### 什么是 Profile（主题相关，配置化）
- 域划分、节点类型、边类型、栏目目录
- 审查规则（主题特定）
- 提示词（ReAct、Review、资料接入）
- 根节点、初始化策略

### 什么不是 Profile（通用共享）
- 应用架构、Agent Loop、审查框架
- UI 组件、SSE 流式聊天、后台任务
- 分布式子调用、节点粒度规则、结构性规则

## FMCW 基准 Profile

FMCW 毫米波雷达知识网络是第一个 Profile，作为基准模板：
- 11 个域（按信号处理链路划分）
- 11 种节点类型（phenomenon 已合并到 problem）
- 14 种边类型
- 14 个知识卡栏目
- 根节点：fmcw
- 131 节点 / 131 卡片

## 开发阶段

| 阶段 | 状态 | 预计时间 |
| --- | --- | --- |
| P3-1 插件骨架与契约 | 进行中 | 0.5-1 天 |
| P3-2 脚手架 + FMCW Profile + 加载机制 | 待开始 | 4-6 天 |
| P3-3 Profile 设计器 | 待开始 | 2-3 天 |
| P3-4 知识生成器 | 待开始 | 2-3 天 |
| P3-5 工作流文档与插件完善 | 待开始 | 1-2 天 |
| P3-6 端到端验证与自举测试 | 待开始 | 2-3 天 |

## 相关文档

- `SKILL.md`：插件使用说明（LLM 阅读此文档）
- `docs/ROADMAP_2026_09_P0_P3.md`：完整开发计划
- `docs/dev-reports/`：各阶段开发报告备份

## 许可证

MIT

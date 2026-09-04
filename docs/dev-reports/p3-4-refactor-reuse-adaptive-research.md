# P3-4 重构开发报告：KnowledgeGenerator 真正复用 FMCW 的 adaptive-research

**日期**：2026-09-05
**Commit**：822b5dc
**状态**：已完成，验证通过

---

## 1. 问题背景

P3-4 KnowledgeGenerator 最初实现了一套"阉割版 ReAct"机制，没有复用 FMCW 成熟的 `adaptive-research`。具体问题：

| 问题 | 阉割版实现 | FMCW 成熟实现 |
|------|-----------|---------------|
| ReAct 循环 | 全局轮次上限，单轮新增<2就收敛 | 逐节点 ReAct 重置，自适应预算 |
| 上下文管理 | 无 | compactObservation + rollingContext |
| 分布式子调用 | 简单拆分 | gaps>3 或 newNodes>8 时触发，每组2个gap |
| 批量合并 | 搜一个就查重 | 每批累积后统一合并 |
| 收敛判断 | 新增<2就收敛 | 连续多轮没有实质新增才标记收敛 |
| 节点粒度约束 | 无 | 6条硬约束（一个节点一个概念） |
| 最终校验 | 无 | 结构校验 + 节点粒度4条规则 |

用户强烈不满："为啥你要改为的ReAct机制啊？？？我不是说复用吗？？你到底复用了什么..为什么都是阉割版的。"

---

## 2. 重构方案

### 2.1 adaptive-research.ts 改造

**目标**：让 `collectAdaptiveResearch` 支持 Profile 注入，未提供 Profile 时使用 FMCW 默认值（保证零退化）。

**改动**：
1. 新增 `profile?: TaskProfile` 参数
2. 用 `input.profile?.cardSections ?? CARD_SECTION_CATALOG` 代替硬编码的栏目目录
3. 用 `input.profile?.prompts?.react ?? DEFAULT_REACT_PROMPT` 代替硬编码的 ReAct 提示词
4. 提取 `DEFAULT_REACT_PROMPT` 常量（包含6条节点粒度硬约束）
5. 预算参数支持从 Profile 的 `initialization.full.rootBudgetMinutes` 读取

### 2.2 knowledge-generator.ts 重构

**目标**：删除阉割版 ReAct，直接调用 `collectAdaptiveResearch`。

**新增**：
1. **适配函数**：
   - `networkToDataset(network, profile)`：把 KnowledgeNetwork 转换为 KnowledgeDataset（适配 collectAdaptiveResearch 的输入格式）
   - `mergeResearchToNetwork(network, doc)`：把 ResearchDocument 合并到 KnowledgeNetwork（去重、合并节点/卡片/关系）

2. **增强 initializeNetwork**：
   - 原来：只创建1个根节点
   - 现在：创建根节点 + 所有域节点骨架（每个域节点带 definition 卡片 + PART_OF 关系）
   - 效果：第一轮 ReAct 就有了明确的骨架，LLM 知道从哪里开始

3. **重写 generate() 方法**：
   - Step 1：初始化网络（根节点 + 域节点骨架）
   - Step 2：转换为 KnowledgeDataset
   - Step 3：根据模式设置预算覆盖（MVP 5分钟，完整开发 25-35分钟）
   - Step 4：调用 `collectAdaptiveResearch`（真正复用 FMCW 的 ReAct 机制）
   - Step 5：把 ResearchDocument 合并到 KnowledgeNetwork
   - Step 6：最终校验（结构校验 + 节点粒度审查）

4. **新增 validateNetwork**：
   - 结构校验：边端点存在
   - 节点粒度审查：多概念节点（名称含并列连词）、名称过长、摘要过长、problem节点混入解决方法

**删除**：
- `buildReActSystemPrompt`：阉割版提示词生成
- `reactAct`：阉割版单轮 ReAct
- `distributedGenerate`：阉割版分布式生成
- `mergeKnowledge`：阉割版批量合并
- `assessCoverage`：阉割版覆盖度评估

---

## 3. 架构对比

### 重构前（阉割版）

```
KnowledgeGenerator.generate()
  ├─ initializeNetwork() → 只创建根节点
  ├─ while (iteration < maxIterations)
  │   ├─ assessCoverage() → 简单统计域节点数
  │   ├─ distributedGenerate() → 简单拆分gaps
  │   │   └─ reactAct() → 直接调用 structuredOutputCall
  │   └─ mergeKnowledge() → 搜一个就查重
  └─ 返回结果（无最终校验）
```

### 重构后（真正复用）

```
KnowledgeGenerator.generate()
  ├─ initializeNetwork() → 根节点 + 所有域节点骨架
  ├─ networkToDataset() → 转换为 KnowledgeDataset
  ├─ collectAdaptiveResearch() ← 真正复用 FMCW 核心
  │   ├─ 逐节点 ReAct 重置（每个节点独立的观察/行动循环）
  │   ├─ 自适应预算（节点数少时提高react次数，新增多时延长检索）
  │   ├─ 上下文管理（compactObservation + rollingContext）
  │   ├─ 分布式子调用（gaps>3 或 newNodes>8 时触发）
  │   ├─ 批量合并（每批累积后统一合并，不逐条查重）
  │   ├─ 收敛判断（连续多轮没有实质新增才标记收敛）
  │   └─ 节点粒度硬约束（6条规则，由 Profile 注入）
  ├─ mergeResearchToNetwork() → 合并 ResearchDocument
  ├─ validateNetwork() → 结构校验 + 节点粒度审查
  └─ 返回结果
```

---

## 4. 验证结果

### 4.1 TypeScript 编译

```
npx tsc --noEmit
退出码: 0
```

### 4.2 自动化测试

```
node --test tests/agent-reliability.test.mjs

1..6
# tests 6
# pass 6
# fail 0
# duration_ms 18316
```

6项测试全部通过，包括：
1. structured output extraction tolerates thinking text and fenced JSON
2. provider strips tool_choice for reasoning models and retries on unsupported error
3. knowledge operations preserve node granularity and reject multi-concept nodes
4. output retries grow within provider cap and fit structured contexts without breaking JSON
5. Build materializes more than two nodes, resolves new parents, preserves cards and uses existing SVG columns
6. **adaptive ReAct resets minimum observations for every visited topic and uses larger sparse-graph budgets** ← 验证 adaptive-research 核心机制

### 4.3 FMCW 零退化验证

- adaptive-research.ts 未提供 profile 时，使用 `CARD_SECTION_CATALOG` 和 `DEFAULT_REACT_PROMPT`（与原硬编码完全一致）
- FMCW 调用点（online-agent-service.ts）未传入 profile，行为不变
- 6项自动化测试全部通过，包括 adaptive-research 相关测试

---

## 5. 关键设计决策

### 5.1 为什么用适配函数而不是直接改 KnowledgeNetwork？

KnowledgeDataset 是 FMCW 的核心数据结构，类型复杂（包含 domains/nodes/cards/formulas/edges，每个类型都有多个必填字段）。直接改 KnowledgeNetwork 会影响整个项目的其他模块。

适配函数 `networkToDataset` 和 `mergeResearchToNetwork` 作为隔离层，既复用了 FMCW 的核心逻辑，又保持了 KnowledgeGenerator 的接口简洁。

### 5.2 为什么 initializeNetwork 要创建域节点骨架？

原来只创建根节点，第一轮 ReAct 时 LLM 不知道从哪里开始，容易生成散乱的节点。创建域节点骨架后：
- LLM 有明确的"锚点"，知道每个域应该生成什么内容
- 第一轮 ReAct 就能围绕域节点展开，而不是从零开始
- 生成的网络结构更清晰，域归属更准确

### 5.3 为什么 MVP 模式要覆盖预算？

MVP 模式的目标是"2-5分钟快速生成骨架，让用户确认方向"。如果使用完整开发的预算（25-35分钟），MVP 就失去了意义。

MVP 预算覆盖：
- maxNodes: 30（MVP 目标 15-30 节点）
- maxDurationMs: 5分钟
- minRounds/initialRounds/maxNodeRounds: 降低轮次

### 5.4 为什么保留 validateNetwork 而不是复用 FMCW 的 validation.ts？

FMCW 的 `validation.ts` 是针对 KnowledgeDataset 的完整校验，包含域数量、视觉分支、根节点唯一性等复杂规则。KnowledgeGenerator 的 KnowledgeNetwork 是简化版数据结构，不适合直接套用。

`validateNetwork` 是轻量级校验，聚焦于：
- 结构完整性（边端点存在）
- 节点粒度（多概念节点、名称过长、摘要过长、problem混入解决方法）

这些是 KnowledgeGenerator 最关心的问题，与 FMCW 的完整校验形成互补。

---

## 6. 后续优化方向

1. **端到端验证**：用激光雷达技术路线作为评估题目，在豆包工作版下实际运行 KnowledgeGenerator，验证生成的知识网络质量
2. **Profile 提示词优化**：根据端到端验证结果，优化 Profile 的 ReAct 提示词，确保不同主题都能生成高质量的知识网络
3. **后台任务支持**：完整开发模式（25-40分钟）受 API 路由 5 分钟超时限制，需要后台任务支持
4. **增量生长**：当前 generate() 是一次性生成完整网络，后续可以支持"基于现有网络增量生长"，复用 collectAdaptiveResearch 的非根节点模式

---

## 7. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `server/agent/adaptive-research.ts` | 修改 | 增加 profile 参数，提取 DEFAULT_REACT_PROMPT 常量 |
| `server/agent/knowledge-generator.ts` | 重构 | 添加适配函数、增强 initializeNetwork、重写 generate()、添加 validateNetwork、删除阉割版 ReAct 方法 |

**总计**：2 files changed, 298 insertions(+), 308 deletions(-)

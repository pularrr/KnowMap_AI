# FMCW Radar Knowledge Graph · AI 知识图谱生长引擎

一个**图谱原生的 AI 应用**：内置一套"治理型 Agent 管道"，让插入式的通用 LLM（GPT / DeepSeek / 本地模型均可）一接入就获得**可审计、可回滚、需用户确认**的知识图谱生长能力——读图 → 判缺口 → 提案 → 结构审查 → 确定性构建 → 用户确认 → 版本化落库。

当前版本 v0.1.0：**认知层的离线实现完整可用**（无任何 API Key 也能浏览、问答、缺口分析），LLM 接入契约已就绪。开发路线以在线 LLM 交互为亮点推进（见[开发计划](#-后续开发计划))。

> 领域背景：FMCW 雷达信号处理与数据关联知识图谱（检测/估计/关联/跟踪/系统实现/AI 学习等 11 个语义域），所有内容可独立离线运行。

---

## ✨ 核心理念：内生 AI

- **认知与治理分离**：通用 LLM 只参与需要判断的地方——候选生成、缺口识别、语义归类、内容审查；确定性的环节——结构门禁、GraphPatch 构建、状态机、版本仓、审计——由代码实现。
- **写路径：LLM 接口回文本与结构化声明；声明要落地必须经过 结构审查 → 确定性补丁 → **用户确认** 四道闸。
- **离线是 L0，不是产品形态**：离线实现是"安全地板 + 测试基座 + 降级路径"；产品的亮点在 LLM 介入后的一等公民体验（对话式生长、矛盾发现、缺口提案）。

---

## 🚀 当前版本能力（v0.1.0）

| 层 | 能力 | 状态 |
|---|---|---|
| 图谱本体 | 114 节点（98 历史零损迁移 + 16 种子扩展）/ 11 语义域 / 5 视觉分支 / 25 条语义边 / 21 条 LaTeX 公式（KaTeX 渲染） | ✅ 已实现 |
| 知识模型 | 节点只表实体身份；12 类语义边（相似/替代/依赖/输入输出/实现/影响/验证…）；13 类卡片栏目（定义/原理/假设/工程取舍/失效模式/验证/对比/误区…） | ✅ 已实现 |
| 治理层 | 宪法式校验器（层级/环/边权/证据约束）、同层优先有界遍历、四 Agent 契约、GraphPatch、一次性确认凭据、幂等提交、追加式回滚、审计重放、版本仓（1 最近 + 2 历史） | ✅ 已实现（31 项测试全绿） |
| 认知层（离线） | 当前节点问答（本地词频 + 卡片来源）、13 维知识缺口深度搜索（有界邻域候选，只读待审查）、对话总结 | ✅ 已实现 |
| 认知层（LLM） | `GeneralLlmProvider` 中立端口、能力白名单、摄取/提案/审查契约 | 📐 契约就绪，实现见开发计划 |
| UI | 导航树 + SVG 图谱 + 四页签知识卡 + Agent 面板（提问/深度搜索/总结），URL `?node=` 直达 | ✅ 已实现 |

## 🖥️ 使用方法

### 前置条件
- Node.js **≥ 22.13**（Windows 下命令统一用 `npm.cmd`）
- 无需任何 API Key、数据库、网络

### 运行

```powershell
npm.cmd ci          # 按锁文件安装依赖
npm.cmd run dev     # 开发服务器 → http://localhost:3000
```

生产构建与启动（同样完全本地）：

```powershell
npm.cmd run build
npm.cmd run start
```

验证（31 项测试覆盖模型/遍历/UI 契约/Agent 安全链路）：

```powershell
npm.cmd test
```

### 界面导览
- **左侧**导航树与**中间** SVG 图谱共享同一父层级；点击节点，右侧打开知识卡。
- **右侧知识卡**四个页签：理论知识 / 应用知识 / 其他知识 / 历史修改（每节点最近 15 条）。
- **底部 Agent 面板**（当前节点优先）：提问 → 基于当前节点卡片作答并标注来源；深度搜索 → 检查 13 类卡片维度缺口并给出有界邻域候选（只读、不落库）；总结 → 汇总结论供后续知识检索。
- 历史记录存于浏览器 localStorage（`fmcw-knowledge-history-v1`），服务端零持久化。

### 当前边界（如实说明）
- 未接入任何真实 LLM：Agent 面板为本地确定性实现，候选只读展示、不写入图谱，UI 不伪装成联网检索。
- 写路径（提案→确认→版本）的完整安全链路**已实现并经测试验证**，但 UI 写入入口随 LLM 接入一并开放（见开发计划 P1.3 第 5 步）。
- 单用户本地应用，无鉴权设计；图谱数据编译在源码中，运行期不落盘。

---

## 🏗️ 架构速览（AI 应用视角）

```
core/knowledge/    知识模型：schema（节点/12 边/13 卡/公式）、validation 宪法、traversal 同层优先有界遍历
core/agent/        Agent 契约与能力边界：Knowledge/Review/Build/Development 接口 + capabilityPolicy
server/agent/      离线工作流：审查门禁 → dry-run → 确认凭据 → revision+1 → 审计重放；版本仓
features/agent/    Agent 面板 UI + 离线认知实现（问答/深度搜索/总结）
data/              仓库接口 + 静态实现；98 节点零损迁移 + 16 节点种子切片
app/               页面组装 + P0.4 原始基线（SVG）
```

**内置 Agent 在目标架构中的角色**：

| Agent | 职责 | 设计归属 |
|---|---|---|
| Knowledge | 候选知识/关系/卡片生成，缺口识别 | 🧠 认知层 → LLM 判断点（离线为规则实现） |
| Review | 结构安全审查（层级/环/证据/悬空引用） | ⚖️ 治理层：确定性门禁；语义二审为可选 LLM 扩展 |
| Build | 生成确定性 GraphPatch + 差异预览 | ⚖️ 治理层：纯函数（同提案必同 patch id） |
| Development | 编排：预览 → 用户 confirm/revise/reject → 版本 | ⚖️ 治理层：状态机 |

**写路径铁律**（无论离线在线）：模型只能回答与抽取 → 抽取物为"待审查声明" → 经 Review 结构门禁 → Build 确定性 dry-run → 用户确认（一次性 nonce）→ 追加新 revision，永不改写历史；全程审计可重放。

## 🔌 LLM 接入契约（面向开发者）

- `core/agent/provider-boundary.ts`：`GeneralLlmProvider.respond(request)` 是模型唯一端口——入参为纯文本上下文，出参仅 `{ text, extractedKnowledge? }`；`AgentOrchestrator.handle()` 按意图（回答 / 总结供图 / 提案更新）路由。模型侧**不存在任何仓库或变更方法**。
- `core/agent/contracts.ts`：六类 Agent 接口 + 提案/审查/补丁/审计事件结构；`capabilityPolicy` 白名单保证 general-llm 仅具 `answer`、`extract-claims`。
- `core/ingestion/contracts.ts`：多源输入（对话/论文/文档/媒体）→ 片段 → 声明 → 匹配候选（追加卡片/建节点/建关系/需人工复核）的结构化通道。

## 🗺️ 后续开发计划

### P1.3 · AI 原生化（当前推进中）
1. 卡片栏目元数据表：13 栏目从短标签升级为 `{定义, 判定特征, 正反例}`（few-shot 分类标准），统一 `recommendedBlocks` 与 UI 归类的重复定义；
2. `systemContext` 组装器：当前节点卡片 + 邻域 + 栏目元数据 + 写入规则 → 组装进模型上下文（落地"枚举进上下文"而非"锁死在类型"）；
3. 真实 LLM Provider：实现 `GeneralLlmProvider`（OpenAI 兼容端点 / 本地推理均可），先开放 `answer`/`summarize-for-graph`（零写风险）；
4. 结构化输出解析层：模型 JSON → schema 校验 → 枚举白名单 → 失败重试/降级待审；
5. 打通图谱生长闭环：`propose-graph-update` → 复用现有 Review→Build→确认流水线，UI 复用现成的"待审查候选"消息契约；
6. 纠偏回路：Review 门禁 findings 回灌 revise 上下文，让模型在运行时学习项目约束。

### P1.4 · 在线一等公民体验（亮点）
- 图谱对答带溯源：答案逐句锚定卡片/公式，可点回图；
- 矛盾发现：新声明与既有卡片冲突时主动提示，建议以"误区卡片 + 证据"形式收编；
- 主动缺口提案：Agent 巡查节点覆盖度，起草缺失栏目请你审；
- 对话式多源收编：贴论文/URL → 抽取 → 匹配 → 对话确认（"这条要建边吗？"）；
- 可选语义二审：Review 在结构门禁之上增加 LLM 编委会复核（不跳过、不降级确定性门禁）。

## 🧪 测试与验证

31 项自动化测试（`npm run test`）：98 节点零损往返、领域与层级校验、同层优先遍历的确定性/去重/环安全、可见图三列投影、公式与 UI 契约、四 Agent 确认前零写入/幂等/伪造拒绝/回滚追加修订/审计重放、深度搜索锚定覆盖与只读候选。

## 🧰 技术栈

Next.js 16 + React 19 + Tailwind 4 + KaTeX + zod + TypeScript 5.9（测试：Node 原生 test runner + Vite）。Drizzle/Vinext/Cloudflare 相关命令与代码为历史兼容残留，默认走标准 Next.js 路径，不依赖任何外部服务。

## 📂 目录速览

```
app/                 页面入口 + P0.4 原始基线（知识数据/SVG）
core/knowledge/      知识模型 schema、校验宪法、遍历算法、便携包
core/agent/          Agent 契约、能力边界、图操作、离线实现
core/ingestion/      多源输入 → 声明 → 匹配候选
server/agent/        离线工作流、版本仓、审计重放
server/knowledge/    磁盘版版本化知识仓
data/knowledge/      98 节点零损迁移、种子扩展切片、语义域定义
data/repositories/   仓库接口 + 离线静态实现
features/knowledge-graph/  树、SVG 图谱、知识卡、公式渲染
features/agent/      Agent 面板 + 离线认知实现
tests/               31 项契约与安全测试
docs/                架构与开发计划文档
```

## 📄 文档

- `docs/ARCHITECTURE_PLAN.md` — 架构与四 Agent 工作流
- `docs/DEVELOPMENT_PLAN_P1_2.md` — P1.2 产品口径与边界
- `EXPORT_README.md` — 平台托管导出说明

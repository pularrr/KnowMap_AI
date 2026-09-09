# KnowMap：可交互、可审查的知识图谱 AI 应用工程

KnowMap 用于把一个主题构造成可浏览、可问答、可持续补充的知识图谱应用。它不把 LLM 当作直接改库的“黑盒编辑器”：模型先形成候选节点、知识卡片、关系与证据，再经过结构/语义审查、差异预览和用户确认，才产生新的图谱版本。

项目同时包含两层能力：

- **构建层**：宿主 LLM 围绕新主题设计 Profile、MVP 与完整知识网络，校验后生成独立应用。
- **应用运行层**：最终用户在生成的应用内浏览图谱、问答、导入资料、深度研究和确认知识变更。

> Node.js 要求：`>= 22.13.0`。没有 API Key 时，图谱浏览、卡片、搜索和离线问答仍可使用；联网问答与研究是可选能力。

### 能做什么

| 功能 | 使用价值 |
| --- | --- |
| 图谱浏览与搜索 | 从领域、分类到具体知识节点逐层学习，查看主层级和跨节点关系。 |
| 知识卡片 | 按节点类型呈现定义、原理、假设、输入输出、步骤、工程取舍、失效模式、验证、比较和应用等合适栏目。 |
| 在线问答 | 围绕当前节点提问；回答会产生可持久化的会话摘要，而不是无限累积原始聊天记录。 |
| 深度研究与资料整理 | 从当前节点出发形成候选知识补充；对话总结和资料导入只使用轻量目录、当前祖先链和同级节点进行模型侧去重。 |
| 可控写入 | 候选先经过语义/结构审查和图形 diff；用户可确认、拒绝或修改，未经确认不会写正式图谱。 |
| 可追溯演进 | 图谱状态有 revision、运行记录、候选补丁与证据；停止、失败、预算耗尽与语义收敛是不同状态。 |

### 快速开始：运行 FMCW 雷达示例

本仓库已提供一个完整生成应用：[`examples/fmcw-radar-task`](examples/fmcw-radar-task)。它以 FMCW 雷达知识网络演示图谱浏览、航迹管理等节点研究、资料整理和审查确认流程。

```powershell
cd examples/fmcw-radar-task
npm ci
npm run type-check
npm run dev
```

打开终端显示的本地地址（通常为 `http://localhost:3000`）。如仅想体验浏览，不需要配置任何模型。

若要启用在线问答和研究，可复制 `.env.example` 为 `.env.local`，或在应用的“设置 · AI 配置”中填写兼容 OpenAI Responses API 的服务信息：

```dotenv
LLM_API_KEY=你的密钥
LLM_MODEL=你的模型名
LLM_BASE_URL=https://api.openai.com/v1
```

### 第一次使用怎么做

1. 打开图谱，从根主题进入一个领域和具体节点；先阅读知识卡片，建立基础概念。
2. 在右侧 Agent 面板围绕**当前节点**提问，例如“GNN 与 JPDA 的工程取舍是什么？”。
3. 需要扩展时，选择“深度搜索”；已有材料则粘贴文字或上传资料，选择“整理资料”。
4. 连续对话后，点击“总结并补充知识”。系统读取每轮已保存的会话摘要，而不是重新发送整段聊天历史。
5. 查看候选改动、审查结论与图谱差异。只有确认内容、关系和证据确实合适时，点击确认写入；否则拒绝或继续提问。
6. 任务耗尽预算、被停止或审查失败时，成果与未解决缺口会保留；这不等同于“研究已经完成”。

### 示例与适用场景

- **FMCW 雷达知识图谱**：[`examples/fmcw-radar-task`](examples/fmcw-radar-task)，包含数据关联、航迹管理、估计、信号处理和工程系统知识，是最直接的运行示例。
- **自定义主题**：课程知识网络、技术路线图、算法库、工程设计知识库、实验流程与研究综述都可复用同一数据契约；节点类型、卡片栏目和关系类型需由主题 Profile 选择，而不是机械套用 FMCW 内容。

### 构建自己的第一个图谱应用

如果你是第一次创建知识图谱，不需要自己编写 Profile、MVP 或 JSON。只要在已接入 KnowMap skill 的宿主（例如 Codex）中提出主题和目标，按阶段确认即可：

1. **提出构建请求**：说明主题、使用对象、希望覆盖的范围和输出位置。例如：“请为本科生创建一个 FMCW 雷达知识图谱，重点覆盖信号处理、检测、跟踪和工程实现；先给我看 MVP。”
2. **确认范围**：宿主会先展示 Profile 和 MVP，包括领域导航、代表性节点、卡片栏目与预算。检查主题边界、层级是否合理；需要调整时直接说“增加 XX”“删去 XX”“面向初学者重做”。
3. **确认 MVP 后继续**：明确回复“确认 MVP，继续生成完整网络”。未确认前不会进入完整构建，也不会调用应用内付费模型。
4. **审阅完整网络**：宿主生成完整网络并报告结构问题、语义 warning、未解决缺口和证据待核验项。对不准确内容要求修改，直到你接受审查结果。
5. **创建并启动应用**：确认“创建应用并启动”后，宿主会在项目根目录之外建立一个新的应用目录、注入知识状态并运行安装/类型检查/测试/构建。它会返回应用位置和启动地址。
6. **进入运行阶段**：打开应用后再配置 LLM；问答、深度研究、资料导入和知识确认属于应用运行层。构建阶段的确认与运行阶段的知识写入是两套不同流程。

最简单的指令模板：

```text
请使用 KnowMap 为【主题】创建一个知识图谱。
```
除了主题范围，你也可以对使用对象/重点范围/暂不包含主题/等任意设计提出你的要求。
用户在构建过程中只需要做三类决定：主题范围、MVP 是否通过、审查后的知识是否可交付。Profile 字段、节点层级、卡片栏目、关系方向、校验和脚手架命令由宿主按项目规则完成。


### 总体架构

```text
                 ┌──────────── 构建层（宿主 LLM）────────────┐
主题 → Profile → MVP 网络 → 用户确认 → 完整网络 → 校验/脚手架/注入 → 独立 Next.js 应用
                 └─────────────────────────────────────────┘

用户 / 资料
   │
   ▼
Next.js UI ── API / 后台任务 ── OnlineAgentService ── LLM Provider
   │                 │                    │
   │                 │                    ├─ Knowledge Agent：研究候选
   │                 │                    ├─ Review Agent：语义与结构审查
   │                 │                    └─ Build Agent：确定性 GraphPatch / diff
   │                 ▼
   └──────── RuntimeKnowledgeRepository ── 图谱状态、revision、证据、审计、候选补丁
```

构建层的入口是 [`scripts/knowmap.mjs`](scripts/knowmap.mjs) 和 [`scripts/create-app.mjs`](scripts/create-app.mjs)。它由宿主 LLM 直接生成结构化 JSON；构建阶段明确禁止调用项目中配置的付费 Provider。运行层入口是生成应用的 `/api/agent/*` 与 `/api/knowledge/*`，由应用内 Agent 使用用户配置的 LLM。

### 核心数据模型

- **Node**：`domain`、`category`、`entity` 三种导航角色与更细的 `nodeType` 分离；只有实体节点受“一个节点一个具体知识对象”约束。
- **Card**：卡片是节点内容，不是节点本身。`definition` 表示该节点的定义/概念/方法基础或理论知识；其余栏目按节点类型选择，不强制填满。
- **Edge / Evidence / Claim**：关系有方向、理由和可选证据；资料先拆为 artifact、segment 与 claim，再生成候选写入。
- **Runtime state**：`knowledge-state.json` 是带状态封装与 checksum 的运行时数据，不能以裸 network JSON 直接替换。

### 项目亮点与具体实现

| 亮点 | 实现方式与设计意图 |
| --- | --- |
| 图谱适配的上下文控制 | 对话采用“上一份摘要 + 本轮问答 → 新摘要”的滚动持久化策略；资料总结和补充只将轻量领域/分类目录、根到当前节点的祖先链、当前同级节点传给模型做去重。模型上下文有限，提交前仍用全图硬去重兜底。 |
| 认知与治理解耦 | Knowledge Agent 负责提出节点、卡片、关系和证据；Review Agent 负责冲突、层级、关系方向、引用与栏目检查；Build Agent 把候选转换为确定性操作并生成 diff。模型不能绕过确认直接写入。 |
| 长任务的可恢复性 | 自适应研究按主题/轮次保存检查点和小批次成果；模型“认为收敛”、预算耗尽、用户停止、失败和带缺口完成分别记录，避免把被迫停止伪装为完成。 |
| 可迁移的主题建模 | Profile 声明领域、层级、节点类型、可用卡片栏目、研究预算和视觉分支；通用引擎不依赖 FMCW 专有内容，生成应用只携带自己的 Profile 与运行时数据。 |
| 从原型到工程部署 | 默认文件型运行时便于本地启动；可切换 PostgreSQL、对象存储与 Redis worker，以支持共享状态、长任务和跨进程队列。 |

### 可靠性设计

1. **写入门禁**：研究结果只形成 pending change。结构审查、语义审查、确认令牌、revision 比较和用户确认共同决定是否 apply。
2. **确定性校验**：`validateKnowledgeDataset` 检查层级、端点、角色、粒度、关系与卡片模型；构建与运行层共用数据契约。
3. **小批次输出与格式恢复**：资料整理限制单批节点/卡片数量；输出截断时保留完整片段，缩小任务范围重试，而不是将“只有推理、没有 JSON”误判成普通格式错误。
4. **取消是持久化状态**：停止操作先写入 `cancelled`，执行端持续检查该状态并中止本地请求；不能只依赖单个进程内的 `AbortController`。流式文本刷新不得覆盖取消状态。
5. **幂等与去重**：证据、节点、边和 claim 使用确定性 ID 或唯一键；重复段落不会生成两次同一 claim 写操作。
6. **安全退化**：没有 LLM 配置时，应用仍以离线知识卡运行；审查无法完成时保留研究成果但拒绝开放写入。

### 技术栈与技术路线

| 层级 | 技术 |
| --- | --- |
| Web 应用 | Next.js 16、React 19、TypeScript、Tailwind CSS、shadcn/base UI 组件。 |
| 图谱与知识表达 | 自定义 TypeScript schema、Profile 驱动的节点/关系/卡片模型、LaTeX + KaTeX 渲染。 |
| Agent | OpenAI Responses 兼容 Provider 抽象、流式响应、工具观察、自适应研究、结构化 JSON 输出与独立审查。 |
| 数据与任务 | 本地 JSON/文件运行时；可选 PostgreSQL + Drizzle、S3 兼容对象存储、Redis 队列与 worker。 |
| 文档/资料处理 | 文本分段、claim 抽取、PDF 解析、OCR（Tesseract）与可审查资料工件。 |
| 质量保障 | TypeScript 类型检查、Node test、运行时数据校验、模型 Provider 边界测试、工作流与可靠性回归测试。 |

### 构建层用法：从主题生成独立应用

构建层面向**能够调用本地工具的宿主 LLM**（例如已加载 KnowMap skill 的 Codex），而不是最终生成应用里的聊天模型。它的职责是把一个新主题转换为可校验的知识网络和独立 Next.js 应用；它不读取项目已有 API Key，也不调用应用内配置的付费 Provider。

#### 0. 发现与准备

在项目根目录安装依赖并输出机器可读的工具描述：

```powershell
npm ci
node scripts/knowmap.mjs discover
```

宿主应注册 [`plugin/discovery.mjs`](plugin/discovery.mjs) 返回的 `name`、`description` 和 `inputSchema`，再把调用映射到 `runKnowmap()` 或下方的 CLI。**模型不会自行扫描本地项目或自动获得工具权限。**

选择一个项目根目录之外、此前不存在的任务目录保存全部产物。例如：

```text
D:\knowmap-builds\my-topic\
  profile.json
  mvp.json
  mvp-validation.json
  full.json
  reviewed.json
  app\
```

不得将这些任务产物写入本仓库的 `work/`、`outputs/`、`data/`、`plugin/` 或模板目录；这样可避免覆盖源码和检查点。

#### 1. 设计 Profile，生成并验收 MVP

宿主 LLM 阅读 [`plugin/SKILL.md`](plugin/SKILL.md) 及相关工作流后，直接编写 `profile.json` 与 `mvp.json`。其中 Profile 描述主题、根节点、领域、节点类型、关系、卡片栏目、层级约束和研究预算；MVP 只呈现有限的导航层、代表性具体节点和必要知识卡。

先校验 Profile，再校验 MVP 网络：

```powershell
node scripts/knowmap.mjs validate-profile --input D:\knowmap-builds\my-topic\profile.json --output D:\knowmap-builds\my-topic\profile-validated.json
node scripts/knowmap.mjs validate --input D:\knowmap-builds\my-topic\mvp.json --output D:\knowmap-builds\my-topic\mvp-validation.json
```

将 MVP 图谱、卡片和校验 warning 展示给用户；只有用户确认方向与预算后，才能进入完整网络阶段。构建层的 `design`、`mvp`、`full` 不是 CLI 自动生成动作，内容必须由宿主 LLM 按契约直接产出，避免错误地把构建工作转交给应用内 LLM。

#### 2. 完整网络、审查与脚手架

宿主以已确认 MVP 为约束生成 `full.json`，进行结构校验和人工语义审查；修复后形成 `reviewed.json`。完整网络应包含 `confirmedMvp` 或等价确认信息，以及已批准的预算。

```powershell
node scripts/knowmap.mjs validate --input D:\knowmap-builds\my-topic\full.json --output D:\knowmap-builds\my-topic\full-validation.json

node scripts/create-app.mjs --profile-file D:\knowmap-builds\my-topic\profile-validated.json --name my-knowledge-map --output D:\knowmap-builds\my-topic\app

node scripts/knowmap.mjs inject --input D:\knowmap-builds\my-topic\reviewed.json --output D:\knowmap-builds\my-topic\app
```

`create-app` 复制通用运行时与已激活 Profile；`inject` 将审查后的网络转换成带 checksum 的 `data/runtime/knowledge-state.json`，并回读验证。不要把 `reviewed.json` 直接重命名为运行时状态文件。

#### 3. 交付生成应用

```powershell
cd D:\knowmap-builds\my-topic\app
npm ci
npm run type-check
npm test
npm run build
npm run dev
```

至此，用户可在独立应用中自行配置 LLM、进行问答与资料研究。之后的知识扩展属于**应用运行层**：它通过候选、审查、确认和 revision 演进图谱，不应再次使用构建层 `inject` 覆盖正在使用的运行时数据。

### 开发与验证

```powershell
npm ci
npm run type-check
npm run test:plugin
npm run test:reliability
npm run build
```

常用命令：

```powershell
# 查看可供宿主注册的插件能力
node scripts/knowmap.mjs discover

# 查看内置 Profile
node scripts/create-app.mjs --list-profiles

# 根据已校验 Profile 创建一个全新应用；输出必须在项目根目录之外
node scripts/create-app.mjs --profile-file <绝对路径/profile.json> --name my-knowledge-map --output <绝对路径/新目录/app>
```

创建新应用的推荐流程是：设计 Profile → 生成并验收 MVP → 生成完整网络 → `validate` → `create-app` → `inject` → 在生成应用内运行测试与构建。详细约束与命令见 [`plugin/SKILL.md`](plugin/SKILL.md)。

### LLM / 宿主接入边界

该项目不是安装后会被所有模型自动发现的远程服务。宿主需要读取 `plugin/discovery.mjs` 的 `discoverKnowmap()`，将返回的名称、描述和输入 schema 注册为本地工具，再把调用映射到 `runKnowmap()` 或 `scripts/knowmap.mjs`。Codex 可通过安装/加载对应 skill 后遵循 [`plugin/SKILL.md`](plugin/SKILL.md) 使用它；其他宿主需要自行适配其工具协议。

## 目录导航

```text
plugin/                 KnowMap skill、工作流与发现描述
scripts/                校验、脚手架、注入与发现命令
core/                   图谱、Agent、LLM、资料的共享契约与校验
server/                 Provider、任务、研究、审查、运行时仓储
features/               图谱和 Agent 的界面功能
profiles/               当前/示例主题的 Profile
templates/app/          独立应用模板
examples/fmcw-radar-task/  FMCW 生成应用快速示例
tests/                  结构、工作流、Provider 和可靠性回归测试
```

## 注意事项

- 研究和导入的候选内容不等于已验证事实；应审阅来源、证据和 diff 后再确认。
- LLM 的真实检索质量取决于所配置的模型、网络、资料和预算；测试通过只代表工程行为符合预期，不代表所有领域结论正确。
- 生产部署应使用 PostgreSQL/对象存储/Redis 等共享基础设施；文件运行时适合本地单机开发。

## 个人项目体验
- 开发流程：计划需求➡️逐功能开发➡️跑通demo+渲染效果➡️优化LLM工作流（ReAct流程）➡️优化提示词（**不同节点身份与知识类型的定义要明确，不明确不同宿主LLM生成的框架区别大**）➡️提高任务可靠性（保证长任务（退回/停止/缓存等）+有限步+错误返回/兜底+）➡️迭代优化功能，工作流与约束。
- 定义抽象，优化流程，给AI栓绳但是别栓死了跑得更快，然后注意悬崖勒马。
- 注意避免一些硬性约束和硬编码，给AI一定的发挥空间，先粗后细，返回一个相对确定/稳定的响应。
- 先有计划，明确后开发，做好记录和版本管理。
- ...未待完续。
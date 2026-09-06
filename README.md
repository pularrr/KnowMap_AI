# KnowMap · AI 原生知识图谱应用构建框架

KnowMap 是一个面向主题知识网络的 AI 原生应用框架。它的核心交付物不是插件本身，而是由插件构建出来的、可独立运行的知识图谱应用：用户输入一个主题，宿主 LLM 设计知识结构并生成知识网络，框架完成确定性校验、脚手架和数据注入，最终得到一个可以浏览、问答、研究和受控扩展的独立应用。

当前内置主题是 **FMCW 雷达知识图谱**，覆盖检测、估计、关联、跟踪、系统实现和 AI 学习等知识域。框架也支持通过 Profile 构建激光雷达、代码知识图谱等其他主题应用。

> 重要定位：项目是“两层应用结构”——插件构建层负责创建应用；应用运行层负责在已创建的应用内使用知识图谱。插件是构建背景，主要使用对象是插件交付出的独立应用。

## 30 秒理解两层结构

```text
用户主题
   ↓
插件构建层：宿主 LLM + Profile + 知识网络 + 校验/脚手架/注入
   ↓
插件构建的独立知识图谱应用
   ↓
应用运行层：图谱浏览 + AI 问答 + 深度研究 + 资料接入 + 用户确认后更新
```

### 第一层：插件结构与构建层

插件位于 `plugin/`，提供任务 Profile、构建契约、工作流说明、提示词模板和发现入口。宿主 LLM 根据用户主题直接编写 `Profile`、MVP 和完整 `network` JSON；项目脚本负责校验、创建应用、注入已审查的数据，并不会在构建阶段调用项目中配置的 Provider。

这一层的产物是一个新的应用目录，包括主题配置、知识数据、共享运行时、UI、API 和验收所需的工程文件。产物必须写入项目根目录之外的全新隔离目录，避免覆盖源项目和其他任务。

### 第二层：插件构建出的应用运行层

独立应用加载已注入的知识网络，通过统一运行时提供：

- 导航树、图谱画布和知识卡片；
- 当前节点问答、对话总结和知识缺口深度搜索；
- 文档、论文、对话或其他资料的知识接入；
- 候选节点、关系和卡片的审查、预览、用户确认与版本化写入；
- 历史版本、保存点、回滚和审计记录。

运行层可以接入用户自行配置的 LLM，也可以先使用本地确定性能力。模型只能提供回答、抽取或候选声明，不能直接访问仓库或绕过结构校验写入图谱。

## 核心理念：AI 原生，但由图谱约束 AI

- **图谱是应用的中心**：AI 围绕当前节点、邻域、卡片栏目和关系工作，而不是把知识图谱当作普通聊天的附属展示。
- **认知与治理分离**：LLM 负责理解、归类、候选生成和缺口判断；结构校验、GraphPatch、状态机、版本仓和审计由确定性代码负责。
- **所有写入都可审查**：模型输出先成为待审查声明，再经过校验、差异预览和一次性确认，最后以新版本追加写入。
- **离线能力是安全底座**：没有 API Key 时仍可浏览图谱、查看卡片、进行本地问答和缺口分析；联网模型是增强能力，不是数据安全的前提。

## 快速开始：先运行内置 FMCW 应用

### 环境要求

- Node.js **≥ 22.13.0**
- Windows 建议使用 `npm.cmd`
- 无需 API Key、数据库或外部服务即可运行基础功能

### 安装、验证与启动

```powershell
npm.cmd ci
npm.cmd run type-check
npm.cmd test
npm.cmd run dev
```

打开 `http://localhost:3000`。生产构建与启动：

```powershell
npm.cmd run build
npm.cmd run start
```

### 应用内使用方法

1. 在左侧知识域树或中间图谱中选择节点。
2. 在右侧知识卡查看理论知识、应用知识、其他知识和历史修改。
3. 在 Agent 面板围绕当前节点提问，或执行“深度搜索”查看缺失栏目和邻域候选。
4. 粘贴文档、论文、对话或知识摘要，选择资料类型后进行整理和接入。
5. 对候选知识查看差异、审查结果和证据；只有用户确认后才会写入新版本。
6. 使用历史修改、保存点和回滚检查知识变化。

未配置真实 LLM 时，Agent 使用本地确定性实现；候选结果只读展示，不会假装是联网检索。配置 LLM 后，打开应用中的模型设置，填写 OpenAI-compatible Base URL、模型名和 API Key。密钥由用户在独立应用中自行配置，不写入 Profile、脚手架或插件任务文件。

## 利用 LLM 开始构建你的第一个 AI 图谱

你不需要先手动编写 Profile 或知识网络。将本项目文件夹发送给能够读取本地文件、执行本地命令的 LLM，例如 Codex、豆包等，然后告诉它使用项目内的 `knowmap-plugin` Skill，按插件构建流程生成独立应用。

可以直接使用下面的提示词：

```text
利用该项目中的 knowmap-plugin Skill，帮我生成一个关于“xxx”的 AI 原生知识图谱应用。
请先理解项目结构和 Skill 说明，再设计 Profile，生成 MVP 供我确认；
确认后继续生成完整知识网络，完成校验、创建独立应用、注入数据，并运行测试和构建。
所有产物放在项目根目录之外的新目录，不要覆盖原项目。
```

根据目标不同，也可以这样描述：

```text
利用该 Skill，帮我绘制“xx 项目”的软件架构知识图谱，
要求包含模块层级、核心组件、数据流、依赖关系、部署结构和关键技术说明，
最后生成一个可以运行的独立知识图谱应用。
```

```text
利用该 Skill，帮我构建“xxx 技术路线”的学习知识图谱，
要求先给出 MVP 让我确认，再扩展完整网络，并保留节点、关系、卡片和证据。
```

LLM 执行时会经历“设计 Profile → 生成 MVP → 用户确认 → 生成完整网络 → 校验 → 创建应用 → 注入数据 → 验收”流程。MVP 未确认前不会继续生成完整网络；最终应用会输出到独立目录，之后可以单独安装、运行和配置自己的 LLM。

> 注意：不同 LLM 对本地文件、Skill 和命令执行的支持不同。若模型不能直接执行命令，请让它生成 Profile、MVP 和 network 文件，再按照下方“使用插件构建新的主题应用”的命令完成校验、脚手架和注入。

## 技术介绍

### 技术栈

KnowMap 使用 TypeScript 作为主开发语言，采用 Next.js App Router 构建 Web 应用，React 负责交互界面，Tailwind CSS 和自定义 CSS 负责视觉层。知识卡片中的数学公式使用 KaTeX 渲染，结构化输入和模型输出使用 Zod 进行运行时校验。

| 技术领域 | 采用方案 | 作用 |
| --- | --- | --- |
| 应用框架 | Next.js 16、React 19、TypeScript 5.9 | 页面、服务端 API 和类型安全 |
| 样式与交互 | Tailwind CSS 4、React Hook Form、Radix UI 相关组件 | 响应式布局、表单和交互组件 |
| 知识展示 | SVG 图谱、知识树、KaTeX、React Markdown | 层级导航、关系可视化、公式和资料渲染 |
| 数据契约 | Zod、TypeScript contracts | Profile、知识网络、运行时状态和 Agent 输出校验 |
| 本地数据 | JSON 运行时仓、浏览器存储 | 离线运行、初始数据和版本化状态 |
| 服务端数据 | PostgreSQL、Drizzle ORM | 可选的持久化部署和迁移 |
| 异步任务 | Redis、任务队列、独立 Worker | 深度研究、长任务和后台 Agent 执行 |
| 对象存储 | S3 兼容对象存储适配器 | 可选的资料与文件存储 |
| 测试与构建 | Node Test Runner、Vite、ESLint、Next Build | 契约测试、类型检查、规范检查和生产构建 |

### 系统分层

项目按“主题配置—领域模型—应用用例—基础设施—界面”分层，插件构建层和应用运行层共用领域契约，但不混淆执行职责。

```text
宿主 LLM / 用户主题
          ↓
plugin/ + scripts/                 插件构建层
  Profile → MVP → network → validate → create-app → inject
          ↓
templates/app/                     独立应用模板
          ↓
app/ + features/                   UI 与交互
          ↓
server/agent/ + server/runtime/   Agent 用例、任务、版本与运行时仓
          ↓
core/knowledge/ + core/ingestion/  知识模型、校验、遍历与资料摄取
          ↓
JSON / PostgreSQL / Redis / S3     可替换基础设施
```

- `core/` 保存与主题无关的领域规则，包括知识节点、关系、卡片栏目、公式、证据、遍历和校验。
- `profiles/` 保存主题差异，包括根节点、知识域、允许的节点/边类型、卡片栏目和研究规则。
- `server/` 编排运行时用例，包括 Agent 工作流、深度研究、任务队列、知识仓、保存点和审计。
- `features/` 提供知识图谱、知识卡和 Agent 面板等前端功能，尽量通过用例接口访问数据。
- `plugin/` 和 `scripts/` 只负责从主题生成新的应用，不是运行时内容本身。

### 知识数据模型

构建阶段的 `KnowledgeNetwork` 是适合宿主 LLM 生成和人工审查的网络格式，主要由节点、卡片块、关系和证据组成。注入后会转换成应用运行时使用的 `KnowledgeDataset`：

```text
KnowledgeDataset
├─ domains       知识域与视觉分支
├─ nodes         节点身份、规范名称、短事实、父子层级
├─ cards         节点摘要与定义/原理/验证等卡片块
├─ edges         有类型、有理由的语义关系
├─ formulas      LaTeX 公式与符号解释
└─ revision      当前版本、保存点和审计关联
```

节点身份、卡片内容和语义关系分开存储，使图谱结构、卡片内容和 UI 展示可以独立校验。主题 Profile 决定哪些类型和栏目适用于当前应用，避免把 FMCW 雷达的栏目机械复制到其他主题。

### AI Agent 与受控写入

应用中的 AI 不是一个可以直接修改数据库的自由代理，而是被限制在明确能力边界内的 Agent。典型运行路径如下：

1. `Context Builder` 根据当前节点、邻域、相关卡片、用户资料和任务类型组装上下文。
2. LLM 或本地 Agent 返回回答、摘要、知识声明或研究候选。
3. 输出经过 JSON 归一化、Profile 规则和 Zod Schema 校验。
4. Review 检查层级、关系端点、环、栏目适用性、证据和悬空引用。
5. Build 将通过审查的声明转换为确定性的 `GraphPatch`，生成差异预览。
6. 用户确认后才写入新的 revision，并追加审计事件；拒绝或失败不会写入知识仓。

因此，模型负责语义判断，代码负责结构安全和状态变化。离线 Agent 与真实 LLM 共用这条边界，替换模型不会改变图谱的写入规则。

### 插件构建机制

插件不是一个把内容直接塞进现有页面的脚本，而是一个应用生成流水线：

```text
TaskProfile
    ↓
宿主 LLM 生成 MVP
    ↓ 用户确认方向
宿主 LLM 生成完整 KnowledgeNetwork
    ↓
validateProfile + validateKnowledgeDataset
    ↓
create-app 复制模板并激活 Profile
    ↓
inject 生成 runtime/knowledge-state.json
    ↓
独立应用安装、测试、构建和运行
```

`plugin/discovery.mjs` 提供机器可读的能力描述，`scripts/knowmap.mjs` 提供校验和注入入口，`scripts/create-app.mjs` 负责从 `templates/app/` 生成独立应用。构建期产物必须位于项目根目录之外的全新目录，且构建阶段不读取项目中已有的模型密钥。

### 存储与部署

默认模式面向本地优先使用：初始知识来自源码，运行时状态写入应用的 `data/runtime/knowledge-state.json`，不依赖数据库和外部服务。需要多人访问、长期运行或后台任务时，可以启用 PostgreSQL 保存运行时状态和任务数据，使用 Drizzle 迁移管理表结构，并通过 Redis/Worker 执行长时间 Agent 任务；资料文件则可以接入 S3 兼容对象存储。

这几种基础设施是运行时适配器，不改变上层的 `KnowledgeDataset`、Agent 契约和确认流程。因此同一个主题应用可以先以本地模式验证，再按部署需要迁移到数据库、队列和对象存储环境。

### API 入口

应用运行层的主要接口包括：

| 接口 | 用途 |
| --- | --- |
| `GET /api/knowledge` | 读取当前知识图谱和运行时数据 |
| `POST /api/agent/chat` | 围绕当前节点进行问答 |
| `POST /api/agent/jobs` | 创建 Agent、总结或资料处理任务 |
| `GET /api/agent/jobs/:id` | 查询后台任务状态和结果 |
| `POST /api/knowledge/ingest` | 接入文本、对话、文档或论文内容 |
| `POST /api/agent/confirm` | 用户确认后提交受控 GraphPatch |
| `POST /api/knowledge/savepoint` | 创建或管理知识版本保存点 |
| `GET/POST /api/llm/config` | 读取或保存应用的模型配置 |

插件构建接口和应用运行接口是两套边界：前者生成 Profile 与初始知识网络，后者只在已经创建的应用内使用和扩展知识。

## 当前能力

| 层 | 能力 | 状态 |
| --- | --- | --- |
| 插件构建层 | Profile 校验、MVP/完整网络工作流、网络校验、应用脚手架、运行时数据注入 | ✅ 可用 |
| 知识模型 | 节点、语义关系、卡片栏目、公式、证据与主题 Profile | ✅ 可用 |
| 应用运行层 | 知识树、图谱画布、知识卡、公式渲染、历史记录 | ✅ 可用 |
| 本地 AI 能力 | 当前节点问答、对话总结、13 类知识缺口深度搜索 | ✅ 可用 |
| 受控知识生长 | 提案、结构审查、确定性补丁、确认、版本化写入、回滚与审计 | ✅ 可用 |
| 外部 LLM | OpenAI-compatible Provider、模型测试与应用内配置 | 🔧 按应用配置 |

## 使用插件构建新的主题应用

插件构建的是独立应用，不是对当前 FMCW 应用的直接改写。建议将所有中间产物放在项目根目录外，例如 `D:\\knowmap-tasks\\lidar-2026\\`。

### 1. 查看插件能力

```powershell
npm.cmd install
node scripts/knowmap.mjs discover
```

也可以在宿主环境导入 `plugin/discovery.mjs` 的 `discoverKnowmap()`，将返回的工具描述注册到宿主 LLM；工具执行映射到 `scripts/knowmap.mjs` 的 `runKnowmap()`。

### 2. 设计并校验 Profile

Profile 描述应用名称、根节点、知识域、节点类型、关系类型、卡片栏目、层级规则和提示词。它是主题应用的边界，不是 FMCW 内容的复制品。

```powershell
node scripts/knowmap.mjs validate-profile `
  --input D:\\knowmap-tasks\\lidar-2026\\profile.json `
  --output D:\\knowmap-tasks\\lidar-2026\\profile.validated.json
```

构建阶段由宿主 LLM 直接生成 JSON；不要调用项目已配置的 DeepSeek 或其他付费 Provider。构建前请阅读 [插件执行说明](plugin/SKILL.md) 和 [层级构造法](plugin/references/hierarchy-construction.md)。

### 3. 生成 MVP，确认方向，再生成完整网络

MVP 用于先确认主题边界、域树、根节点、少量节点和示例卡片；用户确认后再继续完整网络。完整网络应包含 `nodes`、`cardBlocks`、`relations`，可按需要附带 `evidence`。

这一步由宿主 LLM 编写结构化文件，项目脚本负责后续确定性验证。不要用固定节点数量凑内容，也不要把所有细概念平铺在一个域下。

### 4. 审查网络

```powershell
node scripts/knowmap.mjs validate `
  --input D:\\knowmap-tasks\\lidar-2026\\reviewed-input.json `
  --output D:\\knowmap-tasks\\lidar-2026\\validation-report.json
```

校验会检查 Profile 引用、节点层级、关系端点、卡片栏目、环、孤立结构、名称和摘要等问题。warning 也需要由宿主 LLM 或用户逐项判断，不能把“校验通过”理解为内容已经完成语义审查。

### 5. 创建独立应用

```powershell
node scripts/create-app.mjs `
  --profile-file D:\\knowmap-tasks\\lidar-2026\\profile.json `
  --name lidar-knowledge-map `
  --output D:\\knowmap-tasks\\lidar-2026\\app
```

脚手架会复制应用模板、共享引擎、运行时、插件契约和 API，写入 `profiles/active.json`，并根据 Profile 生成应用配置。输出目录必须不存在且位于本项目根目录之外。

### 6. 注入已审查知识网络

```powershell
node scripts/knowmap.mjs inject `
  --input D:\\knowmap-tasks\\lidar-2026\\reviewed-input.json `
  --output D:\\knowmap-tasks\\lidar-2026\\app
```

注入会生成 `app/data/runtime/knowledge-state.json`，同时进行数据往返检查和 checksum 保护。注入是构建阶段的初始数据交付，不用于覆盖已有应用运行时状态。

### 7. 在独立应用中验收

```powershell
Set-Location D:\\knowmap-tasks\\lidar-2026\\app
npm.cmd install
npm.cmd run type-check
npm.cmd test
npm.cmd run build
npm.cmd run dev
```

验收重点是：主题 Profile 是否生效、根节点和域树是否正确、卡片栏目是否适用、图谱和公式是否正常、问答是否围绕当前节点、资料入口是否可用，以及写入前是否始终需要用户确认。

## 应用运行层的 AI 工作流

```text
当前节点 / 邻域 / 卡片 / 用户资料
                  ↓
             Context Builder
                  ↓
             LLM 或本地 Agent
                  ↓
      回答 / 摘取声明 / 研究候选
                  ↓
          Profile + Schema 校验
                  ↓
        Review → Build → 差异预览
                  ↓
              用户确认
                  ↓
          新 revision + 审计事件
```

应用内的 `/api/agent/chat`、`/api/agent/jobs` 和 `/api/knowledge/ingest` 等接口服务于运行层；插件的 `design`、`mvp`、`full`、`validate`、`inject` 和 `create-app` 流程服务于构建层。两层共用数据契约和 `validateKnowledgeDataset`，但职责、执行者和数据生命周期不同。

## 安全边界与数据说明

- 构建层不读取或测试项目中已有的 Provider Key。
- API Key 只能由用户在独立应用的设置中配置，不进入 Profile、网络 JSON、脚手架或提交记录。
- LLM 输出只能作为文本或结构化声明进入应用，不能直接调用仓库写入方法。
- 确定性校验不会被语义模型绕过；用户确认是受控写入的最后一道门。
- 运行时知识状态默认保存在应用的本地运行时目录；使用数据库迁移部署时，数据边界以对应部署配置为准。
- 任何 AI 回答、节点摘要、关系和资料归类都应由用户复核。

## 项目目录

```text
plugin/                    插件构建说明、契约、工作流、提示词和发现入口
scripts/                   构建、校验、脚手架和注入命令
templates/app/             独立知识图谱应用模板
profiles/                  主题 Profile；当前包含 FMCW Radar
core/knowledge/            知识模型、校验、遍历、便携数据包
core/ingestion/            多源资料 → 片段 → 声明 → 匹配候选
server/profile/            Profile 加载与确定性校验
server/agent/              Agent、研究、任务队列和知识写入工作流
server/runtime/            运行时知识仓、本地状态和数据库适配
data/knowledge/            内置主题知识数据和初始数据
features/knowledge-graph/  知识树、图谱画布、知识卡和公式组件
features/agent/            Agent 面板和本地认知实现
app/api/                   Profile、Agent、知识和 LLM 配置接口
tests/                     UI、模型、插件工作流和 Agent 安全测试
docs/                      架构、迁移、开发计划和审查报告
```

## 常用命令

```powershell
npm.cmd run dev             # 启动开发应用
npm.cmd run build           # 构建应用
npm.cmd run type-check      # TypeScript 类型检查
npm.cmd test                # 运行项目测试
npm.cmd run lint            # ESLint 检查
npm.cmd run plugin:discover # 查看插件能力描述
```

## 相关文档

- [插件执行说明](plugin/SKILL.md)
- [插件 README](plugin/README.md)
- [层级构造法](plugin/references/hierarchy-construction.md)
- [架构规划](docs/ARCHITECTURE_PLAN.md)
- [AI 应用重构计划](docs/AI_APPLICATION_REFACTOR_PLAN.md)
- [插件审查计划](docs/plugin-audit-plan.md)
- [插件审查结果](docs/plugin-audit-results.md)
- [平台托管导出说明](EXPORT_README.md)

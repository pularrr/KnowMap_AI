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

## 当前能力

| 层 | 能力 | 状态 |
| --- | --- | --- |
| 插件构建层 | Profile 校验、MVP/完整网络工作流、网络校验、应用脚手架、运行时数据注入 | ✅ 可用 |
| 知识模型 | 节点、语义关系、卡片栏目、公式、证据与主题 Profile | ✅ 可用 |
| 应用运行层 | 知识树、图谱画布、知识卡、公式渲染、历史记录 | ✅ 可用 |
| 本地 AI 能力 | 当前节点问答、对话总结、13 类知识缺口深度搜索 | ✅ 可用 |
| 受控知识生长 | 提案、结构审查、确定性补丁、确认、版本化写入、回滚与审计 | ✅ 可用 |
| 外部 LLM | OpenAI-compatible Provider、模型测试与应用内配置 | 🔧 按应用配置 |

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


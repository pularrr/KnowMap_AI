# KnowMap AI

KnowMap 是一个通用的 AI 原生知识图谱构建 Skill 同时有DSH插件版本。它将主题 Profile、知识网络校验、应用脚手架和数据注入组合为确定性工作流，帮助宿主 LLM 生成可独立运行、可审查、可回滚的知识图谱应用。

FMCW 雷达知识图谱是独立的完整基线示例。

## 项目边界

```text
KnowMap Skill
├─ plugin/                   通用 Skill 契约、工作流与发现入口
├─ templates/app/            无领域默认值的应用模板
├─ core/、server/、features/  通用图谱与 Agent 运行能力
├─ examples/fmcw-radar/      独立 FMCW 基线与运行时状态
└─ plugins/dsh-plugin/       独立 DSH 插件，不被主 Skill 加载
```

## Skill 构建流程

```text
主题描述 → Profile 设计 → MVP 知识网络并由用户确认 → 完整网络
        → 结构校验与审查 → 创建独立应用 → 注入知识数据并验收
```

使用时让具备本地文件与命令能力的 LLM 阅读 [plugin/SKILL.md](plugin/SKILL.md)：

```text
使用项目内 knowmap-plugin Skill，为“你的主题”构建 AI 原生知识图谱。
先设计 Profile 和 MVP，等待我确认后生成完整网络；校验通过后在项目根目录外创建独立应用并注入数据。
```

构建期由宿主 LLM 直接生成 Profile 和 Network；不会读取或调用项目运行时配置的外部 LLM 密钥。生成应用交付后，用户可自行配置模型。

## FMCW 雷达基线

[examples/fmcw-radar](examples/fmcw-radar) 保存 FMCW 的完整领域资产：

- FMCW Profile 与领域提示词；
- 节点、卡片、关系、公式及参考扩充数据；
- 从旧内置应用迁出的运行时图谱状态与恢复副本；
- 旧版可视化数据，便于作为复杂领域回归样例。

它是示例，不参与通用模板初始化。若需将其部署为单独应用，应使用脚手架在项目外创建应用后，显式注入该示例的 Profile 和数据。

## DSH 插件

[plugins/dsh-plugin](plugins/dsh-plugin) 是独立的 `@knowmap/dsh-plugin` 包。它保有自己的 `package.json`、`package-lock.json` 和本地依赖目录；主项目不安装、不导入也不测试其 DeepSeek DSH 依赖。

在 DSH 环境中单独使用：

```powershell
npm --prefix plugins/dsh-plugin ci
npm --prefix plugins/dsh-plugin run type-check
```

随后按其 [README](plugins/dsh-plugin/README.md) 配置 `cordis.example.yml`。该插件只暴露校验、脚手架和注入工具；Profile、MVP 与完整网络仍由 DSH 宿主模型编写。

## 开发与验证

环境要求：Node.js 22.13 或更高版本。

```powershell
npm ci
npm run type-check
npm test
npm run build
```

`npm test` 验证通用插件发现、Profile 校验、MVP 确认门禁、非 FMCW 应用生成、数据注入和运行时往返读取。DSH 插件需在其子目录独立验证。

## 核心保证

- LLM 负责理解、研究和候选生成；确定性代码负责校验、差异、确认、版本与审计。
- 任意写入先成为候选，只有用户确认后才提交运行时图谱。
- 无外部模型时仍可浏览和使用已注入的知识数据。
- FMCW 与 DSH 都是独立资产，不会成为新主题应用的隐式依赖。

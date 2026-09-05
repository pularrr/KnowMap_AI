# P3-8 宿主插件边界修正

日期：2026-09-05

## 问题分析

一次非 FMCW 生成实践暴露了四类系统问题：构建文档仍允许调用项目 ProfileDesigner/KnowledgeGenerator，从而可能读取已配置 DeepSeek；13栏目被误当成每个任务的固定完整模板；中间文件可写进 KnowMap 项目；生成模板仍有 `fmcw` 根节点回退和 URL 深链加载时序残留。此外，code 栏目的正文契约是 `code` 字段而非普通 `text`。

## 修正

- `scripts/knowmap.mjs` 在读取输入或配置前拒绝 design/mvp/full；discovery 不再发布这些动作。宿主直接编写 Profile、MVP 和完整网络，只调用 profile-example、validate-profile、validate、create-app、inject。
- Skill、三个工作流和生成提示词统一规定：构建期不读取、不测试、不调用项目 DeepSeek/其他 Provider。API Key 只在应用交付后由用户配置。
- 13栏目定义为当前 UI 支持的候选分类词表。每个 Profile 由宿主按任务选择子集，definition 唯一通用必选，不再要求每节点5项或填满13项。
- `create-app.mjs` 硬性拒绝项目根目录内的输出。Profile、批次、校验报告和生成应用必须位于项目外的新隔离目录。
- 修复画布、卡片和页面对 `fmcw` 根 ID 的硬编码回退；URL 节点参数在运行时数据加载后再应用；生成的 JSON Profile 使用 `as unknown as TaskProfile`，避免元组字段推断失败。
- Codex 插件提供发现 Skill；DSH 适配器只注册无 Provider 的示例、校验、脚手架和注入工具，并强制项目外 outputRoot。

## 明确边界

宿主 LLM 本身由 Codex、DSH 等宿主选择，这不等于调用 KnowMap 项目的 Provider。生成应用在交付后仍保留用户自行配置外部 LLM 的能力。若任务需要13栏目之外的新语义栏目，必须先扩展 schema、目录和 UI 渲染器，不能只在 Profile 中创造未知类型。

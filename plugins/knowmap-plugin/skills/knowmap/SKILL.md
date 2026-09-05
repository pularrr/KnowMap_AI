---
name: knowmap
description: 从自然语言主题创建可运行的 AI 知识网络应用。用于设计 TaskProfile、生成和确认 MVP、继续完整研究、校验网络、创建应用并注入数据；也用于用户明确要求调用 KnowMap 或知识图谱生成插件时。
---

# KnowMap Codex 入口

在当前工作区向上定位同时包含 `plugin/discovery.mjs`、`plugin/SKILL.md` 和 `scripts/knowmap.mjs` 的 KnowMap 项目根目录。找不到时说明当前工作区没有完整 KnowMap 源码，不要猜测路径。

先读取项目根的 `plugin/SKILL.md`，它是完整工作流和验收标准。执行 `node scripts/knowmap.mjs discover` 验证机器契约。自然语言意图映射如下：

- “设计主题/领域结构” → 宿主直接编写 Profile JSON，再调用 `validate-profile`
- “检查 Profile” → `validate-profile`
- “先给我看最小版本/MVP” → 宿主直接编写 MVP JSON，再调用 `validate`
- “我已确认，继续完整开发” → 宿主接续已确认 MVP 直接编写完整网络，再调用 `validate`
- “检查网络” → `validate`
- “把结果装入生成应用” → `inject`

开始时必须在 KnowMap 项目根目录之外创建全新的隔离任务目录。Profile、MVP、完整网络、审查文件和生成应用全部放入该目录，禁止写入 KnowMap 项目的 work、outputs、data 或其他子目录。除非用户已经明确确认 MVP，否则在 MVP 展示后停下等待确认。

构建内容由当前 Codex 宿主直接生成，禁止调用 `knowmap.mjs design/mvp/full`、项目 API、项目 KnowledgeGenerator 或读取/测试项目已配置的 DeepSeek/其他 Provider。13栏目是候选词表，宿主必须按任务重新选择子集；definition 必选，其他栏目只在适用时使用。API Key 仅由用户在生成应用交付后自行配置。

示例：

```text
用户：为“激光雷达感知技术”生成一个知识网络应用。
Codex：定位项目 → 在项目外新建隔离目录 → 读取完整 Skill → 直接编写 Profile → validate-profile → 直接编写 MVP → validate → 展示并等待确认。
```

插件提供任务选择和操作说明；本地命令、文件读写和模型调用仍由 Codex 的当前权限与项目配置控制。

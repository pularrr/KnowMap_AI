# FMCW 雷达基线示例

本目录是 KnowMap 通用 Skill 的独立领域示例，不是模板、插件或默认运行时依赖。

- `profiles/`：FMCW 的 TaskProfile 和提示词。
- `data/knowledge/`：节点、卡片、关系、公式与参考扩充数据。
- `app/knowledge.ts`：旧版 FMCW 可视化源数据，供基线迁移使用。
- `runtime/`：从旧内置应用迁出的 FMCW 运行时状态与恢复副本。

新主题应用只能从 `templates/app/` 和用户提供的 Profile/Network 生成；通用 Skill 不会自动读取本目录。若要将 FMCW 作为独立应用运行，应由脚手架在项目外创建新应用后，再显式注入此目录的 Profile 与数据。

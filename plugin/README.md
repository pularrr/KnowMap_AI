# KnowMap 插件

执行说明见 [SKILL.md](SKILL.md)。构建层交付新应用，运行时层在已建应用内问答和扩展图谱。

```sh
npm install
node scripts/knowmap.mjs discover
node scripts/knowmap.mjs profile-example --output work/profile.json
```

以上命令在完整项目根执行。随后按 SKILL 的七步流程设计、生成 MVP、确认、full、审查、脚手架、注入与验收。

跨 LLM 接入：导入 discovery.mjs 的 discoverKnowmap()，让具备本地工具的宿主注册返回的 name/description/inputSchema；执行映射到 scripts/knowmap.mjs 的 runKnowmap。不同平台需由宿主适配工具封装，这不是自动安装、远程 MCP 服务或所有提供商兼容声明。

构建生成与运行时使用相同 Responses provider；支持的宿主 LLM 不等于支持所有聊天 API。网络搜索不可用时会降级并保留未核验说明。Key 不写进 Profile 或脚手架。

实现限制、审查计划和验证结果见 ../docs/plugin-audit-plan.md、../docs/plugin-audit-results.md。

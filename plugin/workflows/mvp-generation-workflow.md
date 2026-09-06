# Step 2：生成 MVP 并确认方向

输入：已验证 Profile 和主题。输出：生成结果信封，含 profile、network、mode、warnings、stats。先读 [MVP 提示词](../prompts/mvp-generation-prompt.md)。

宿主 LLM 直接编写 `<隔离任务目录>/mvp.json`，结构为 `{topic,profile,network}`。不得调用 `knowmap.mjs mvp`、`/api/agent/generate` 或项目内 Provider。完成后只调用确定性校验：
```sh
node scripts/knowmap.mjs validate --input <隔离任务目录>/mvp.json --output <隔离任务目录>/mvp-validation.json
```

参考15–30节点；范围小可以更少，不能为凑数放宽粒度或启动完整研究。MVP 使用 Profile 选定的栏目，通常只填 definition 和少量能证明任务适配性的示例栏目。

展示：域划分、父子树、节点总数、2–3张示例卡、warning 和未核验来源。必须明确询问用户“是否验收当前 MVP 并继续生成完整网络”；只有用户明确表示验收后，才能写入 `mvpConfirmation.confirmed=true` 并进入 full。用户调整后修改 Profile/网络，原确认失效，必须重新校验和展示。不要在未确认时启动 full。

验证：所有节点可达根、卡片引用存在；记录 `generatedBy: "host-llm"`，不得声称执行了项目本地 ReAct、外部 Provider 或联网检索。

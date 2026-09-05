# Step 2：生成 MVP 并确认方向

输入：已验证 Profile 和主题。输出：生成结果信封，含 profile、network、mode、warnings、stats。先读 [MVP 提示词](../prompts/mvp-generation-prompt.md)。

用以下可执行 Node 命令组装请求（也可用宿主文件工具编写同样 JSON）：
```sh
node --input-type=module -e "import fs from 'node:fs'; const profile=JSON.parse(fs.readFileSync('work/profile.json','utf8')); fs.writeFileSync('work/mvp-request.json',JSON.stringify({topic:profile.name,profile}),{flag:'wx'});"
node scripts/knowmap.mjs mvp --input work/mvp-request.json --output work/mvp.json
node scripts/knowmap.mjs validate --input work/mvp.json --output work/mvp-validation.json
```

工具实际调用 KnowledgeGenerator(..., "mvp").generate() → collectAdaptiveResearch。根主题2–3轮、最多2次浅搜索、不遍历候选子节点、不启动拆分子调用、最多5分钟。重试计入调用预算。参考15–30节点；范围小可以更少，不能为凑数放宽粒度或启动完整研究。

展示：域划分、父子树、节点总数、2–3张示例卡、warning 和未核验来源。问用户方向是否合适；已有明确确认则沿用。用户调整后修改 Profile/网络，重新校验和展示。不要在未确认时启动 full。

验证：所有节点可达根、卡片引用存在、卡片为 definition；查看 stats.rounds、distributedCalls，不能用进度事件数冒充模型轮次。

如果没有可用提供商，可由具备检索能力的宿主按提示词产出同样 {topic,profile,network} 信封并校验，但要写明“宿主生成”，不得声称执行了本地 ReAct。API Key 配置失败时不得伪造在线成功。

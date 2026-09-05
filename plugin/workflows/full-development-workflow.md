# Step 3：接续确认的 MVP 完整研究

输入：work/mvp.json 与用户对该版本的明确确认。输出：work/full.json。读取 [完整开发提示词](../prompts/full-development-prompt.md)。

用户确认后才创建下一阶段输入；下面的布尔值表达已有确认，不能用来代替询问用户：
```sh
node --input-type=module -e "import fs from 'node:fs'; const m=JSON.parse(fs.readFileSync('work/mvp.json','utf8')); fs.writeFileSync('work/full-request.json',JSON.stringify({topic:m.topic,profile:m.profile,network:m.network,confirmedMvp:true}),{flag:'wx'});"
node scripts/knowmap.mjs full --input work/full-request.json --output work/full.json
node scripts/knowmap.mjs validate --input work/full.json --output work/full-validation.json
```

full 使用 initialNetwork 接续 MVP，继承当前 Profile，不重新初始化知识树。完整模式复用同一研究引擎，每个访问主题重新计算轮次；候选批量转换、合并并解析临时 ID；保存证据和卡片文本。大批缺口拆成同进程子调用，不是多机任务分发。

预算：研究最大35分钟，另有调用数和访问主题数预算；80–150是知识节点建议目标，不是截断上限。不因为时间尚未用完强行重复知识。输出 stats.stopReason 和 converged；非收敛时把缺口交付给审查阶段。

不要用 POST /api/agent/generate 跑 full：该路由的部署预算为5分钟，目前会明确拒绝 full，请使用本地命令。应用层的后台任务用于已建应用的研究，和插件生成命令是两个入口。

失败：查看控制台诊断和 data/runtime/research/<run-id>.json。批次文件保留成果，但当前不能自动重建完整执行队列；先审查恢复的网络，再从已确认网络发起新一轮 full。不要手写“已自动恢复”的状态。

# P3-7 长任务可靠性：第一阶段交付

日期：2026-09-05

## 已完成

- 新增 `JobStore` 契约和 `FileJobStore` 长驻 Node 实现，为后续数据库/对象存储实现保留替换边界。
- 任务增加 queued、running、completed、failed、cancelled、interrupted 状态；进程重启后不再把遗留 running 任务普通标成 failed，而是明确标记 interrupted，并保留已经生成的正文。
- 任务元数据、候选详情和回答正文分离。列表只返回最多 50 条的小型摘要并支持 cursor，不携带全文或候选结果。
- 增加单任务详情接口 `/api/agent/jobs/[id]` 和分段结果接口 `/api/agent/jobs/[id]/result`。结果使用 UTF-8 字节 cursor，每段最大 64 KiB，返回全文字节数和 SHA-256 checksum。
- AgentPanel 根据任务 revision 缓存正文，只有 revision 变化时重新读取全部分段；候选详情按单任务读取。用户可见回答的换行和全文不再经过列表 JSON 反复传输。
- `/api/agent/deep-search` 改为创建后台任务并返回 202、statusUrl、resultUrl，不再让一次 HTTP 请求等待完整深度研究。
- 当前应用和 `templates/app` 生成模板同步修改。

## 验证

- 大段中文、换行和 emoji 被拆成多个非等长 UTF-8 分段，重组后与原文完全相同。
- 元数据文件和任务列表不包含回答全文。
- 不同 session 无法读取彼此的结果分段。
- checksum 与完整正文一致。
- 类型检查、完整自动化测试、插件测试和 Next.js 生产构建通过；构建已注册两个新增动态路由。

## 仍需第二阶段

本阶段提高了长驻 Node 部署的可靠性和长回答交付能力，但没有外部基础设施，不能宣称 Serverless-ready。第二阶段需要选定部署提供商后实现共享 `JobStore`、持久队列和独立 Worker，并补 lease、heartbeat、幂等领取、重试及检查点恢复。文件实现检测到进程重启时会安全地标记 interrupted，不会自动续跑。

SSE `/api/agent/chat` 保留为短时兼容入口；产品界面使用后台任务接口。后续如果保留 SSE，需要增加事件存储、事件 ID 和断线续传，并让 done 事件只返回结果引用。

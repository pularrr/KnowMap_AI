# PostgreSQL 迁移第一阶段

当前阶段完成 PostgreSQL 持久化基础设施，但应用仍默认使用 JSON runtime。切换前请先在测试数据库执行迁移并核对导入结果。

## 本地执行

```powershell
$env:DATABASE_URL = "postgres://user:password@localhost:5432/fmcw_radar"
npm run db:migrate
npm run db:import-json
```

完整本地依赖可以使用：

```powershell
docker compose -f docker-compose.migration.yml up -d
Copy-Item .env.migration.example .env.local
npm run db:migrate
npm run db:import-json
npm run worker:agent
```

MinIO 控制台地址为 `http://localhost:9001`。首次使用时需创建与
`OBJECT_STORAGE_BUCKET` 同名的 bucket。

也可以指定其他 runtime 文件：

```powershell
npm run db:import-json -- data/runtime/knowledge-state.json
```

导入脚本具有幂等性：同一 revision 的基础记录和图谱实体不会重复插入。正式切换前仍需执行一次数据库到 JSON 的结构化回读校验。

## 已落地

- `db/schema.ts`：域、节点、卡片、边、公式、revision、savepoint、审计、确认 nonce、Agent job、资源和资料表。
- `runtime_states`：迁移过渡期间保存完整 runtime envelope，避免 pending changes、runs 等字段丢失。
- `db/postgres.ts`：惰性 PostgreSQL 连接池，未设置 `DATABASE_URL` 时不会影响 JSON 模式。
- `drizzle/0000_futuristic_deathbird.sql`：首个 PostgreSQL migration。
- `scripts/import-runtime-to-postgres.mjs`：将 `knowledge-state.json` 导入 PostgreSQL。

## 下一阶段

1. 实现 `PostgresRuntimeRepository`，替换 `RuntimeKnowledgeRepository` 的文件实现。
2. 将确认 patch、回滚和 savepoint 放入数据库事务。
3. 增加 Redis/BullMQ worker，替换当前进程内 Agent 任务执行。
4. 将任务长文本、上传资料和 revision 快照写入 S3/MinIO/R2。

## 队列与对象存储基础适配器

- `server/queue/agent-queue.ts` 提供 `RedisAgentQueue`，使用 `REDIS_URL` 和 `queue:agent`。
- `server/storage/object-storage.ts` 提供 S3 兼容接口，可接 AWS S3、MinIO 或 R2。
- 队列只传递 `jobId`；任务详情和最终状态仍应写 PostgreSQL，长文本写对象存储。

启动分布式模式前需要设置 `REDIS_URL`。当前 API 仍使用本地执行器，队列适配器将在下一阶段接入 `background-jobs.ts`。

当前知识、在线 Agent API 和后台任务 metadata 均支持 `RUNTIME_STORE=postgres`。
后台任务在 `AGENT_QUEUE_MODE=redis` 时走 Redis producer/worker，任务正文由
对象存储适配器保存；未配置 S3 时自动使用本地对象目录作为开发回退。
生产环境应配置 S3/MinIO/R2，而不是依赖本地回退目录。

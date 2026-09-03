# P2 在线 AI 知识图谱重构计划

## 目标

把项目从“离线图谱 + 规则候选”升级为“离线基座 + 在线 LLM 内生 Agent”。通用 LLM 在服务端获得只读图谱工具，并通过 Knowledge Agent 的观察、探索、判断、自检循环完成问答、深度搜索与资料接入；Review 负责语义二审，确定性门禁、Build、Development 和版本仓负责不可绕过的事务安全。

## 经审查后的职责边界

- **通用 LLM**：生成回答、规划下一次只读工具调用、提出候选、执行语义判断；不能访问密钥、写仓库、确认或回滚。
- **Knowledge Agent（认知入口）**：当前节点优先；ReAct 式多轮观察；同层优先 DFS；发现缺口后继续探索；形成最多两个带证据、自检结果和操作理由的候选。
- **Review Agent**：LLM 语义二审 + 确定性结构门禁。语义判断检查冲突、taxonomy、层级与关系方向；硬门禁检查 schema、环、端点、证据和 base revision。
- **Build**：无网络、无时间、无随机数的纯函数，把已通过审查的 proposal 编译为确定性 GraphPatch、diff 和运行时图谱投影。新增节点必须具有主父级、层级、视觉分支、排序和卡片；确认写入后通过既有 SVG 图形组件立即可见，不替换当前渲染方法或视觉语言。
- **Development**：持久状态机，负责预览、确认、提交、拒绝、取消和恢复；只有已消费的用户确认令牌可进入提交。
- **内容修订、保存点与审计**：`contentRevision` 在每次确认提交后单调增加；用户主动创建 `savepoint`，只保留 1 个最近保存点与 2 个历史回滚点；Agent run、proposal、review、patch 与 audit event 追加保存，不因保存点轮换删除。回滚恢复保存点内容，但产生新的 `contentRevision` 与审计事件。

## 实施顺序

1. **统一栏目与聚合 schema**：建立唯一 `CARD_SECTION_CATALOG`；补齐 node/edge/card/formula/evidence/asset/history/source 的 GraphOperation、验证、diff 与 replay，确保资料接入可完整提交。
2. **建立唯一运行时数据源**：静态图谱只作为首次启动 seed；同一 runtime repository 服务 UI、只读工具、Review、提交和导出。明确 content revision、三个用户 savepoint 与 append-only audit 的独立存储和恢复规则。
3. **先完成事务安全**：实现持久 Development 状态机、CAS/串行写、服务端签发的一次性确认令牌。令牌绑定 `patchHash + baseRevision + 会话` 并设过期时间；提交端再次执行硬门禁，失败时关闭写入。
4. **统一只读 Agent 工具**：当前节点、卡片、公式、同层优先 DFS、图内搜索、栏目覆盖、证据和资料声明共用一个工具注册表；历史只有传入明确 `historyIds` 才可读；来源内容作为不可信数据隔离。
5. **在线 Knowledge ReAct**：增加 provider-neutral 会话契约和服务端配置；首个实现支持 OpenAI Responses API 函数调用。模型决定继续观察或停止，形成结构化 proposal 并自检；默认至少完成“锚点卡片 → 同层 DFS → 子层/依赖 DFS → 自检”四次观察，最大 12 轮、48 节点、4 个外部检索、2 候选。只有满足覆盖充分或证据不足等明确停止条件才能结束；超时、畸形输出或预算耗尽均 fail-closed。
6. **独立语义 Review**：第二次独立模型运行检查冲突、taxonomy、重复实体、层级和边方向；必要时可调用只读邻域和证据工具补充审查。输出逐 operation finding 与 evidence 判断；默认至少一轮语义判断和一轮结构门禁，严重 finding 退回 Knowledge 修订。随后必须通过确定性门禁，Build 保持纯函数。
7. **UI 重构与运行时接入**：顶部新增“AI 配置”入口，仅显示已配置状态、Provider 与模型；密钥仅经服务端受控配置写入本机 `.env.local`，永不回传浏览器。删除实现说明文字；Agent 三态为 `collapsed(55px) / compact(200px) / overlay(覆盖画布但不改变 SVG 几何)`；左右栏桌面可拖，范围 220–420px 与 340–720px，支持键盘和宽度记忆，移动端禁用拖宽；卡片编辑走 `draft → diff → confirm/reject → CAS commit`，冲突保留草稿。
8. **离线知识基线分批扩展**：首轮先做栏目元数据与高价值金标准切片；随后按 domain 批次拆分复合节点并保留旧 98 个 ID/URL。每批设节点、核心卡片与证据门槛，禁止一次生成大量空模板。
9. **验收**：无 Key 可用；顶部可配置 Key；配置 Key 后普通问答调用通用 LLM；深度搜索至少多轮调用只读工具并由模型决定继续/停止；资料接入形成待审候选；新增节点在既有 SVG 图谱中保持正确层级列并立即渲染；语义错误与结构错误分别被拒绝；确认后 UI 刷新；保存点与永久审计互不影响；桌面与 390px 布局通过。

## 计划复核结论

此方案修正了两类偏差：一是在线 LLM 不再只是入口 JSON 转录器，而是 Knowledge 与语义 Review 的判断主体；二是模型不获得事务权限，避免把“内生 AI”误解为无门禁写库。深度搜索名称和行为均改为在线 LLM 驱动；本地覆盖检查只作为 Agent 可调用的观察工具，不再对用户冒充深度搜索。

第一版运行时采用单进程 JSON 仓库，并增加进程内串行队列、base revision CAS、临时文件恢复与校验；适合独立本地交付，不宣称多进程安全。接口保留仓库抽象，后续多用户部署替换为 PostgreSQL。

确认前只允许生成 patch 和 diff，不存在“确认写草稿”的旁路。卡片编辑的本地 draft 不是正式知识；确认后才写 runtime snapshot 并增加 content revision。用户可在任意已确认内容修订上另行建立 savepoint。

## 图谱列语义（新增硬约束）

当前 SVG 布局保留，但 `arrange` 的列坐标不再由“可见投影顺序”决定，而只由主树层级决定：第 N 层始终位于第 N 列。展开节点只在下一列展开其**直接子节点**；与父节点同层的节点始终留在父节点所在列。相似、替代、输入输出、依赖等语义边只能连线，不得改变节点列。Build 对新增节点缺少 `primaryParentId / level / visualBranch / order` 或父级不存在时直接拒绝。

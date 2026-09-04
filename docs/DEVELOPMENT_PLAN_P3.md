# P3 开发交付记录（FMCW 雷达知识图谱）

> 提交基线：`36fa296`（LaTeX 修复 + 资料整理 + 提示词优化）
> 本文件记录 P3 阶段功能开发、验收方式与验证结果。

## 一、P3 需求回顾

用户验收诉求：

1. **对话/摘要接入**：用户提供一段与其他 LLM 的对话或对话摘要，应用 agent 可调用知识检索 agent 或审查 agent，提取对话中的信息是否与当前知识图谱匹配，可将对话知识作为新节点或知识点更新当前图谱。
2. **文献方案接入**：用户提供最新文献方案，通用 agent 提取方案的关键设计给知识检索 agent，作为方法的一种将其摘要作为新的知识点插入当前知识图谱。
3. **来源类型化**：区分文档 / 对话记录 / 知识摘要 / 文献技术方案等来源。
4. **多模态适配**：用户明确 P3-4 **不需要支持语音、视频**，只需图片与 PDF。

## 二、P3-1 / P3-2（已在 `36fa296` 完成）

- **来源类型化入口**：AgentPanel 新增资料类型选择器（文档 / 对话记录 / 知识摘要 / 文献技术方案），`kind` 随请求下发。
- **来源专用提取提示词**：`INGEST_PROMPTS` 四种策略（conversation / summary / paper / document）在 `app/api/knowledge/ingest/route.ts` 中按 kind 选用。

## 三、P3-3 匹配判定增强（本提交）

**新增 `server/agent/claim-matcher.ts`**：`matchClaimsToGraph()` 三阶段流水线，替代 `stageTextImport` 中"命中 nodeHint 就 append-card"的硬编码规则：

1. **检索规划**：LLM 输出 JSON 字符串数组（最多 5 个检索词），覆盖声明核心实体；
2. **图谱检索**：用 `executeKnowledgeTool(dataset, "search_graph", ...)` 在**真实图谱**上执行检索（只读），收集命中结果；
3. **最终判定**：把检索结果反馈给模型，输出每条声明的落地决策：
   - `append-card`：图谱已有节点，声明是补充，续写知识卡；
   - `create-node`：图谱无对应节点，需新建；
   - `create-relation`：声明表达两个已有节点间关系；
   - `needs-review`：证据不足。
4. **fail-open**：任一步失败回退 `staged.matches`，不阻断 ingest。

**接线**：
- `app/api/knowledge/ingest/route.ts`：LLM 已配置时调用 `matchClaimsToGraph` 增强 `matches`，响应新增 `matchDecisions` 字段；
- `server/agent/online-agent-service.ts`：deepSearch 最终提案提示词注入 `matchContext`（资料-图谱匹配判定 JSON），并明确指导 `append-card→cardBlocks`、`create-node→newNodes`、`create-relation→关系表达`。

**验证结果（真实图谱 + deepseek-v4-flash-vision-exp）**：
- 输入"距离分辨率 ΔR=c/2B…"→ `matchDecisions` 返回 `[{"decision":"append-card","matchedNodeId":"range-resolution","score":0.7}]`，正确识别已有节点而非重复建点；
- 输入"FMCW Radar Test / ΔR=c/(2B) / MIMO 虚拟阵列测角 / CFAR"→ 三条判定分别为 `needs-review(0.1)`（标题）、`append-card→range-resolution(0.98)`（公式）、`create-node(0.7)`（虚拟阵列），decision 分布合理；
- deepSearch 端到端多轮工具调用（12 轮），模型对重复内容主动拒绝扩写（防知识碎片化），识别真正的知识缺口。

## 四、P3-4 多模态解析适配器（本提交）

**范围**：图片（OCR）+ PDF（文本层 / 扫描件 OCR）。**明确不含**语音、视频。

**新增 `core/ingestion/adapters.ts`**：
- `extractImage()`：`tesseract.js` OCR（chi_sim+eng，懒加载 + 单例 worker）；
- `extractPdf()`：`pdfjs-dist/legacy` 提取文本层；无文本层（扫描件）时逐页 `@napi-rs/canvas` 渲染为 PNG 再 OCR（页数上限 8 防超时）；
- 产出统一 `{artifact, segments, notes}`，与 `stageTextImport` 管线无缝衔接；
- `supportsFile()` / `extractFile()` 按 MIME 路由。

**新增 `app/api/knowledge/ingest-file/route.ts`**：`POST /api/knowledge/ingest-file`（multipart），20MB 上限，流程：
解析 → `stageTextImport` → P3-3 `matchClaimsToGraph` → deepSearch → 返回候选 + `matchDecisions` + `parsedNotes`。

**前端**：AgentPanel 新增"上传资料"按钮（`.pdf,image/png,image/jpeg,image/webp`），复用 `ingestKind` 选择器。

**基建**：
- `next.config.ts` 增加 `serverExternalPackages`：`pdfjs-dist`、`pdf-parse`、`tesseract.js`、`@napi-rs/canvas`（webpack 不打进 bundle，Node 运行时直接从 node_modules 加载，避免 worker/chunks 路径解析失败）；
- `.gitignore` 忽略 `*.traineddata`（OCR 语言包，首次使用时下载）、本地测试产物。

**验证结果**：
- PDF（含文本层，1 页）→ `parsedNotes:["共 1 页"]`，解析出 2 条声明，模型正确判断已被 `range-resolution`、`mimo`/`virtual-array` 覆盖，拒绝重复扩充；
- 图片（英文文字截图）→ `parsedNotes:["OCR 识别（中英文）"]`，解析出 3 条声明并完成匹配判定；
- `npm test` 全通过；`tsc --noEmit` 通过；`npm run build` 成功（`/api/knowledge/ingest-file` 已注册）；
- UI 渲染确认"上传资料"按钮与资料类型选择器正常显示，KaTeX 样式已加载。

## 五、验收方式（用户可直接操作）

1. 启动 dev：`npm run dev` → `http://localhost:3000`；
2. **文本接入**：在 Agent 区粘贴资料 → 选类型 → 点"整理资料"，观察候选与匹配判定；
3. **文件接入**：点"上传资料"选择 PDF 或图片 → 等待解析与深度搜索 → 在"历史修改"标签查看待确认变更；
4. **确认写入**：对生成的补丁执行确认 → 图谱与知识卡持久化更新。

## 六、已知边界

- 扫描 PDF 逐页 OCR 限制前 8 页，超大扫描件可能截断；
- OCR 依赖网络首次下载语言包（chi_sim+eng，约 20MB），离线环境需预置；
- `deepSearch` 单次全链路（匹配判定 2 轮 LLM + 深度搜索多轮工具）耗时较长（分钟级），超时需调大请求端超时。

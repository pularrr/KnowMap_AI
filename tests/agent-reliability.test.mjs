import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({ appType: "custom", configFile: false, root, resolve: { alias: { "@": root } }, server: { middlewareMode: true, hmr: false } });
after(() => vite.close());
const adaptive = await vite.ssrLoadModule("/server/agent/adaptive-research.ts");
const output = await vite.ssrLoadModule("/server/agent/research-output.ts");
const researchBuild = await vite.ssrLoadModule("/server/agent/research-build.ts");
const intake = await vite.ssrLoadModule("/core/ingestion/offline-intake.ts");
const onlineAgent = await vite.ssrLoadModule("/server/agent/online-agent-service.ts");
const backgroundJobs = await vite.ssrLoadModule("/server/agent/background-jobs.ts");
const analysisPolicy = await vite.ssrLoadModule("/core/agent/node-analysis-policy.ts");
const { neutralDataset } = await vite.ssrLoadModule("/tests/fixtures/neutral-network.ts");
const response = (text) => ({ id: "mock", provider: "test", model: "test", status: "completed", text, toolCalls: [], session: { previousResponseId: "mock" } });

test("research output retains only complete items after truncation", async () => {
  const text = '{"proposal":{"newNodes":[{"id":"complete","canonicalName":"完整概念","shortFact":"完整定义","nodeRole":"entity","nodeType":"concept","parentId":"core","blocks":[]},{"canonicalName":"broken';
  const result = await output.requestResearch({ name: "mock", createResponse: async () => ({ ...response(text), status: "incomplete", incompleteReason: "max_output_tokens" }) }, "", [{ role: "user", content: "test" }]);
  assert.equal(result.document.proposal.newNodes.length, 1);
  assert.equal(result.document.converged, false);
});

test("summary retries shrink the output scope after a reasoning-only truncation", async () => {
  const requests = [];
  const provider = { name: "mock", limits: { maxOutputTokens: 16384, maxInputChars: 120000 }, async createResponse(request) {
    requests.push(request);
    if (requests.length === 1) return { ...response(""), status: "incomplete", incompleteReason: "max_output_tokens", usage: { inputTokens: 1, outputTokens: 8192, reasoningTokens: 8192, totalTokens: 8193 } };
    return response(JSON.stringify({ answer: "已补充", converged: false, gaps: ["其余内容"], proposal: { newNodes: [], cardBlocks: [{ nodeId: "root", type: "definition", title: "补充", text: "完整条目" }], relations: [], evidence: [] } }));
  }};
  const result = await output.requestResearch(provider, "整理当前对话", [{ role: "user", content: "资料" }], { purpose: "summary" });
  assert.equal(result.document.proposal.cardBlocks.length, 1);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].maxOutputTokens, 8192);
  assert.equal(requests[1].maxOutputTokens, 12288);
  assert.match(requests[1].instructions, /最多 1 个新节点、2 个独立卡片补充/);
});

test("identical imported paragraphs never produce duplicate claim operations", () => {
  const staged = intake.stageTextImport({
    kind: "conversation",
    title: "重复段落",
    text: "同一条可核验的资料段落。\n\n同一条可核验的资料段落。",
    currentNodeId: "root",
    suppliedBy: "test",
  });
  const proposal = researchBuild.operationsFromResearch({
    answer: "",
    converged: false,
    gaps: [],
    proposal: { summary: "", rationale: "", newNodes: [], cardBlocks: [], relations: [], evidence: [] },
  }, neutralDataset, "root", staged);
  const claimIds = proposal.operations
    .filter((operation) => operation.kind === "upsert-claim")
    .map((operation) => operation.claim.id);
  assert.equal(claimIds.length, new Set(claimIds).size);
});

test("summary de-duplication context contains only directory, target route, and peer layer", () => {
  const dataset = structuredClone(neutralDataset);
  dataset.nodes.push({ ...dataset.nodes[2], id: "peer", canonicalName: "同层概念", primaryParentId: "core", level: 2 });
  dataset.nodes.push({ ...dataset.nodes[2], id: "elsewhere", canonicalName: "无关概念", primaryParentId: "root", level: 1 });
  const index = onlineAgent.summaryDedupGraphIndex(dataset, "item");
  assert.deepEqual(index.ancestorChain.map((node) => node.id), ["root", "core", "item"]);
  assert.deepEqual(index.currentLayer.map((node) => node.id).sort(), ["item", "peer"]);
  assert.equal(index.directory.navigationNodes.some((node) => node.id === "elsewhere"), false);
  assert.equal(index.currentLayer.some((node) => node.id === "elsewhere"), false);
});

test("cancellation is persisted even when the cancelling process has no local controller", async () => {
  const records = new Map();
  const store = {
    async save(job, text) { records.set(job.id, { job: structuredClone(job), text }); },
    async load(id) { const value = records.get(id); return value && { job: structuredClone(value.job), text: value.text }; },
    async list(sessionId) { return [...records.values()].filter((value) => value.job.sessionId === sessionId).map((value) => structuredClone(value.job)); },
    async readText() { throw new Error("not used"); },
  };
  globalThis.__agentJobStore = store;
  const id = "11111111-1111-4111-8111-111111111111";
  await store.save({ id, sessionId: "session", nodeId: "root", kind: "chat", query: "x", state: "running", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), textBytes: 0, textChecksum: "", revision: 0, retryCount: 0 }, "");
  await backgroundJobs.cancelAgentJob(id, "session");
  assert.equal((await store.load(id)).job.state, "cancelled");
  assert.match((await store.load(id)).job.progress, /停止/);
  delete globalThis.__agentJobStore;
});

test("every node starts with baseline analysis before skeleton and gap guidance", () => {
  assert.equal(analysisPolicy.nodeAnalysisStage(0, 2, true), "baseline");
  assert.equal(analysisPolicy.nodeAnalysisStage(1, 2, true), "skeleton");
  assert.equal(analysisPolicy.nodeAnalysisStage(2, 2, true), "skeleton");
  assert.equal(analysisPolicy.nodeAnalysisStage(3, 2, true), "gap");
  assert.equal(analysisPolicy.nodeAnalysisStage(1, 2, false), "gap");
  assert.match(analysisPolicy.nodeAnalysisStagePrompt("gap", ["实现链路不清晰"]), /饱满答案/);
});

test("budget exhaustion is persisted as a resumable state, never convergence", async () => {
  const runId = `neutral-${Date.now()}`;
  const provider = { name: "mock", async createResponse(request) {
    if (request.tools?.length) return response("source");
    return response(JSON.stringify({ answer: "继续", converged: false, gaps: ["待补证据"], proposal: { newNodes: [], cardBlocks: [], relations: [], evidence: [] } }));
  }};
  const result = await adaptive.collectAdaptiveResearch({ provider, dataset: neutralDataset, nodeId: "root", query: "中立测试", runId, root: false, observations: [], maxExternalSearches: 0, budgetOverride: { minRounds: 1, initialRounds: 1, maxCalls: 1, maxNodes: 2, skeletonRounds: 0 } });
  assert.equal(result.converged, false);
  const checkpoint = adaptive.loadResearchCheckpoint(runId);
  assert.equal(checkpoint.completionState, "budget_exhausted");
  assert.ok(["max_model_calls", "max_duration"].includes(checkpoint.stopReason));
  assert.ok(checkpoint.unresolvedGaps.includes("待补证据"));
  const batchPath = join(root, "data", "runtime", "research", runId, "batches", "000001.json");
  assert.equal(existsSync(batchPath), true);
  assert.equal(JSON.parse(readFileSync(batchPath, "utf8")).answer, "继续");
});

test("entity granularity warnings do not apply to navigation or category nodes", async () => {
  const { validateKnowledgeDataset } = await vite.ssrLoadModule("/core/knowledge/validation.ts");
  const dataset = structuredClone(neutralDataset);
  dataset.nodes.find((node) => node.id === "core").canonicalName = "概念与方法";
  dataset.nodes.find((node) => node.id === "item").canonicalName = "概念与方法";
  const report = validateKnowledgeDataset(dataset, { domainCount: 1, visualBranchCount: 1 });
  assert.equal(report.warnings.some((issue) => issue.entityId === "core" && issue.code === "MULTI_CONCEPT_NODE"), false);
  assert.equal(report.warnings.some((issue) => issue.entityId === "item" && issue.code === "MULTI_CONCEPT_NODE"), true);
});

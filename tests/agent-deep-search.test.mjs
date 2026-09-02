import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, hmr: false },
});

after(async () => vite.close());
const search = await vite.ssrLoadModule("/features/agent/model/offlineDeepSearch.ts");

test("deep search anchors coverage analysis to the current node", () => {
  const report = search.runOfflineDeepSearch("gnn");
  assert.equal(report.nodeId, "gnn");
  assert.match(report.title, /GNN/);
  assert.ok(report.coverage.total >= 10);
  assert.ok(report.coverage.missing.length > 0);
  assert.ok(report.candidates.some((candidate) => candidate.nodeId === "jpda"));
  assert.ok(report.recommendations.some((item) => /Review Agent/.test(item)));
});

test("deep search is bounded and creates review-only candidates", () => {
  const report = search.runOfflineDeepSearch("fmcw");
  assert.ok(report.candidates.length <= 15);
  assert.match(report.proposalSummary, /待审查构建候选/);
  assert.throws(() => search.runOfflineDeepSearch("missing-node"), /Unknown knowledge node/);
});

test("offline answers use the current card before graph expansion", () => {
  const answer = search.answerFromCurrentKnowledge("least-squares", "目标");
  assert.match(answer, /LS|最小二乘/);
  assert.match(answer, /残差|平方/);
});

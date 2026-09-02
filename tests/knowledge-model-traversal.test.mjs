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

const { expandedKnowledgeDataset } = await vite.ssrLoadModule("/data/knowledge/deep-slices.ts");
const { getLocalGraph, projectVisibleGraph } = await vite.ssrLoadModule("/core/knowledge/traversal.ts");

test("peer-first traversal ranks explicit alternatives before implicit siblings and dependencies", () => {
  const local = getLocalGraph(expandedKnowledgeDataset, "gnn", { maxDepth: 1, maxNodes: 20 });
  assert.deepEqual(local.visits[0], { nodeId: "gnn", depth: 0, reason: "anchor" });
  assert.equal(local.visits.find((visit) => visit.nodeId === "jpda").reason, "alternative");
  assert.equal(local.visits.find((visit) => visit.nodeId === "hungarian-algorithm").reason, "sibling");
  assert.equal(local.visits.find((visit) => visit.nodeId === "statistical-gating").reason, "prerequisite");
  const rank = { similar: 0, alternative: 1, sibling: 2, child: 3, prerequisite: 4, dependent: 4, dependency: 4, input: 5, downstream: 5, output: 5, producer: 5 };
  const priorities = local.visits.slice(1).map((visit) => rank[visit.reason]);
  assert.deepEqual(priorities, [...priorities].sort((a, b) => a - b));
});

test("bounded traversal is deterministic, deduplicated and cycle-safe", () => {
  const first = getLocalGraph(expandedKnowledgeDataset, "jpda", { maxDepth: 8, maxNodes: 7 });
  const second = getLocalGraph(expandedKnowledgeDataset, "jpda", { maxDepth: 8, maxNodes: 7 });
  assert.deepEqual(first.visits, second.visits);
  assert.ok(first.nodes.length <= 7);
  assert.equal(new Set(first.nodes.map((node) => node.id)).size, first.nodes.length);
  assert.equal(first.truncated, true);
});

test("VisibleGraphProjection preserves the current three-column contract", () => {
  const projection = projectVisibleGraph(expandedKnowledgeDataset, "gnn", { maxDepth: 1, maxNodes: 12 });
  assert.equal(projection.anchor.id, "gnn");
  assert.deepEqual(projection.previous.map((node) => node.id), ["deterministic-assignment"]);
  assert.equal(projection.next[0].id, "jpda");
  assert.equal(projection.next[0].nodeType, "algorithm");
  assert.equal(new Set(projection.nodes.map((node) => node.id)).size, projection.nodes.length);
});

test("unknown anchors fail explicitly", () => {
  assert.throws(() => getLocalGraph(expandedKnowledgeDataset, "missing-node"), /Unknown knowledge node/);
});

test("directed dependency and input-output traversal preserves semantic direction", () => {
  const fromGnn = getLocalGraph(expandedKnowledgeDataset, "gnn", { maxDepth: 1, maxNodes: 20 });
  assert.equal(fromGnn.visits.find((visit) => visit.nodeId === "statistical-gating").reason, "prerequisite");
  const fromGate = getLocalGraph(expandedKnowledgeDataset, "statistical-gating", { maxDepth: 1, maxNodes: 20 });
  assert.equal(fromGate.visits.find((visit) => visit.nodeId === "gnn").reason, "dependent");
  const fromInnovation = getLocalGraph(expandedKnowledgeDataset, "innovation", { maxDepth: 1, maxNodes: 20 });
  assert.equal(fromInnovation.visits.find((visit) => visit.nodeId === "mahalanobis-gate").reason, "downstream");
  const fromMahalanobis = getLocalGraph(expandedKnowledgeDataset, "mahalanobis-gate", { maxDepth: 1, maxNodes: 20 });
  assert.equal(fromMahalanobis.visits.find((visit) => visit.nodeId === "innovation").reason, "input");
});

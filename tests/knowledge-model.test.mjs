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

const legacySource = await vite.ssrLoadModule("/app/knowledge.ts");
const migration = await vite.ssrLoadModule("/data/knowledge/legacy-migration.ts");
const slices = await vite.ssrLoadModule("/data/knowledge/deep-slices.ts");
const { validateKnowledgeDataset } = await vite.ssrLoadModule("/core/knowledge/validation.ts");
const { StaticKnowledgeRepository } = await vite.ssrLoadModule("/data/repositories/static-knowledge-repository.ts");

test("legacy migration is lossless for all 98 ordered nodes and cross links", () => {
  const { legacyKnowledgeDataset, toLegacyKnowledgeNodes, toLegacyCrossLinks } = migration;
  assert.equal(legacyKnowledgeDataset.nodes.length, 98);
  assert.deepEqual(toLegacyKnowledgeNodes(legacyKnowledgeDataset), legacySource.knowledgeNodes);
  assert.deepEqual(toLegacyCrossLinks(legacyKnowledgeDataset), legacySource.crossLinks);
  assert.deepEqual(
    legacyKnowledgeDataset.nodes.map((node) => node.id),
    legacySource.knowledgeNodes.map((node) => node.id),
  );
  assert.deepEqual(
    legacyKnowledgeDataset.nodes.map((node) => node.primaryParentId ?? undefined),
    legacySource.knowledgeNodes.map((node) => node.parent),
  );
});

test("migration separates nodes, cards and structured formulas without losing copy", () => {
  const { legacyKnowledgeDataset } = migration;
  assert.equal(legacyKnowledgeDataset.cards.length, 98);
  assert.equal(
    legacyKnowledgeDataset.formulas.length,
    legacySource.knowledgeNodes.filter((node) => node.formula).length,
  );
  for (const formula of legacyKnowledgeDataset.formulas) {
    assert.ok(formula.latex);
    assert.ok(formula.sourceText);
    assert.ok(formula.symbols.length > 0);
  }
  assert.equal(legacyKnowledgeDataset.domains.length, 11);
  assert.equal(new Set(legacyKnowledgeDataset.domains.map((domain) => domain.visualBranch)).size, 5);
});

test("legacy and expanded datasets satisfy the knowledge validator", () => {
  for (const dataset of [migration.legacyKnowledgeDataset, slices.expandedKnowledgeDataset]) {
    const report = validateKnowledgeDataset(dataset);
    assert.deepEqual(report.errors, [], report.errors.map((issue) => issue.message).join("\n"));
    assert.equal(report.valid, true);
  }
});

test("the independent seed patch adds 16 entities and corrects the two target hierarchies", () => {
  const dataset = slices.expandedKnowledgeDataset;
  const byId = new Map(dataset.nodes.map((node) => [node.id, node]));
  assert.equal(slices.estimationAssociationSeedPatch.addNodes.length, 16);
  assert.equal(dataset.nodes.length, 114);
  assert.equal(byId.get("least-squares").primaryParentId, "estimators");
  assert.equal(byId.get("maximum-likelihood").primaryParentId, "estimators");
  assert.equal(byId.get("map-estimation").primaryParentId, "estimators");
  assert.equal(byId.get("mmse-estimation").primaryParentId, "estimators");
  assert.equal(byId.get("mahalanobis-gate").primaryParentId, "statistical-gating");
  assert.equal(byId.get("gnn").primaryParentId, "deterministic-assignment");
  assert.equal(byId.get("jpda").primaryParentId, "probabilistic-association");
  assert.ok(dataset.edges.some((edge) => edge.type === "ALTERNATIVE_TO" && edge.sourceId === "gnn" && edge.targetId === "jpda"));
  assert.ok(dataset.edges.some((edge) => edge.type === "INPUT_TO" && edge.sourceId === "mahalanobis-gate" && edge.targetId === "statistical-gating"));
  assert.deepEqual(migration.toLegacyKnowledgeNodes(dataset), legacySource.knowledgeNodes);
});

test("GNN aliases remain explicitly disambiguated", () => {
  const byId = new Map(slices.expandedKnowledgeDataset.nodes.map((node) => [node.id, node]));
  assert.ok(byId.get("gnn").aliases.includes("Global Nearest Neighbor"));
  assert.ok(byId.get("gnn-association").aliases.includes("Graph Neural Network"));
});

test("StaticKnowledgeRepository returns defensive snapshots and stable children", () => {
  const repository = new StaticKnowledgeRepository(slices.expandedKnowledgeDataset);
  const snapshot = repository.getSnapshot();
  snapshot.nodes[0].canonicalName = "mutated";
  assert.notEqual(repository.getNode(snapshot.nodes[0].id).canonicalName, "mutated");
  assert.deepEqual(
    repository.getChildren("estimators").map((node) => node.id),
    ["least-squares", "maximum-likelihood", "map-estimation", "mmse-estimation"],
  );
});

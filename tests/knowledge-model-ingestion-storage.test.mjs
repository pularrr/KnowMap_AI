import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
const temporary = mkdtempSync(join(tmpdir(), "fmcw-version-test-"));
after(async () => {
  await vite.close();
  rmSync(temporary, { recursive: true, force: true });
});

const ingestion = await vite.ssrLoadModule("/core/ingestion/index.ts");
const agent = await vite.ssrLoadModule("/core/agent/index.ts");
const knowledge = await vite.ssrLoadModule("/core/knowledge/index.ts");
const data = await vite.ssrLoadModule("/data/knowledge/deep-slices.ts");
const versions = await vite.ssrLoadModule("/server/knowledge/index.ts");
const runtime = await vite.ssrLoadModule("/server/runtime/index.ts");
const security = await vite.ssrLoadModule("/server/security/index.ts");

test("conversation and paper text become traceable review candidates", () => {
  const conversation = ingestion.stageTextImport({
    kind: "conversation",
    title: "与其他 LLM 的讨论摘要",
    text: "JPDA 对联合关联事件边缘化。\n\n工程上需要先门控以限制组合数量。",
    suppliedBy: "user",
    currentNodeId: "jpda",
    suppliedAt: "2026-09-02T00:00:00.000Z",
  });
  assert.equal(conversation.status, "awaiting-agent-review");
  assert.equal(conversation.claims.length, 2);
  assert.ok(conversation.claims.every((claim) => claim.segmentIds.length === 1));
  assert.ok(conversation.matches.every((match) => match.matchedNodeId === "jpda"));
  assert.ok(conversation.claims.some((claim) => claim.suggestedCollection === "application"));

  const paper = ingestion.stageTextImport({
    kind: "paper",
    title: "最新方案",
    text: "最新研究提出一种探索性的稀疏关联近似。",
    suppliedBy: "user",
  });
  assert.equal(paper.claims[0].suggestedCollection, "other");
});

test("media artifacts store references instead of binary payloads", () => {
  const artifact = ingestion.createExternalMediaArtifact({
    kind: "image",
    title: "处理流程图",
    mimeType: "image/png",
    storageRef: "assets/sha256/example.png",
    checksum: "sha256:abc",
    suppliedBy: "user",
  });
  assert.equal(artifact.modality, "image");
  assert.equal(artifact.storageRef, "assets/sha256/example.png");
  assert.equal("data" in artifact, false);
});

test("portable knowledge bundles round-trip and reject tampering", () => {
  const bundle = knowledge.createPortableKnowledgeBundle(data.expandedKnowledgeDataset, "2026-09-02T00:00:00.000Z");
  const serialized = knowledge.serializeKnowledgeBundle(bundle);
  const restored = knowledge.parseKnowledgeBundle(serialized);
  assert.equal(restored.dataset.nodes.length, data.expandedKnowledgeDataset.nodes.length);
  const tampered = JSON.parse(serialized);
  tampered.dataset.nodes[0].canonicalName = "tampered";
  assert.throws(() => knowledge.parseKnowledgeBundle(JSON.stringify(tampered)), /checksum mismatch/);
});

test("the general LLM cannot mutate or confirm graph changes", () => {
  assert.equal(agent.actorCan("general-llm", "answer"), true);
  assert.equal(agent.actorCan("general-llm", "commit-confirmed"), false);
  assert.equal(agent.actorCan("development-agent", "commit-confirmed"), true);
});

test("versions are user-saved and retain one recent plus two historical checkpoints", () => {
  const file = join(temporary, "knowledge-revisions.json");
  const repository = new versions.JsonKnowledgeRevisionRepository(file, data.expandedKnowledgeDataset);
  const store = new versions.VersionedKnowledgeStore(repository);
  assert.throws(
    () => store.saveVersion(store.snapshot(), 2, "not confirmed", { confirmed: true, confirmedBy: "" }),
    /confirmation is required/,
  );
  for (let expected = 3; expected <= 6; expected += 1) {
    store.saveVersion(store.snapshot(), expected - 1, `用户保存版本 ${expected}`, {
      confirmed: true,
      confirmedBy: "user",
      confirmedAt: `2026-09-02T00:00:0${expected}.000Z`,
    });
  }
  assert.deepEqual(store.history().map((item) => item.revision), [4, 5, 6]);
  assert.deepEqual(store.rollbackTargets().map((item) => item.revision), [5, 4]);
  assert.throws(
    () => store.rollback(3, { confirmed: true, confirmedBy: "user" }),
    /two available historical versions/,
  );
  const rolledBack = store.rollback(4, { confirmed: true, confirmedBy: "user", confirmedAt: "2026-09-02T00:00:07.000Z" });
  assert.equal(rolledBack.revision, 7);
  assert.equal(rolledBack.restoredFromRevision, 4);
  assert.deepEqual(store.history().map((item) => item.revision), [5, 6, 7]);
  assert.equal(JSON.parse(readFileSync(file, "utf8")).records.length, 3);
  const reopened = new versions.VersionedKnowledgeStore(new versions.JsonKnowledgeRevisionRepository(file));
  assert.equal(reopened.snapshot().revision, 7);
});

test("the runtime repository is the single CAS snapshot and keeps audit beyond savepoint pruning", async () => {
  const file = join(temporary, "runtime-knowledge.json");
  const store = new runtime.RuntimeKnowledgeRepository(file, data.expandedKnowledgeDataset);
  const makePatch = (baseRevision, index) => ({
    id: `runtime-patch-${index}`,
    proposalId: `proposal-${index}`,
    baseRevision,
    summary: `Update FMCW card ${index}`,
    rationale: "Test confirmed runtime write.",
    evidence: [{ id: `fixture-${index}`, title: "Fixture", source: "test" }],
    operations: [{
      kind: "upsert-card",
      card: {
        ...store.snapshot().cards.find((card) => card.nodeId === "fmcw"),
        headline: `Runtime headline ${index}`,
        revision: baseRevision + 1,
      },
    }],
    projectionDiff: {
      nodes: { added: [], updated: [], removed: [] }, edges: { added: [], updated: [], removed: [] },
      cards: { added: [], updated: ["fmcw"], removed: [] }, formulas: { added: [], updated: [], removed: [] },
      evidence: { added: [], updated: [], removed: [] }, assets: { added: [], updated: [], removed: [] },
      sources: { added: [], updated: [], removed: [] }, claims: { added: [], updated: [], removed: [] },
      history: { added: [], updated: [], removed: [] }, visibleNodeIds: ["fmcw"],
    },
    builtBy: "build-agent",
  });
  const tokens = new security.ConfirmationTokenService("test-confirmation-secret-32-bytes-minimum", 60_000);
  const firstPatch = makePatch(2, 1);
  const issued = tokens.issue(firstPatch, "session-1", 1_000);
  const proof = tokens.verify(issued.token, firstPatch, "session-1", 1_001);
  await assert.rejects(() => store.applyConfirmedPatch(firstPatch, { ...proof }, "user"), /verified server confirmation/);
  const first = await store.applyConfirmedPatch(firstPatch, proof, "user");
  assert.equal(first.dataset.revision, 3);
  const stalePatch = makePatch(2, 2);
  const staleIssued = tokens.issue(stalePatch, "session-1", 1_000);
  const staleProof = tokens.verify(staleIssued.token, stalePatch, "session-1", 1_001);
  await assert.rejects(() => store.applyConfirmedPatch(stalePatch, staleProof, "user"), /Stale patch/);
  for (let index = 0; index < 4; index += 1) await store.createSavepoint(`保存点 ${index}`, "user");
  const state = store.state();
  assert.equal(state.savepoints.length, 3);
  assert.ok(state.audit.length > state.savepoints.length);
  assert.equal(store.rollbackTargets().length, 2);
  const reopened = new runtime.RuntimeKnowledgeRepository(file, data.expandedKnowledgeDataset);
  assert.equal(reopened.snapshot().cards.find((card) => card.nodeId === "fmcw").headline, "Runtime headline 1");
});

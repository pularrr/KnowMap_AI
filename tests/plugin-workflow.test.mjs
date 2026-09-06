import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { withProjectModules } from "../scripts/lib/project-modules.mjs";
import { discoverKnowmap } from "../plugin/discovery.mjs";
import { runKnowmap } from "../scripts/knowmap.mjs";
import { createApp } from "../scripts/create-app.mjs";

test("discovery exposes an executable host-neutral contract", () => {
  const d = discoverKnowmap();
  assert.equal(d.inputSchema.properties.action.enum.includes("full"), false);
  assert.ok(d.inputSchema.properties.action.enum.includes("inject"));
  assert.equal(d.inputSchema.additionalProperties, false);
  assert.match(d.hostResponsibilities.join(" "), /宿主 LLM/);
});

test("build-time provider actions are rejected before reading project configuration", async () => {
  await assert.rejects(runKnowmap({ action:"full", input:"missing.json", output:"missing-output.json" }), /禁止调用项目内已配置/);
});

test("full validation requires explicit MVP acceptance", async () => {
  const directory = mkdtempSync(join(tmpdir(), "knowmap-mvp-gate-"));
  try {
    const input = join(directory, "full.json"), output = join(directory, "validation.json");
    writeFileSync(input, JSON.stringify({ phase: "full", profile: {}, network: {} }));
    await assert.rejects(runKnowmap({ action: "validate", input, output }), /先完成并验收 MVP/);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("generated app template derives the title and browser storage keys from APP_CONFIG", () => {
  const page = readFileSync(join(process.cwd(), "templates", "app", "app", "page.tsx"), "utf8");
  const canvas = readFileSync(join(process.cwd(), "templates", "app", "features", "knowledge-graph", "components", "KnowledgeGraphCanvas.tsx"), "utf8");
  assert.match(page, /APP_CONFIG\.appName/);
  assert.doesNotMatch(page, /<h1>FMCW/);
  assert.match(page, /APP_CONFIG\.storagePrefix/);
  assert.doesNotMatch(canvas, /aria-label="渐进披露式 FMCW/);
});

test("generated applications cannot be placed inside the KnowMap skill project", async () => {
  await assert.rejects(createApp({ profile:"fmcw-radar", name:"forbidden-inside", output:join(process.cwd(), "work", "forbidden-inside") }), /项目根目录之外/);
});

test("non-FMCW generation preserves hierarchy, cards, evidence and the MVP boundary", async () => {
  await withProjectModules(async load => {
    const { LIDAR_TECH_ROUTE_PROFILE: profile } = await load("/plugin/examples/lidar-profile-example.ts");
    const { validateProfile } = await load("/server/profile/validate-profile.ts");
    const { KnowledgeGenerator } = await load("/server/agent/knowledge-generator.ts");
    const { networkToDataset } = await load("/server/agent/network-dataset.ts");
    const { RuntimeKnowledgeRepository } = await load("/server/runtime/runtime-repository.ts");
    validateProfile(profile);
    assert.doesNotThrow(() => validateProfile({ ...profile, hierarchy:{ enabled:false, intermediateNodeTypes:[] } }));
    assert.throws(() => validateProfile({ ...profile, hierarchy:{ enabled:true, intermediateNodeTypes:["module"] } }), /hierarchy/);
    assert.throws(() => validateProfile({ ...profile, domains: [] }));
    let calls = 0, searches = 0;
    const response = text => ({ id: "mock", provider: "test", model: "test", status: "completed", text, toolCalls: [], session: {} });
    const provider = { name: "test", createResponse: async request => {
      if (request.tools?.length) { searches++; return response("测试来源，非真实联网检索"); }
      calls++;
      const document = { answer: "测试结果", converged: false, gaps: ["仍需核验"], proposal: {
        newNodes: [{ id: "tof", canonicalName: "飞行时间测距", shortFact: "通过光的往返时间估算目标距离。", nodeType: "method", parentId: "lidar-principle", blocks: [
          { type: "definition", title: "定义与边界", text: "根据光的传播时间测量距离。" },
          { type: "principle", title: "原理", text: "$R=c t/2$" }] }],
        cardBlocks: [{ nodeId: "tof", type: "definition", title: "适用范围", text: "目标距离测量。" }],
        relations: [{ sourceId: "tof", targetId: "lidar-principle", type: "PART_OF", rationale: "测距原理的一部分。" }],
        evidence: [{ title: "测试来源", url: "https://example.com/test" }],
      } };
      assert.doesNotThrow(() => JSON.parse(request.messages[0].content));
      return response(JSON.stringify(document));
    } };
    const temp = mkdtempSync(join(tmpdir(), "knowmap-generation-")), previous = process.cwd();
    try {
      process.chdir(temp);
      const result = await new KnowledgeGenerator(provider, "激光雷达技术路线", profile).generate();
      assert.ok(calls >= 2 && calls <= 3); assert.ok(searches <= 2);
      assert.equal(result.distributedCalls, 0); assert.equal(result.converged, false);
      assert.ok(result.network.cardBlocks.every(b => b.type === "definition"));
      assert.equal(result.network.nodes.filter(n => n.canonicalName === "飞行时间测距").length, 1);
      const dataset = networkToDataset(result.network, profile);
      const node = dataset.nodes.find(n => n.canonicalName === "飞行时间测距");
      assert.equal(node.domainId, "lidar-principle"); assert.equal(node.level, 2);
      assert.equal(dataset.cards.filter(c => c.nodeId === node.id).length, 1);
      assert.ok(dataset.cards.find(c => c.nodeId === node.id).blocks[0].text);
      assert.equal(dataset.evidence.length, 1);
      assert.deepEqual(dataset.cards.find(c => c.nodeId === node.id).evidenceIds, [dataset.evidence[0].id]);
      const path = join(temp, "runtime.json");
      new RuntimeKnowledgeRepository(path, dataset);
      assert.deepEqual(new RuntimeKnowledgeRepository(path, dataset).snapshot(), dataset);
      await assert.rejects(new KnowledgeGenerator(provider, "激光雷达", profile, "full").generate(), /确认/);
      const broken = structuredClone(result.network); broken.nodes[1].parentId = "missing";
      assert.throws(() => networkToDataset(broken, profile), /未知父级/);
      const duplicate = structuredClone(result.network); duplicate.nodes.push(duplicate.nodes[1]);
      assert.throws(() => networkToDataset(duplicate, profile), /重复/);
    } finally { process.chdir(previous); rmSync(temp, { recursive: true, force: true }); }
  });
});

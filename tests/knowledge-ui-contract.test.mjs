import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import katex from "katex";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});

after(async () => vite.close());

test("the navigation tree and canvas share one canonical parent hierarchy", async () => {
  const { knowledgeNodes } = await vite.ssrLoadModule("/app/knowledge.ts");
  const ids = new Set(knowledgeNodes.map((node) => node.id));
  assert.equal(knowledgeNodes.length, 98);
  assert.equal(knowledgeNodes.filter((node) => !node.parent).length, 1);
  for (const node of knowledgeNodes) {
    if (node.parent) assert.ok(ids.has(node.parent), `missing parent for ${node.id}`);
  }
});

test("all structured formulas render as KaTeX and define their symbols", async () => {
  const { formulaMeta, knowledgeNodes } = await vite.ssrLoadModule("/app/knowledge.ts");
  const formulaNodeIds = knowledgeNodes.filter((node) => node.formula).map((node) => node.id);
  assert.deepEqual(Object.keys(formulaMeta).sort(), formulaNodeIds.sort());
  for (const [nodeId, formula] of Object.entries(formulaMeta)) {
    assert.ok(formula.symbols.length > 0, `${nodeId} has no symbol definitions`);
    assert.match(katex.renderToString(formula.latex, { throwOnError: true }), /class="katex"/);
  }
});

test("the page exposes the requested controls without implementation copy", async () => {
  const source = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(source, /知识域树/);
  assert.match(source, /复制 LaTeX/);
  assert.match(source, /展开字母与符号解释/);
  assert.match(source, /开启或关闭连线流动/);
  assert.match(source, /当前节点优先/);
  assert.match(source, /className="graph-workbench"[\s\S]*KnowledgeGraphCanvas[\s\S]*AgentPanel[\s\S]*<aside/);
  assert.doesNotMatch(source, /InspectorTab|inspectorTab|role="tablist"/);
  assert.doesNotMatch(source, /当前拓扑中心|>局部拓扑<|父子知识关系|跨域知识关系/);
});

test("Agent and knowledge-card source expose the compact unified interaction contract", async () => {
  const agent = await readFile(new URL("../features/agent/components/AgentPanel.tsx", import.meta.url), "utf8");
  const card = await readFile(new URL("../features/knowledge-graph/components/KnowledgeCardPanel.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(agent, /\/api\/agent\/deep-search/);
  assert.match(agent, /总结对话/);
  assert.match(agent, /确认写入/);
  assert.match(agent, /knowledge_candidate/);
  assert.match(agent, /"collapsed" \| "compact" \| "overlay"/);
  assert.match(card, /理论知识/);
  assert.match(card, /应用知识/);
  assert.match(card, /其他知识/);
  assert.match(card, /历史修改/);
  assert.match(card, /生成变更预览/);
  assert.match(card, /确认保存/);
  assert.doesNotMatch(card, /Agent 默认不读取此页/);
  assert.match(styles, /\.graph-agent \{[^}]*height: 200px/);
  assert.match(styles, /\.graph-agent\.overlay \{[^}]*position: absolute/);
  assert.match(styles, /\.resize-handle/);
  assert.match(styles, /font-size: 12px !important/);
});

test("topology columns preserve primary-tree depth when a parent is opened", async () => {
  const layout = await vite.ssrLoadModule("/features/knowledge-graph/layout/legacySvgLayout.ts");
  const positioned = layout.arrange(layout.nodeMap.get("chirp"));
  const byId = new Map(positioned.map((node) => [node.id, node]));
  assert.equal(byId.get("chirp").x, byId.get("dechirp").x);
  assert.equal(byId.get("chirp").x, byId.get("data-cube").x);
  assert.ok(byId.get("slope").x > byId.get("chirp").x);
  assert.equal(byId.has("range-processing"), false, "an unrelated semantic neighbour must not be promoted into the child column");
});

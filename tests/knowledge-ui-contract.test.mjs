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

import type { KnowledgeDataset } from "../../core/knowledge/schema";

export const neutralDataset: KnowledgeDataset = {
  revision: 1,
  domains: [{ id: "physical-performance", name: "中立领域", description: "用于引擎测试的最小领域。", visualBranch: "foundation", order: 1 }],
  nodes: [
    { id: "root", canonicalName: "中立知识图", shortFact: "用于验证通用知识图谱引擎。", aliases: [], nodeRole: "domain", nodeType: "domain", domainId: "physical-performance", visualBranch: "foundation", primaryParentId: null, level: 0, order: 0, tags: [], status: "draft" },
    { id: "core", canonicalName: "基础分类", shortFact: "按稳定语义组织具体知识对象。", aliases: [], nodeRole: "category", nodeType: "category", domainId: "physical-performance", visualBranch: "foundation", primaryParentId: "root", level: 1, order: 1, tags: [], status: "draft" },
    { id: "item", canonicalName: "中立概念", shortFact: "一个用于验证实体粒度的具体概念。", aliases: [], nodeRole: "entity", nodeType: "concept", domainId: "physical-performance", visualBranch: "foundation", primaryParentId: "core", level: 2, order: 2, tags: [], status: "draft" },
  ],
  cards: [
    { nodeId: "root", headline: "中立知识图", blocks: [{ type: "definition", title: "基础定义与理论说明", text: "领域导航节点。" }], formulaIds: [], evidenceIds: [], revision: 1 },
    { nodeId: "core", headline: "基础分类", blocks: [{ type: "definition", title: "基础定义与理论说明", text: "分类概括节点。" }], formulaIds: [], evidenceIds: [], revision: 1 },
    { nodeId: "item", headline: "中立概念", blocks: [{ type: "definition", title: "基础定义与理论说明", text: "具体知识实体。" }], formulaIds: [], evidenceIds: [], revision: 1 },
  ],
  formulas: [], edges: [], evidence: [],
};

import { getLocalGraph } from "../../../core/knowledge/traversal";
import type { CardBlockType, TraversalReason } from "../../../core/knowledge/schema";
import { expandedKnowledgeDataset } from "../../../data/knowledge/deep-slices";

const recommendedBlocks: Array<{ type: CardBlockType; label: string }> = [
  { type: "definition", label: "定义与边界" },
  { type: "principle", label: "原理与推导" },
  { type: "assumptions", label: "成立假设" },
  { type: "inputs_outputs", label: "输入与输出" },
  { type: "procedure", label: "实现步骤" },
  { type: "engineering_tradeoff", label: "工程取舍" },
  { type: "failure_mode", label: "失效模式" },
  { type: "validation", label: "验证方法" },
  { type: "comparison", label: "同类方案比较" },
  { type: "application", label: "典型应用" },
  { type: "research_topic", label: "研究热点" },
  { type: "code", label: "最小实现" },
  { type: "misconception", label: "常见误区" },
];

const reasonLabels: Record<TraversalReason, string> = {
  anchor: "当前节点",
  similar: "相似方法",
  alternative: "替代方案",
  sibling: "同层知识",
  child: "子问题",
  prerequisite: "前置知识",
  dependent: "依赖此项",
  dependency: "依赖知识",
  input: "输入知识",
  downstream: "下游用途",
  output: "输出结果",
  producer: "产生来源",
};

export type DeepSearchCandidate = { nodeId: string; title: string; reason: string; summary: string };

export type DeepSearchReport = {
  nodeId: string;
  title: string;
  coverage: { present: number; total: number; missing: string[] };
  candidates: DeepSearchCandidate[];
  recommendations: string[];
  proposalSummary: string;
};

export function runOfflineDeepSearch(nodeId: string): DeepSearchReport {
  const node = expandedKnowledgeDataset.nodes.find((item) => item.id === nodeId);
  if (!node) throw new Error(`Unknown knowledge node: ${nodeId}`);
  const card = expandedKnowledgeDataset.cards.find((item) => item.nodeId === nodeId);
  const presentTypes = new Set(card?.blocks.map((block) => block.type) ?? []);
  const missing = recommendedBlocks.filter((item) => !presentTypes.has(item.type)).map((item) => item.label);
  const local = getLocalGraph(expandedKnowledgeDataset, nodeId, {
    maxDepth: 2,
    maxNodes: 16,
    includeImplicitSiblings: true,
  });
  const nodeById = new Map(expandedKnowledgeDataset.nodes.map((item) => [item.id, item]));
  const candidates = local.visits.slice(1).map((visit) => ({
    nodeId: visit.nodeId,
    title: nodeById.get(visit.nodeId)?.canonicalName ?? visit.nodeId,
    reason: reasonLabels[visit.reason],
    summary: expandedKnowledgeDataset.cards.find((item) => item.nodeId === visit.nodeId)?.headline
      ?? nodeById.get(visit.nodeId)?.shortFact
      ?? "",
  }));
  const directEdges = expandedKnowledgeDataset.edges.filter(
    (edge) => edge.sourceId === nodeId || edge.targetId === nodeId,
  );
  const explicitPeers = directEdges.filter(
    (edge) => edge.type === "SIMILAR_TO" || edge.type === "ALTERNATIVE_TO",
  );
  const children = expandedKnowledgeDataset.nodes.filter((item) => item.primaryParentId === nodeId);
  const recommendations = [
    ...(explicitPeers.length === 0 ? ["检索同一问题下的相似方法与替代方案，并补充可比较条件。"] : []),
    ...(children.length === 0 ? ["检索教材式子章节、工程子问题和常用解决方案。"] : []),
    ...(missing.length ? [`优先补齐卡片维度：${missing.slice(0, 5).join("、")}。`] : []),
    "核对新增关系的层级、方向、依据与输入输出语义，再交由 Review Agent 审查。",
  ];

  return {
    nodeId,
    title: node.canonicalName,
    coverage: { present: presentTypes.size, total: recommendedBlocks.length, missing },
    candidates,
    recommendations,
    proposalSummary: `围绕“${node.canonicalName}”形成 ${candidates.length} 个邻域参考和 ${missing.length} 个卡片缺口；结果仅作为待审查构建候选。`,
  };
}

export function answerFromCurrentKnowledge(nodeId: string, query: string): string {
  const node = expandedKnowledgeDataset.nodes.find((item) => item.id === nodeId);
  if (!node) throw new Error(`Unknown knowledge node: ${nodeId}`);
  const card = expandedKnowledgeDataset.cards.find((item) => item.nodeId === nodeId);
  const normalized = query.trim().toLocaleLowerCase();
  const words = normalized.match(/[a-z0-9_]+|[\u3400-\u9fff]/g) ?? [];
  const tokens = [...new Set(words.filter((token) => token.length > 1 || /[\u3400-\u9fff]/.test(token)))];
  const blocks = card?.blocks ?? [];
  const ranked = blocks
    .map((block, index) => {
      const haystack = `${block.title} ${block.text ?? ""} ${(block.items ?? []).join(" ")}`.toLocaleLowerCase();
      const score = tokens.reduce((total, token) => total + (haystack.includes(token) ? 1 : 0), 0);
      return { block, index, score };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index);
  const relevant = ranked.filter((item) => item.score > 0);
  const selected = (relevant.length ? relevant : ranked).slice(0, 3).map((item) => item.block);
  const detail = selected
    .flatMap((block) => [block.text, ...(block.items ?? [])])
    .filter(Boolean)
    .slice(0, 4)
    .join("；");
  const sources = selected.map((block) => block.title).join("、");
  return `${card?.headline ?? node.shortFact}${detail ? ` ${detail}` : ""}【当前卡片来源：${sources}】`;
}

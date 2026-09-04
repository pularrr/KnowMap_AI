import {
  crossLinks,
  formulaMeta,
  knowledgeNodes,
} from "@/app/knowledge";
import type {
  CardBlock,
  EdgeType,
  KnowledgeCard,
  KnowledgeDataset,
  KnowledgeEdge,
  KnowledgeFormula,
  KnowledgeNode,
  LegacyCrossLink,
  LegacyFormulaMeta,
  LegacyKnowledgeNode,
  NodeType,
  SemanticDomainId,
} from "@/core/knowledge/schema";
import { semanticDomains } from "./domains";

const domainRoots: Array<[SemanticDomainId, string[]]> = [
  ["nonideal-calibration", ["nonideal", "channel-calibration"]],
  ["detection-measurement", ["detection"]],
  ["spectral-rva", ["range-processing", "doppler-processing", "spectrum", "angle"]],
  ["clustering-object", ["clustering"]],
  ["estimation", ["estimation"]],
  ["association-tracking", ["association", "track-management"]],
  ["scene-events", ["events"]],
  ["system-hardware", ["system"]],
  ["ai-learning", ["ai"]],
];

const domainNodeIds = new Set(["fmcw", "foundation", "signal", "data", "system", "ai"]);
const metricNodeIds = new Set(["range-resolution", "pd-pfa", "nis-nees", "enob"]);
const problemNodeIds = new Set(["range-doppler-coupling", "phase-noise", "spurs", "multipath", "domain-shift"]);
const modelNodeIds = new Set(["motion-models", "extended-dense"]);
const algorithmNodeIds = new Set([
  "dbscan", "kmeans", "meanshift", "optics", "gnn", "jpda", "kf-family", "imm",
  "music", "iaa-omp-relax", "learned-cfar", "gnn-association", "occupancy",
]);
const methodNodeIds = new Set([
  "dc-removal", "range-window", "range-fft", "zero-padding", "doppler-fft", "coherent-integration",
  "nci-pci", "cfar-geometry", "ca-cfar", "os-cfar", "sva", "peak-interpolation", "angle-fft",
  "channel-calibration", "mahalanobis-gate", "track-initiation", "track-score", "tdma", "ddma",
  "fdma-cdma", "calibration", "model-driven",
]);

function nodeTypeFor(id: string): NodeType {
  if (domainNodeIds.has(id)) return "domain";
  if (metricNodeIds.has(id)) return "metric";
  if (problemNodeIds.has(id)) return "problem";
  if (modelNodeIds.has(id)) return "model";
  if (algorithmNodeIds.has(id)) return "algorithm";
  if (methodNodeIds.has(id)) return "method";
  return "concept";
}

function makeParentMap(input: LegacyKnowledgeNode[]): Map<string, string | undefined> {
  return new Map(input.map((node) => [node.id, node.parent]));
}

function isWithin(nodeId: string, rootId: string, parents: Map<string, string | undefined>): boolean {
  let current: string | undefined = nodeId;
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    if (current === rootId) return true;
    visited.add(current);
    current = parents.get(current);
  }
  return false;
}

function domainFor(node: LegacyKnowledgeNode, parents: Map<string, string | undefined>): SemanticDomainId {
  if (node.id === "fmcw") return "physical-performance";
  if (node.id === "foundation") return "waveform-if";
  if (node.id === "signal") return "spectral-rva";
  if (node.id === "data") return "association-tracking";
  for (const [domainId, roots] of domainRoots) {
    if (roots.some((root) => isWithin(node.id, root, parents))) return domainId;
  }
  if (node.branch === "foundation") return "waveform-if";
  if (node.branch === "signal") return "spectral-rva";
  if (node.branch === "data") return "association-tracking";
  if (node.branch === "system") return "system-hardware";
  return "ai-learning";
}

function levelFor(nodeId: string, parents: Map<string, string | undefined>): number {
  let level = 0;
  let current = parents.get(nodeId);
  const visited = new Set<string>([nodeId]);
  while (current && !visited.has(current)) {
    visited.add(current);
    level += 1;
    current = parents.get(current);
  }
  return level;
}

function blocksFor(node: LegacyKnowledgeNode): CardBlock[] {
  const blocks: CardBlock[] = [
    { type: "definition", title: "定义与原理", text: node.summary },
  ];
  if (node.details?.length) blocks.push({ type: "principle", title: "具体知识", items: [...node.details] });
  if (node.impact) blocks.push({ type: "engineering_tradeoff", title: "工程影响", text: node.impact });
  if (node.verification) blocks.push({ type: "validation", title: "如何验证", text: node.verification });
  if (node.pitfall) blocks.push({ type: "failure_mode", title: "常见误区 / 失效条件", text: node.pitfall });
  return blocks;
}

const legacyEdgeTypes: Record<string, EdgeType> = {
  "slope:if-band": "AFFECTS",
  "range-window:cfar-geometry": "AFFECTS",
  "channel-calibration:tdma": "PREREQUISITE_OF",
  "multipath:jpda": "AFFECTS",
  "ca-cfar:dbscan": "INPUT_TO",
  "nis-nees:mahalanobis-gate": "SIMILAR_TO",
  "domain-shift:learned-cfar": "AFFECTS",
};

export function createLegacyDataset(
  legacyNodes: LegacyKnowledgeNode[],
  legacyLinks: LegacyCrossLink[],
  legacyFormulaMeta: Record<string, LegacyFormulaMeta>,
): KnowledgeDataset {
  const parents = makeParentMap(legacyNodes);
  const nodes: KnowledgeNode[] = legacyNodes.map((legacy, order) => ({
    id: legacy.id,
    canonicalName: legacy.title,
    shortFact: legacy.subtitle,
    aliases: [],
    nodeType: nodeTypeFor(legacy.id),
    domainId: domainFor(legacy, parents),
    visualBranch: legacy.branch,
    primaryParentId: legacy.parent ?? null,
    level: levelFor(legacy.id, parents),
    order,
    tags: [],
    status: "published",
    legacyId: legacy.id,
    legacySnapshot: {
      ...legacy,
      ...(legacy.details ? { details: [...legacy.details] } : {}),
    },
  }));
  const formulas: KnowledgeFormula[] = legacyNodes
    .filter((legacy) => legacy.formula)
    .map((legacy) => {
      const meta = legacyFormulaMeta[legacy.id];
      return {
        id: `formula-${legacy.id}`,
        nodeId: legacy.id,
        name: `${legacy.title}公式`,
        latex: meta?.latex ?? legacy.formula!,
        sourceText: legacy.formula!,
        meaning: legacy.summary,
        symbols: (meta?.symbols ?? []).map((symbol) => ({
          symbol: symbol.symbol,
          latex: symbol.latex,
          definition: symbol.explanation,
          unit: symbol.unit,
        })),
        assumptions: ["公式采用当前知识卡片中的物理模型、符号约定与近似条件。"],
        evidenceIds: [],
      };
    });
  const cards: KnowledgeCard[] = legacyNodes.map((legacy) => ({
    nodeId: legacy.id,
    headline: legacy.summary,
    blocks: blocksFor(legacy),
    formulaIds: legacy.formula ? [`formula-${legacy.id}`] : [],
    evidenceIds: [],
    revision: 1,
  }));
  const edges: KnowledgeEdge[] = legacyLinks.map((link, index) => ({
    id: `legacy-link-${index}-${link.from}-${link.to}`,
    sourceId: link.from,
    targetId: link.to,
    type: legacyEdgeTypes[`${link.from}:${link.to}`] ?? "AFFECTS",
    rationale: link.label,
    weight: 1,
    status: "published",
    evidenceIds: [],
    legacyLabel: link.label,
  }));
  return { revision: 1, domains: semanticDomains, nodes, cards, formulas, edges };
}

export function toLegacyKnowledgeNodes(dataset: KnowledgeDataset): LegacyKnowledgeNode[] {
  const cardByNode = new Map(dataset.cards.map((card) => [card.nodeId, card]));
  const formulaByNode = new Map(dataset.formulas.map((formula) => [formula.nodeId, formula]));
  return dataset.nodes
    .filter((node) => node.legacyId)
    .sort((a, b) => a.order - b.order)
    .map((node) => {
      if (node.legacySnapshot) {
        return {
          ...node.legacySnapshot,
          ...(node.legacySnapshot.details ? { details: [...node.legacySnapshot.details] } : {}),
        };
      }
      const card = cardByNode.get(node.id);
      const find = (type: CardBlock["type"]) => card?.blocks.find((block) => block.type === type);
      const details = find("principle")?.items;
      const impact = find("engineering_tradeoff")?.text;
      const verification = find("validation")?.text;
      const pitfall = find("failure_mode")?.text;
      return {
        id: node.legacyId!,
        title: node.canonicalName,
        subtitle: node.shortFact,
        branch: node.visualBranch,
        ...(node.primaryParentId ? { parent: node.primaryParentId } : {}),
        summary: card?.headline ?? "",
        ...(details ? { details: [...details] } : {}),
        ...(formulaByNode.get(node.id) ? { formula: formulaByNode.get(node.id)!.sourceText } : {}),
        ...(impact ? { impact } : {}),
        ...(verification ? { verification } : {}),
        ...(pitfall ? { pitfall } : {}),
      };
    });
}

export function toLegacyCrossLinks(dataset: KnowledgeDataset): LegacyCrossLink[] {
  return dataset.edges
    .filter((edge) => edge.legacyLabel)
    .map((edge) => ({ from: edge.sourceId, to: edge.targetId, label: edge.legacyLabel! }));
}

export const legacyKnowledgeDataset = createLegacyDataset(
  knowledgeNodes as LegacyKnowledgeNode[],
  crossLinks as LegacyCrossLink[],
  formulaMeta as Record<string, LegacyFormulaMeta>,
);

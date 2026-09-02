import type {
  KnowledgeCard,
  KnowledgeDataset,
  KnowledgeEdge,
  KnowledgeFormula,
  KnowledgeNode,
  SemanticDomain,
} from "@/core/knowledge/schema";
import type { KnowledgeRepository } from "./knowledge-repository";

const byPlacement = (a: KnowledgeNode, b: KnowledgeNode) =>
  a.order - b.order || a.id.localeCompare(b.id);

function cloneDataset(dataset: KnowledgeDataset): KnowledgeDataset {
  return {
    revision: dataset.revision,
    domains: dataset.domains.map((domain) => ({ ...domain })),
    nodes: dataset.nodes.map((node) => ({
      ...node,
      aliases: [...node.aliases],
      tags: [...node.tags],
      legacySnapshot: node.legacySnapshot
        ? { ...node.legacySnapshot, ...(node.legacySnapshot.details ? { details: [...node.legacySnapshot.details] } : {}) }
        : undefined,
    })),
    cards: dataset.cards.map((card) => ({
      ...card,
      formulaIds: [...card.formulaIds],
      evidenceIds: [...card.evidenceIds],
      blocks: card.blocks.map((block) => ({
        ...block,
        items: block.items ? [...block.items] : undefined,
        formulaIds: block.formulaIds ? [...block.formulaIds] : undefined,
      })),
    })),
    formulas: dataset.formulas.map((formula) => ({
      ...formula,
      assumptions: [...formula.assumptions],
      evidenceIds: [...formula.evidenceIds],
      symbols: formula.symbols.map((symbol) => ({ ...symbol })),
    })),
    edges: dataset.edges.map((edge) => ({ ...edge, evidenceIds: [...edge.evidenceIds] })),
  };
}

export class StaticKnowledgeRepository implements KnowledgeRepository {
  private readonly dataset: KnowledgeDataset;
  private readonly nodeById: Map<string, KnowledgeNode>;
  private readonly childrenByParent: Map<string, KnowledgeNode[]>;
  private readonly cardByNode: Map<string, KnowledgeCard>;
  private readonly formulasByNode: Map<string, KnowledgeFormula[]>;

  constructor(dataset: KnowledgeDataset) {
    this.dataset = cloneDataset(dataset);
    this.nodeById = new Map(this.dataset.nodes.map((node) => [node.id, node]));
    this.childrenByParent = new Map();
    for (const node of this.dataset.nodes) {
      if (!node.primaryParentId) continue;
      const children = this.childrenByParent.get(node.primaryParentId) ?? [];
      children.push(node);
      this.childrenByParent.set(node.primaryParentId, children);
    }
    for (const children of this.childrenByParent.values()) children.sort(byPlacement);
    this.cardByNode = new Map(this.dataset.cards.map((card) => [card.nodeId, card]));
    this.formulasByNode = new Map();
    for (const formula of this.dataset.formulas) {
      const formulas = this.formulasByNode.get(formula.nodeId) ?? [];
      formulas.push(formula);
      this.formulasByNode.set(formula.nodeId, formulas);
    }
  }

  getSnapshot(): KnowledgeDataset { return cloneDataset(this.dataset); }
  getDomains(): SemanticDomain[] { return this.dataset.domains.map((domain) => ({ ...domain })); }
  getNodes(): KnowledgeNode[] { return this.dataset.nodes.map((node) => ({ ...node, aliases: [...node.aliases], tags: [...node.tags] })); }
  getNode(id: string): KnowledgeNode | undefined {
    const node = this.nodeById.get(id);
    return node ? { ...node, aliases: [...node.aliases], tags: [...node.tags] } : undefined;
  }
  getChildren(parentId: string): KnowledgeNode[] {
    return (this.childrenByParent.get(parentId) ?? []).map((node) => ({ ...node, aliases: [...node.aliases], tags: [...node.tags] }));
  }
  getCard(nodeId: string): KnowledgeCard | undefined {
    const card = this.cardByNode.get(nodeId);
    return card ? cloneDataset({ revision: 0, domains: [], nodes: [], cards: [card], formulas: [], edges: [] }).cards[0] : undefined;
  }
  getFormulas(nodeId: string): KnowledgeFormula[] {
    return cloneDataset({ revision: 0, domains: [], nodes: [], cards: [], formulas: this.formulasByNode.get(nodeId) ?? [], edges: [] }).formulas;
  }
  getEdges(nodeId?: string): KnowledgeEdge[] {
    const edges = nodeId
      ? this.dataset.edges.filter((edge) => edge.sourceId === nodeId || edge.targetId === nodeId)
      : this.dataset.edges;
    return edges.map((edge) => ({ ...edge, evidenceIds: [...edge.evidenceIds] }));
  }
}

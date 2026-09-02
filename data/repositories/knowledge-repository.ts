import type {
  KnowledgeCard,
  KnowledgeDataset,
  KnowledgeEdge,
  KnowledgeFormula,
  KnowledgeNode,
  SemanticDomain,
} from "@/core/knowledge/schema";

export interface KnowledgeRepository {
  getSnapshot(): KnowledgeDataset;
  getDomains(): SemanticDomain[];
  getNodes(): KnowledgeNode[];
  getNode(id: string): KnowledgeNode | undefined;
  getChildren(parentId: string): KnowledgeNode[];
  getCard(nodeId: string): KnowledgeCard | undefined;
  getFormulas(nodeId: string): KnowledgeFormula[];
  getEdges(nodeId?: string): KnowledgeEdge[];
}

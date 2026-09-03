import type {
  KnowledgeCard,
  KnowledgeDataset,
  KnowledgeEdge,
  KnowledgeFormula,
  KnowledgeHistoryEntry,
  KnowledgeNode,
  SemanticDomain,
} from "@/core/knowledge/schema";

export interface HistoryRetrievalPolicy {
  /** Must be true because history is excluded from normal Agent retrieval. */
  includeHistory: true;
  /** Optional explicit user-selected history records. */
  historyIds: readonly string[];
}

export interface KnowledgeRepository {
  getSnapshot(): KnowledgeDataset;
  getDomains(): SemanticDomain[];
  getNodes(): KnowledgeNode[];
  getNode(id: string): KnowledgeNode | undefined;
  getChildren(parentId: string): KnowledgeNode[];
  getCard(nodeId: string): KnowledgeCard | undefined;
  getFormulas(nodeId: string): KnowledgeFormula[];
  getEdges(nodeId?: string): KnowledgeEdge[];
  getHistory(nodeId: string, policy?: HistoryRetrievalPolicy): KnowledgeHistoryEntry[];
}

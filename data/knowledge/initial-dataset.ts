import type { KnowledgeDataset, KnowledgeNode } from "../../core/knowledge/schema";
import { ACTIVE_PROFILE } from "../../profiles/active";

export function createInitialDataset(): KnowledgeDataset {
  const profile = ACTIVE_PROFILE;
  const root = profile.initialization.rootNode;
  const firstDomain = profile.domains[0];
  const nodes: KnowledgeNode[] = [{ id: root.id, canonicalName: root.name, shortFact: root.shortFact, aliases: [], nodeRole: "domain", nodeType: "domain", domainId: firstDomain.id as KnowledgeNode["domainId"], visualBranch: firstDomain.visualBranch as KnowledgeNode["visualBranch"], primaryParentId: null, level: 0, order: 0, tags: [], status: "draft" }, ...profile.domains.map((domain, index): KnowledgeNode => ({ id: domain.id, canonicalName: domain.name, shortFact: domain.description, aliases: [], nodeRole: "domain", nodeType: "domain", domainId: domain.id as KnowledgeNode["domainId"], visualBranch: domain.visualBranch as KnowledgeNode["visualBranch"], primaryParentId: root.id, level: 1, order: index + 1, tags: [], status: "draft" }))];
  return { revision: 1, domains: profile.domains as KnowledgeDataset["domains"], nodes, cards: nodes.map((node) => ({ nodeId: node.id, headline: node.shortFact, blocks: [{ type: "definition", title: "定义与边界", text: node.shortFact }], formulaIds: [], evidenceIds: [], revision: 1 })), formulas: [], edges: [] };
}

export const expandedKnowledgeDataset = createInitialDataset();

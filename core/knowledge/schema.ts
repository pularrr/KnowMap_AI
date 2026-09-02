export type VisualBranch = "foundation" | "signal" | "data" | "system" | "ai";

export type SemanticDomainId =
  | "physical-performance"
  | "waveform-if"
  | "nonideal-calibration"
  | "spectral-rva"
  | "detection-measurement"
  | "clustering-object"
  | "estimation"
  | "association-tracking"
  | "scene-events"
  | "system-hardware"
  | "ai-learning";

export type NodeType =
  | "domain"
  | "problem"
  | "concept"
  | "method"
  | "algorithm"
  | "model"
  | "phenomenon"
  | "component"
  | "artifact"
  | "parameter"
  | "metric"
  | "application";

export type KnowledgeStatus = "draft" | "reviewed" | "published";

export type EdgeType =
  | "SIMILAR_TO"
  | "ALTERNATIVE_TO"
  | "PREREQUISITE_OF"
  | "PART_OF"
  | "INPUT_TO"
  | "OUTPUT_OF"
  | "USES_MODEL"
  | "IMPLEMENTS"
  | "DERIVED_FROM"
  | "AFFECTS"
  | "MITIGATES"
  | "EVALUATED_BY";

export interface SemanticDomain {
  id: SemanticDomainId;
  name: string;
  description: string;
  visualBranch: VisualBranch;
  order: number;
}

export interface KnowledgeNode {
  id: string;
  canonicalName: string;
  shortFact: string;
  aliases: string[];
  nodeType: NodeType;
  domainId: SemanticDomainId;
  visualBranch: VisualBranch;
  primaryParentId: string | null;
  level: number;
  order: number;
  tags: string[];
  status: KnowledgeStatus;
  /** Present only for migrated nodes whose public URL/id must remain stable. */
  legacyId?: string;
  /** Immutable migration metadata; never used as the canonical card model. */
  legacySnapshot?: LegacyKnowledgeNode;
}

export type CardBlockType =
  | "definition"
  | "principle"
  | "assumptions"
  | "inputs_outputs"
  | "procedure"
  | "engineering_tradeoff"
  | "failure_mode"
  | "validation"
  | "comparison"
  | "application"
  | "research_topic"
  | "code"
  | "misconception";

export interface CardBlock {
  type: CardBlockType;
  title: string;
  text?: string;
  items?: string[];
  formulaIds?: string[];
  language?: "python" | "matlab" | "typescript" | "text";
  code?: string;
}

export interface KnowledgeCard {
  nodeId: string;
  headline: string;
  blocks: CardBlock[];
  formulaIds: string[];
  evidenceIds: string[];
  revision: number;
}

export interface FormulaSymbol {
  symbol: string;
  latex: string;
  definition: string;
  unit?: string;
  constraints?: string;
}

export interface KnowledgeFormula {
  id: string;
  nodeId: string;
  name: string;
  latex: string;
  /** Exact display copy from the legacy node, retained for lossless adaptation. */
  sourceText: string;
  meaning: string;
  symbols: FormulaSymbol[];
  assumptions: string[];
  evidenceIds: string[];
}

export interface KnowledgeEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: EdgeType;
  rationale: string;
  weight: number;
  status: KnowledgeStatus;
  evidenceIds: string[];
  legacyLabel?: string;
}

export interface KnowledgeDataset {
  revision: number;
  domains: SemanticDomain[];
  nodes: KnowledgeNode[];
  cards: KnowledgeCard[];
  formulas: KnowledgeFormula[];
  edges: KnowledgeEdge[];
}

export interface LegacyKnowledgeNode {
  id: string;
  title: string;
  subtitle: string;
  branch: VisualBranch;
  parent?: string;
  summary: string;
  details?: string[];
  formula?: string;
  impact?: string;
  verification?: string;
  pitfall?: string;
}

export interface LegacyCrossLink {
  from: string;
  to: string;
  label: string;
}

export interface LegacyFormulaMeta {
  latex: string;
  symbols: Array<{ symbol: string; latex: string; explanation: string; unit?: string }>;
}

export interface DatasetPatch {
  id: string;
  baseRevision: number;
  addNodes: KnowledgeNode[];
  addCards: KnowledgeCard[];
  addFormulas: KnowledgeFormula[];
  addEdges: KnowledgeEdge[];
  updateNodes: Array<{ nodeId: string; changes: Partial<KnowledgeNode> }>;
  updateCards: Array<{ nodeId: string; card: KnowledgeCard }>;
}

export type TraversalReason =
  | "anchor"
  | "similar"
  | "alternative"
  | "sibling"
  | "child"
  | "dependency"
  | "input_output";

export interface TraversalVisit {
  nodeId: string;
  depth: number;
  reason: TraversalReason;
}

export interface LocalGraphOptions {
  maxDepth?: number;
  maxNodes?: number;
  includeImplicitSiblings?: boolean;
}

export interface LocalGraphResult {
  anchorId: string;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  visits: TraversalVisit[];
  truncated: boolean;
}

export interface VisibleGraphProjection {
  anchor: KnowledgeNode;
  previous: KnowledgeNode[];
  next: KnowledgeNode[];
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  visits: TraversalVisit[];
  truncated: boolean;
}

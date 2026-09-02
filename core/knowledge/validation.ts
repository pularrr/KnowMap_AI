import type { EdgeType, KnowledgeDataset, KnowledgeEdge } from "./schema";

export interface ValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  entityId?: string;
}

export interface ValidationReport {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  issues: ValidationIssue[];
}

const symmetric = new Set<EdgeType>(["SIMILAR_TO", "ALTERNATIVE_TO"]);

function edgeKey(edge: KnowledgeEdge): string {
  if (!symmetric.has(edge.type)) return `${edge.type}:${edge.sourceId}:${edge.targetId}`;
  const [left, right] = [edge.sourceId, edge.targetId].sort();
  return `${edge.type}:${left}:${right}`;
}

export function validateKnowledgeDataset(dataset: KnowledgeDataset): ValidationReport {
  const issues: ValidationIssue[] = [];
  const add = (severity: ValidationIssue["severity"], code: string, message: string, entityId?: string) =>
    issues.push({ severity, code, message, entityId });

  const domainIds = new Set<string>();
  for (const domain of dataset.domains) {
    if (domainIds.has(domain.id)) add("error", "DUPLICATE_DOMAIN", `重复领域 ${domain.id}`, domain.id);
    domainIds.add(domain.id);
  }
  if (domainIds.size !== 11) add("error", "DOMAIN_COUNT", `应有 11 个语义领域，当前为 ${domainIds.size} 个。`);
  const visualBranches = new Set(dataset.domains.map((domain) => domain.visualBranch));
  if (visualBranches.size !== 5) add("error", "VISUAL_BRANCH_COUNT", `应映射到 5 个视觉分支，当前为 ${visualBranches.size} 个。`);

  const nodeById = new Map<string, (typeof dataset.nodes)[number]>();
  const legacyIds = new Set<string>();
  for (const node of dataset.nodes) {
    if (nodeById.has(node.id)) add("error", "DUPLICATE_NODE", `重复节点 ${node.id}`, node.id);
    nodeById.set(node.id, node);
    if (!domainIds.has(node.domainId)) add("error", "UNKNOWN_DOMAIN", `未知领域 ${node.domainId}`, node.id);
    if (!node.canonicalName.trim() || !node.shortFact.trim()) add("error", "EMPTY_NODE_COPY", "节点名称和短事实不能为空。", node.id);
    if (node.primaryParentId === node.id) add("error", "SELF_PARENT", "节点不能以自身为父节点。", node.id);
    if (node.legacyId) {
      if (legacyIds.has(node.legacyId)) add("error", "DUPLICATE_LEGACY_ID", `重复 legacyId ${node.legacyId}`, node.id);
      legacyIds.add(node.legacyId);
    }
  }
  const roots = dataset.nodes.filter((node) => node.primaryParentId === null);
  if (roots.length !== 1) add("error", "ROOT_COUNT", `必须有且只有一个根节点，当前为 ${roots.length}。`);
  for (const node of dataset.nodes) {
    if (!node.primaryParentId) {
      if (node.level !== 0) add("error", "ROOT_LEVEL", "根节点 level 必须为 0。", node.id);
      continue;
    }
    const parent = nodeById.get(node.primaryParentId);
    if (!parent) add("error", "MISSING_PARENT", `父节点 ${node.primaryParentId} 不存在。`, node.id);
    else if (node.level !== parent.level + 1) add("error", "LEVEL_GAP", `level 应为父节点 level+1。`, node.id);
  }

  const parentState = new Map<string, 0 | 1 | 2>();
  const visitParent = (nodeId: string) => {
    const state = parentState.get(nodeId) ?? 0;
    if (state === 1) { add("error", "PLACEMENT_CYCLE", "主分类树存在环。", nodeId); return; }
    if (state === 2) return;
    parentState.set(nodeId, 1);
    const parentId = nodeById.get(nodeId)?.primaryParentId;
    if (parentId && nodeById.has(parentId)) visitParent(parentId);
    parentState.set(nodeId, 2);
  };
  for (const node of dataset.nodes) visitParent(node.id);

  const edgeIds = new Set<string>();
  const edgeKeys = new Set<string>();
  for (const edge of dataset.edges) {
    if (edgeIds.has(edge.id)) add("error", "DUPLICATE_EDGE_ID", `重复边 ${edge.id}`, edge.id);
    edgeIds.add(edge.id);
    if (!nodeById.has(edge.sourceId) || !nodeById.has(edge.targetId)) add("error", "MISSING_EDGE_ENDPOINT", "关系端点不存在。", edge.id);
    if (edge.sourceId === edge.targetId) add("error", "SELF_EDGE", "关系不能指向自身。", edge.id);
    if (!edge.rationale.trim()) add("error", "EMPTY_RATIONALE", "关系必须解释建立理由。", edge.id);
    if (!(edge.weight > 0 && edge.weight <= 1)) add("error", "EDGE_WEIGHT", "关系权重必须在 (0,1]。", edge.id);
    const key = edgeKey(edge);
    if (edgeKeys.has(key)) add("error", "DUPLICATE_EDGE", "重复语义关系。", edge.id);
    edgeKeys.add(key);
    if (symmetric.has(edge.type)) {
      const source = nodeById.get(edge.sourceId);
      const target = nodeById.get(edge.targetId);
      if (source && target && (source.nodeType !== target.nodeType || source.level !== target.level)) {
        add("warning", "INCOMPARABLE_PEERS", "相似/替代关系两端不是同类型同层实体，请复核。", edge.id);
      }
    }
  }

  const prerequisiteTargets = new Map<string, string[]>();
  for (const edge of dataset.edges) {
    if (edge.type !== "PREREQUISITE_OF") continue;
    prerequisiteTargets.set(edge.sourceId, [...(prerequisiteTargets.get(edge.sourceId) ?? []), edge.targetId]);
  }
  const dependencyState = new Map<string, 0 | 1 | 2>();
  const visitDependency = (nodeId: string) => {
    const state = dependencyState.get(nodeId) ?? 0;
    if (state === 1) { add("error", "PREREQUISITE_CYCLE", "前置知识关系存在环。", nodeId); return; }
    if (state === 2) return;
    dependencyState.set(nodeId, 1);
    for (const target of prerequisiteTargets.get(nodeId) ?? []) visitDependency(target);
    dependencyState.set(nodeId, 2);
  };
  for (const node of dataset.nodes) visitDependency(node.id);

  const formulaById = new Map<string, (typeof dataset.formulas)[number]>();
  for (const formula of dataset.formulas) {
    if (formulaById.has(formula.id)) add("error", "DUPLICATE_FORMULA", `重复公式 ${formula.id}`, formula.id);
    formulaById.set(formula.id, formula);
    if (!nodeById.has(formula.nodeId)) add("error", "MISSING_FORMULA_NODE", "公式所属节点不存在。", formula.id);
    if (!formula.latex.trim() || !formula.sourceText.trim()) add("error", "EMPTY_FORMULA", "公式缺少 LaTeX 或原始显示文本。", formula.id);
    if (!formula.symbols.length) add("error", "MISSING_SYMBOLS", "公式必须定义符号。", formula.id);
    for (const symbol of formula.symbols) {
      if (!symbol.symbol.trim() || !symbol.latex.trim() || !symbol.definition.trim()) add("error", "INCOMPLETE_SYMBOL", "公式符号定义不完整。", formula.id);
    }
  }
  const cardNodes = new Set<string>();
  for (const card of dataset.cards) {
    if (cardNodes.has(card.nodeId)) add("error", "DUPLICATE_CARD", "每个节点只能有一张当前卡片。", card.nodeId);
    cardNodes.add(card.nodeId);
    if (!nodeById.has(card.nodeId)) add("error", "MISSING_CARD_NODE", "卡片节点不存在。", card.nodeId);
    if (!card.headline.trim() || !card.blocks.length) add("error", "EMPTY_CARD", "卡片必须包含摘要和内容块。", card.nodeId);
    for (const formulaId of [...card.formulaIds, ...card.blocks.flatMap((block) => block.formulaIds ?? [])]) {
      if (!formulaById.has(formulaId)) add("error", "MISSING_CARD_FORMULA", `卡片引用未知公式 ${formulaId}`, card.nodeId);
    }
  }
  for (const node of dataset.nodes) {
    if (!cardNodes.has(node.id)) add("warning", "MISSING_NODE_CARD", "节点尚无知识卡片。", node.id);
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  return { valid: errors.length === 0, errors, warnings, issues };
}

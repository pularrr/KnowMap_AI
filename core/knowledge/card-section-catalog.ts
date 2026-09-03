import type {
  CardBlockType,
  KnowledgeCard,
  KnowledgeCollectionKind,
  KnowledgeNode,
  NodeType,
} from "./schema";

export type CardSectionCoverage = "core" | "conditional" | "optional";

export type CardSectionCondition =
  | "has_formula"
  | "has_evidence"
  | "procedure_like_node"
  | "comparison_candidate";

export interface CardSectionDefinition {
  type: CardBlockType;
  label: string;
  definition: string;
  decisionSignals: readonly string[];
  positiveExamples: readonly string[];
  negativeExamples: readonly string[];
  collection: KnowledgeCollectionKind;
  order: number;
  coverage: CardSectionCoverage;
  appliesTo: readonly NodeType[] | "all";
  requiredWhen?: readonly CardSectionCondition[];
}

export interface CardCoverageReport {
  applicableTypes: CardBlockType[];
  expectedTypes: CardBlockType[];
  presentTypes: CardBlockType[];
  missingTypes: CardBlockType[];
  optionalTypes: CardBlockType[];
  present: number;
  total: number;
  missing: string[];
}

/**
 * The single source of truth for card semantics, ordering, coverage and UI
 * collection. Examples are classification examples, not text templates.
 */
export const CARD_SECTION_CATALOG = [
  {
    type: "definition",
    label: "定义与边界",
    definition: "说明对象是什么、不是什么，以及适用范围和与近邻概念的边界。",
    decisionSignals: ["是什么", "研究对象", "适用边界", "与……区别"],
    positiveExamples: ["最大似然估计是在参数固定但未知时最大化观测似然的估计准则。"],
    negativeExamples: ["先构造代价函数，再调用求解器。该内容属于实现步骤。"],
    collection: "theory",
    order: 10,
    coverage: "core",
    appliesTo: "all",
  },
  {
    type: "principle",
    label: "原理与推导",
    definition: "解释机制为何成立、关键因果链、数学依据或推导主线。",
    decisionSignals: ["为什么", "依据", "推导", "机理", "因果链"],
    positiveExamples: ["拍频由发射与延迟回波的瞬时频差产生，因此在静止目标条件下与距离近似成正比。"],
    negativeExamples: ["距离 FFT 使用 numpy.fft.fft。该内容属于最小实现。"],
    collection: "theory",
    order: 20,
    coverage: "core",
    appliesTo: ["problem", "concept", "method", "algorithm", "model", "phenomenon", "component", "parameter", "metric"],
  },
  {
    type: "assumptions",
    label: "成立假设",
    definition: "列出结论、模型或公式成立所依赖且可被检查的前提。",
    decisionSignals: ["假设", "前提", "条件下成立", "忽略", "独立同分布"],
    positiveExamples: ["该距离公式假设单个 chirp 内目标速度引起的距离变化可忽略。"],
    negativeExamples: ["窗函数能降低旁瓣。该内容属于原理或工程取舍。"],
    collection: "theory",
    order: 30,
    coverage: "conditional",
    appliesTo: ["concept", "method", "algorithm", "model", "parameter", "metric"],
    requiredWhen: ["has_formula"],
  },
  {
    type: "comparison",
    label: "同类方案比较",
    definition: "在同一问题与相同评价维度下比较可替代或相似方案。",
    decisionSignals: ["相比", "共同目标", "替代方案", "优缺点", "适用条件"],
    positiveExamples: ["JPDA 与 GNN 都解决数据关联；前者保留联合概率，后者输出硬分配。"],
    negativeExamples: ["马氏距离与 JPDA 都是数据关联算法。前者实际是门控或代价度量，不是同层算法。"],
    collection: "theory",
    order: 40,
    coverage: "conditional",
    appliesTo: ["method", "algorithm", "model", "metric"],
    requiredWhen: ["comparison_candidate"],
  },
  {
    type: "inputs_outputs",
    label: "输入与输出",
    definition: "明确方法、算法、组件或数据产物所消费与产生的数据、单位、形状和语义。",
    decisionSignals: ["输入", "输出", "张量形状", "接口", "单位"],
    positiveExamples: ["GNN 输入门控后的轨迹—量测代价矩阵，输出一对一关联指派。"],
    negativeExamples: ["GNN 属于全局最近邻数据关联方法。该内容属于定义。"],
    collection: "application",
    order: 50,
    coverage: "conditional",
    appliesTo: ["method", "algorithm", "model", "component", "artifact", "application"],
    requiredWhen: ["procedure_like_node"],
  },
  {
    type: "procedure",
    label: "实现步骤",
    definition: "给出可执行、可复现且有先后关系的工程或算法步骤。",
    decisionSignals: ["步骤", "先……再", "流程", "配置", "执行"],
    positiveExamples: ["先预测轨迹并构造门控矩阵，再求解全局指派，最后用匹配量测更新状态。"],
    negativeExamples: ["最小二乘最小化残差平方和。该内容属于定义或原理。"],
    collection: "application",
    order: 60,
    coverage: "core",
    appliesTo: ["method", "algorithm", "component", "application"],
  },
  {
    type: "engineering_tradeoff",
    label: "工程取舍",
    definition: "说明资源、精度、鲁棒性、时延、复杂度之间不可同时最优的选择。",
    decisionSignals: ["代价", "权衡", "复杂度", "实时性", "资源占用"],
    positiveExamples: ["扩大关联门可减少漏配，但会增加杂波候选和指派复杂度。"],
    negativeExamples: ["处理器主频为 1 GHz。孤立配置事实不是工程取舍。"],
    collection: "application",
    order: 70,
    coverage: "core",
    appliesTo: ["method", "algorithm", "model", "component", "parameter", "application"],
  },
  {
    type: "failure_mode",
    label: "失效模式",
    definition: "描述何种条件下会失败、可观察症状、成因和影响。",
    decisionSignals: ["失效", "异常症状", "退化", "误检", "发散"],
    positiveExamples: ["目标交叉时 GNN 的硬指派可能交换轨迹 ID，表现为航迹身份跳变。"],
    negativeExamples: ["可使用 JPDA。仅给出替代方法而没有失效条件与症状，不构成失效模式。"],
    collection: "application",
    order: 80,
    coverage: "conditional",
    appliesTo: ["method", "algorithm", "model", "component", "application"],
    requiredWhen: ["procedure_like_node"],
  },
  {
    type: "validation",
    label: "验证方法",
    definition: "给出可判定正确性的实验、指标、基线、数据与通过标准。",
    decisionSignals: ["验证", "指标", "基准", "通过标准", "测试数据"],
    positiveExamples: ["用已标注交叉轨迹序列统计 ID switch，并与 JPDA 在相同门限下比较。"],
    negativeExamples: ["结果看起来更平滑。缺少指标和通过标准，不能作为验证。"],
    collection: "application",
    order: 90,
    coverage: "core",
    appliesTo: ["method", "algorithm", "model", "component", "metric", "application"],
  },
  {
    type: "application",
    label: "典型应用",
    definition: "说明知识在具体任务、场景或系统链路中的实际用途。",
    decisionSignals: ["用于", "场景", "任务", "部署", "案例"],
    positiveExamples: ["JPDA 常用于密集多目标跟踪，以降低量测来源不确定性造成的航迹抖动。"],
    negativeExamples: ["JPDA 计算联合关联概率。该内容属于原理。"],
    collection: "application",
    order: 100,
    coverage: "optional",
    appliesTo: "all",
  },
  {
    type: "research_topic",
    label: "研究热点",
    definition: "记录仍在演进的开放问题、新方法方向或尚未形成工程共识的议题。",
    decisionSignals: ["开放问题", "前沿", "新近研究", "尚未解决", "研究方向"],
    positiveExamples: ["可微数据关联尝试把离散匹配纳入端到端学习，但可解释性与泛化仍是开放问题。"],
    negativeExamples: ["卡尔曼滤波在 1960 年发表。历史事实本身不是研究热点。"],
    collection: "other",
    order: 110,
    coverage: "optional",
    appliesTo: ["problem", "concept", "method", "algorithm", "model", "application"],
  },
  {
    type: "code",
    label: "最小实现",
    definition: "提供能表达核心运算的短代码、伪代码或关键 API 调用。",
    decisionSignals: ["代码", "伪代码", "函数调用", "最小复现", "脚本"],
    positiveExamples: ["assignment = linear_sum_assignment(cost_matrix)"],
    negativeExamples: ["建议使用匈牙利算法。没有实现片段，不属于最小实现。"],
    collection: "application",
    order: 120,
    coverage: "optional",
    appliesTo: ["method", "algorithm", "model", "component", "application"],
  },
  {
    type: "misconception",
    label: "常见误区",
    definition: "指出常见但错误或缺少前提的说法，并给出纠正后的表述。",
    decisionSignals: ["误区", "并非", "不能等同", "错误地认为", "应区分"],
    positiveExamples: ["马氏距离不是与 GNN、JPDA 同层的数据关联算法；它是可被门控和关联算法使用的统计距离。"],
    negativeExamples: ["GNN 和 JPDA 有差异。没有指出错误命题及纠正，不构成误区。"],
    collection: "other",
    order: 130,
    coverage: "optional",
    appliesTo: "all",
  },
] as const satisfies readonly CardSectionDefinition[];

const definitionByType = new Map<CardBlockType, CardSectionDefinition>(
  CARD_SECTION_CATALOG.map((definition) => [definition.type, definition]),
);

export function getCardSectionDefinition(type: CardBlockType): CardSectionDefinition {
  const definition = definitionByType.get(type);
  if (!definition) throw new Error(`Unknown card block type: ${type}`);
  return definition;
}

export function getCardSectionCollection(type: CardBlockType): KnowledgeCollectionKind {
  return getCardSectionDefinition(type).collection;
}

export function getCardSectionsForNode(node: Pick<KnowledgeNode, "nodeType">): CardSectionDefinition[] {
  return CARD_SECTION_CATALOG
    .filter((definition) => definition.appliesTo === "all"
      || (definition.appliesTo as readonly NodeType[]).includes(node.nodeType))
    .slice()
    .sort((left, right) => left.order - right.order);
}

function activeConditions(
  node: Pick<KnowledgeNode, "nodeType">,
  card?: Pick<KnowledgeCard, "blocks" | "formulaIds" | "evidenceIds">,
): Set<CardSectionCondition> {
  const conditions = new Set<CardSectionCondition>();
  const blockFormulaIds = card?.blocks.flatMap((block) => block.formulaIds ?? []) ?? [];
  if ((card?.formulaIds.length ?? 0) > 0 || blockFormulaIds.length > 0) conditions.add("has_formula");
  if ((card?.evidenceIds.length ?? 0) > 0) conditions.add("has_evidence");
  if (["method", "algorithm", "component", "application"].includes(node.nodeType)) {
    conditions.add("procedure_like_node");
  }
  if (["method", "algorithm", "model", "metric"].includes(node.nodeType)) {
    conditions.add("comparison_candidate");
  }
  return conditions;
}

export function assessCardCoverage(
  node: Pick<KnowledgeNode, "nodeType">,
  card?: Pick<KnowledgeCard, "blocks" | "formulaIds" | "evidenceIds">,
): CardCoverageReport {
  const applicable = getCardSectionsForNode(node);
  const conditions = activeConditions(node, card);
  const expected = applicable.filter((definition) => {
    if (definition.coverage === "core") return true;
    if (definition.coverage === "optional") return false;
    return (definition.requiredWhen ?? []).some((condition) => conditions.has(condition));
  });
  const presentSet = new Set(card?.blocks.map((block) => block.type) ?? []);
  const present = expected.filter((definition) => presentSet.has(definition.type));
  const missing = expected.filter((definition) => !presentSet.has(definition.type));

  return {
    applicableTypes: applicable.map((definition) => definition.type),
    expectedTypes: expected.map((definition) => definition.type),
    presentTypes: present.map((definition) => definition.type),
    missingTypes: missing.map((definition) => definition.type),
    optionalTypes: applicable.filter((definition) => definition.coverage === "optional").map((definition) => definition.type),
    present: present.length,
    total: expected.length,
    missing: missing.map((definition) => definition.label),
  };
}

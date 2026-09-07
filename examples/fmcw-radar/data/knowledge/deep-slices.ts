import type {
  CardBlock,
  DatasetPatch,
  EdgeType,
  KnowledgeCard,
  KnowledgeDataset,
  KnowledgeEdge,
  KnowledgeFormula,
  KnowledgeNode,
  NodeType,
  SemanticDomainId,
  VisualBranch,
} from "@/core/knowledge/schema";
import { legacyKnowledgeDataset } from "./legacy-migration";

function node(
  id: string,
  canonicalName: string,
  shortFact: string,
  nodeType: NodeType,
  domainId: SemanticDomainId,
  visualBranch: VisualBranch,
  primaryParentId: string,
  level: number,
  order: number,
  aliases: string[] = [],
): KnowledgeNode {
  return { id, canonicalName, shortFact, aliases, nodeType, domainId, visualBranch, primaryParentId, level, order, tags: [], status: "reviewed" };
}

function block(type: CardBlock["type"], title: string, text?: string, items?: string[], formulaIds?: string[]): CardBlock {
  return { type, title, text, items, formulaIds };
}

function card(nodeId: string, headline: string, blocks: CardBlock[], formulaIds: string[] = []): KnowledgeCard {
  return { nodeId, headline, blocks, formulaIds, evidenceIds: [], revision: 1 };
}

function edge(id: string, sourceId: string, targetId: string, type: EdgeType, rationale: string): KnowledgeEdge {
  return { id, sourceId, targetId, type, rationale, weight: 1, status: "reviewed", evidenceIds: [] };
}

const addedNodes: KnowledgeNode[] = [
  node("least-squares", "最小二乘估计（LS）", "最小化观测与模型预测的平方残差", "method", "estimation", "data", "estimators", 4, 1000, ["LS", "Least Squares"]),
  node("maximum-likelihood", "最大似然估计（ML）", "选择使已观测数据似然最大的参数", "method", "estimation", "data", "estimators", 4, 1001, ["ML", "MLE", "Maximum Likelihood"]),
  node("map-estimation", "最大后验估计（MAP）", "在似然与先验形成的后验中取众数", "method", "estimation", "data", "estimators", 4, 1002, ["MAP", "Maximum A Posteriori"]),
  node("mmse-estimation", "最小均方误差估计（MMSE）", "平方损失下取后验均值", "method", "estimation", "data", "estimators", 4, 1003, ["MMSE", "Minimum Mean Square Error"]),
  node("likelihood-function", "似然函数", "固定观测后把 p(z|x) 看作参数 x 的函数", "concept", "estimation", "data", "maximum-likelihood", 5, 1004, ["Likelihood"]),
  node("posterior-distribution", "后验分布", "由先验与似然更新得到的参数条件分布", "concept", "estimation", "data", "map-estimation", 5, 1005, ["Posterior"]),

  node("statistical-gating", "统计门控", "用创新统计量筛除不可信的量测—航迹组合", "method", "association-tracking", "data", "association", 3, 1010, ["Validation Gating"]),
  node("deterministic-assignment", "确定性关联", "在一对一约束下选择一个离散匹配结果", "concept", "association-tracking", "data", "association", 3, 1011),
  node("probabilistic-association", "概率关联", "保留多个可行量测来源的概率权重", "concept", "association-tracking", "data", "association", 3, 1012),
  node("innovation", "创新（量测残差）", "量测与预测量测之差", "artifact", "association-tracking", "data", "statistical-gating", 4, 1013, ["Innovation", "Residual"]),
  node("innovation-covariance", "创新协方差", "综合预测不确定性和量测噪声的残差尺度", "artifact", "association-tracking", "data", "statistical-gating", 4, 1014, ["Innovation Covariance"]),
  node("chi-square-threshold", "卡方门限", "由量测维数和门概率确定的统计阈值", "parameter", "association-tracking", "data", "statistical-gating", 4, 1015),
  node("hungarian-algorithm", "匈牙利算法", "求解线性和分配问题的通用优化算法", "algorithm", "association-tracking", "data", "deterministic-assignment", 4, 1016, ["Hungarian Algorithm"]),
  node("pda", "概率数据关联（PDA）", "单目标杂波环境中的软关联更新", "algorithm", "association-tracking", "data", "probabilistic-association", 4, 1017, ["PDA", "PDAF"]),
  node("association-hypothesis", "联合关联假设", "满足量测唯一来源等约束的一组联合事件", "concept", "association-tracking", "data", "probabilistic-association", 4, 1018),
  node("association-probability", "关联概率 β", "JPDA 对联合事件边缘化得到的航迹—量测权重", "parameter", "association-tracking", "data", "probabilistic-association", 4, 1019),
];

const formulas: KnowledgeFormula[] = [
  {
    id: "formula-least-squares", nodeId: "least-squares", name: "最小二乘目标",
    latex: String.raw`\hat{x}_{\mathrm{LS}}=\arg\min_x\lVert z-h(x)\rVert_2^2`,
    sourceText: "x̂LS = arg min ||z-h(x)||²", meaning: "选择使观测残差平方和最小的参数。",
    symbols: [
      { symbol: "x", latex: "x", definition: "待估参数或状态" },
      { symbol: "z", latex: "z", definition: "观测向量" },
      { symbol: "h(x)", latex: "h(x)", definition: "给定参数时的模型预测" },
    ], assumptions: ["普通 LS 默认各残差使用同一尺度；异方差或相关噪声应使用加权最小二乘。"], evidenceIds: [],
  },
  {
    id: "formula-maximum-likelihood", nodeId: "maximum-likelihood", name: "最大似然准则",
    latex: String.raw`\hat{x}_{\mathrm{ML}}=\arg\max_x p(z\mid x)`,
    sourceText: "x̂ML = arg max p(z|x)", meaning: "选择最能解释已观测数据的固定未知参数。",
    symbols: [
      { symbol: "x", latex: "x", definition: "固定但未知的参数" },
      { symbol: "p(z|x)", latex: String.raw`p(z\mid x)`, definition: "给定参数时观测的概率密度或质量函数" },
    ], assumptions: ["似然模型应与真实观测机制和噪声分布匹配。"], evidenceIds: [],
  },
  {
    id: "formula-map-estimation", nodeId: "map-estimation", name: "最大后验准则",
    latex: String.raw`\hat{x}_{\mathrm{MAP}}=\arg\max_x p(x\mid z)=\arg\max_x p(z\mid x)p(x)`,
    sourceText: "x̂MAP = arg max p(x|z)", meaning: "将似然与先验结合后取后验众数。",
    symbols: [
      { symbol: "p(x|z)", latex: String.raw`p(x\mid z)`, definition: "参数后验密度" },
      { symbol: "p(z|x)", latex: String.raw`p(z\mid x)`, definition: "似然函数" },
      { symbol: "p(x)", latex: "p(x)", definition: "参数先验密度" },
    ], assumptions: ["先验与似然采用一致的参数化和概率测度。"], evidenceIds: [],
  },
  {
    id: "formula-mmse-estimation", nodeId: "mmse-estimation", name: "MMSE 后验均值",
    latex: String.raw`\hat{x}_{\mathrm{MMSE}}=\mathbb E[x\mid z]=\int x\,p(x\mid z)\,\mathrm dx`,
    sourceText: "x̂MMSE = E[x|z]", meaning: "平方误差损失下使后验风险最小的估计是后验均值。",
    symbols: [
      { symbol: "E[x|z]", latex: String.raw`\mathbb E[x\mid z]`, definition: "给定观测后的条件期望" },
      { symbol: "p(x|z)", latex: String.raw`p(x\mid z)`, definition: "归一化后验密度" },
    ], assumptions: ["后验一阶矩存在并采用平方误差损失。"], evidenceIds: [],
  },
];

const addedCards: KnowledgeCard[] = [
  card("least-squares", "LS 直接拟合观测与模型，不要求先验或完整概率分布。", [
    block("principle", "目标", "最小化残差平方和；线性满秩模型可闭式求解，非线性模型通常迭代。", undefined, ["formula-least-squares"]),
    block("engineering_tradeoff", "工程选择", undefined, ["异方差或相关噪声使用 WLS。", "离群点会被平方损失放大，应检查稳健性。"]),
    block("misconception", "与 ML 的条件关系", "只有在特定高斯噪声条件下 LS 才与 ML 目标等价，不能把 LS 定义成似然估计。"),
  ], ["formula-least-squares"]),
  card("maximum-likelihood", "ML 最大化观测似然，不自动使用参数先验。", [
    block("principle", "似然准则", "固定观测 z，把 p(z|x) 作为 x 的函数进行优化。", undefined, ["formula-maximum-likelihood"]),
    block("engineering_tradeoff", "数值实现", undefined, ["通常优化对数似然避免连乘下溢。", "需检查可辨识性、边界和局部极值。"]),
    block("comparison", "与 LS、MAP", "高斯误差下可化为加权残差；MAP 则额外引入先验。"),
  ], ["formula-maximum-likelihood"]),
  card("map-estimation", "MAP 取后验众数，同时利用似然和先验。", [
    block("principle", "贝叶斯更新", "忽略与 x 无关的证据项后，最大化 p(z|x)p(x)。", undefined, ["formula-map-estimation"]),
    block("failure_mode", "多峰与参数化", "多峰后验只给一个峰可能掩盖不确定性，连续变量众数还可能受参数化影响。"),
    block("comparison", "与 ML、MMSE", "弱先验时可接近 ML；MMSE 取均值而非众数。"),
  ], ["formula-map-estimation"]),
  card("mmse-estimation", "MMSE 在平方损失下取后验均值，而不是后验最大点。", [
    block("principle", "后验风险", "对可能真值按后验加权平方误差，最优解为条件期望。", undefined, ["formula-mmse-estimation"]),
    block("failure_mode", "多峰后验", "后验均值可能落在各高概率峰之间，应同时呈现分布或多假设。"),
    block("comparison", "与 MAP", "对称单峰后验中二者可能重合，一般情况下对应不同结果。"),
  ], ["formula-mmse-estimation"]),
  card("likelihood-function", "似然固定观测、比较参数；它不是参数的概率分布。", [
    block("definition", "定义", "p(z|x) 原本是给定 x 时 z 的概率模型；观测 z 后可视为 x 的非归一化函数。"),
    block("misconception", "常见误区", "似然对 x 的积分通常不等于 1，不能直接称作参数后验。"),
  ]),
  card("posterior-distribution", "后验是先验经过观测似然更新后的完整不确定性表达。", [
    block("principle", "贝叶斯公式", "p(x|z) 与 p(z|x)p(x) 成正比，归一化常数是模型证据。"),
    block("application", "用途", undefined, ["MAP 读取后验众数。", "MMSE 读取后验均值。", "可信区间保留比单点更多的不确定性。"]),
  ]),
  card("statistical-gating", "门控是关联前的统计筛选，不是最终分配算法。", [
    block("procedure", "椭球门", undefined, ["计算创新。", "计算创新协方差。", "计算马氏二次型。", "与卡方门限比较。"]),
    block("engineering_tradeoff", "门概率", "门太小会拒绝真量测，门太大会增加杂波和组合复杂度。"),
  ]),
  card("deterministic-assignment", "确定性关联输出一个硬匹配，适合目标分离较好的场景。", [
    block("inputs_outputs", "接口", "输入为门内代价矩阵和漏检/虚警代价，输出为满足一对一约束的离散分配。"),
    block("failure_mode", "交叉目标", "一次硬误配可能持续传播并造成身份交换。"),
  ]),
  card("probabilistic-association", "概率关联保留多个来源解释，以概率权重进行软更新。", [
    block("principle", "软决策", "候选量测不立即二选一，而按可行事件的后验概率边缘化。"),
    block("engineering_tradeoff", "复杂度", "关联簇增大时联合事件数快速增长，需要严格门控、分簇或近似。"),
  ]),
  card("innovation", "创新必须在统一时间、坐标和角度约定下计算。", [
    block("definition", "定义", "创新是实际量测与预测量测之差，是门控、关联似然和滤波更新的共同输入。"),
    block("failure_mode", "角度环绕", "方位差跨越 ±π 时需先归一化，否则会产生巨大的伪残差。"),
  ]),
  card("innovation-covariance", "创新协方差定义残差应有的统计尺度。", [
    block("principle", "组成", "在线性量测模型下常写作 S=HPHᵀ+R，融合预测协方差与量测噪声。"),
    block("validation", "一致性", "用 NIS 卡方覆盖率检查 S 是否长期过小或过大。"),
  ]),
  card("chi-square-threshold", "门限由量测维数和目标门概率共同确定。", [
    block("engineering_tradeoff", "阈值选择", "固定数值跨量测维数复用会改变实际门概率；应明确自由度和置信水平。"),
    block("validation", "验证", "统计真匹配通过率与杂波进入数，并与设定门概率对照。"),
  ]),
  card("hungarian-algorithm", "匈牙利算法是 GNN 常用求解器，不等于完整跟踪关联逻辑。", [
    block("principle", "求解对象", "在代价矩阵上求线性和分配最优解。"),
    block("inputs_outputs", "边界", "它不负责门控、代价概率建模、漏检虚警语义或航迹更新。"),
  ]),
  card("pda", "PDA 面向单目标杂波环境，对门内候选量测进行概率加权。", [
    block("principle", "软创新", "同时考虑各候选量测和漏检事件，按关联概率加权更新。"),
    block("comparison", "与 JPDA", "JPDA 在多目标情形加入联合互斥约束，不能把各航迹的 PDA 独立相乘替代。"),
  ]),
  card("association-hypothesis", "联合假设必须满足一个量测至多来自一个目标等互斥约束。", [
    block("definition", "事件", "一个假设同时描述关联、漏检和杂波解释，是 JPDA 边缘化与 MHT 分支的基础。"),
    block("failure_mode", "组合增长", "目标和候选量测增多时事件数呈组合增长。"),
  ]),
  card("association-probability", "β 是联合事件概率边缘化后的航迹—量测权重。", [
    block("definition", "含义", "βij 表示量测 j 属于航迹 i 的边缘概率，βi0 表示漏检事件。"),
    block("validation", "约束", "同一航迹各候选量测与漏检权重之和应为 1，并检查数值归一化。"),
  ]),
];

const addedEdges: KnowledgeEdge[] = [
  edge("slice-ls-alt-ml", "least-squares", "maximum-likelihood", "ALTERNATIVE_TO", "二者都是固定未知参数的估计准则；同方差高斯噪声下目标可等价。"),
  edge("slice-ml-alt-map", "maximum-likelihood", "map-estimation", "ALTERNATIVE_TO", "ML 只用似然，MAP 额外使用先验。"),
  edge("slice-map-alt-mmse", "map-estimation", "mmse-estimation", "ALTERNATIVE_TO", "二者使用同一后验，但分别取众数与平方损失下的均值。"),
  edge("slice-likelihood-pre-ml", "likelihood-function", "maximum-likelihood", "PREREQUISITE_OF", "ML 的目标由似然函数定义。"),
  edge("slice-likelihood-pre-map", "likelihood-function", "map-estimation", "PREREQUISITE_OF", "MAP 结合似然与先验形成后验。"),
  edge("slice-posterior-pre-map", "posterior-distribution", "map-estimation", "PREREQUISITE_OF", "MAP 从后验中取众数。"),
  edge("slice-posterior-pre-mmse", "posterior-distribution", "mmse-estimation", "PREREQUISITE_OF", "MMSE 对后验计算条件均值。"),
  edge("slice-innovation-input-mahal", "innovation", "mahalanobis-gate", "INPUT_TO", "马氏二次型使用创新向量。"),
  edge("slice-cov-input-mahal", "innovation-covariance", "mahalanobis-gate", "INPUT_TO", "创新协方差用于白化不同尺度与相关方向。"),
  edge("slice-mahal-input-gating", "mahalanobis-gate", "statistical-gating", "INPUT_TO", "马氏距离是统计门控的判决量，不是独立关联算法。"),
  edge("slice-chi-input-gating", "chi-square-threshold", "statistical-gating", "INPUT_TO", "卡方阈值给出椭球门判决边界。"),
  edge("slice-gating-pre-gnn", "statistical-gating", "gnn", "PREREQUISITE_OF", "GNN 先在验证门内建立有限候选分配。"),
  edge("slice-gating-pre-jpda", "statistical-gating", "jpda", "PREREQUISITE_OF", "JPDA 在门控形成的关联簇内构造联合事件。"),
  edge("slice-hungarian-implements-gnn", "hungarian-algorithm", "gnn", "IMPLEMENTS", "匈牙利算法常用于求解 GNN 的线性和分配。"),
  edge("slice-gnn-alt-jpda", "gnn", "jpda", "ALTERNATIVE_TO", "GNN 输出单一硬分配，JPDA 输出联合事件边缘概率。"),
  edge("slice-pda-sim-jpda", "pda", "jpda", "SIMILAR_TO", "二者都做概率加权，JPDA 进一步满足多目标联合互斥约束。"),
  edge("slice-hypothesis-pre-jpda", "association-hypothesis", "jpda", "PREREQUISITE_OF", "JPDA 需要对联合可行事件求概率并边缘化。"),
  edge("slice-beta-output-jpda", "association-probability", "jpda", "OUTPUT_OF", "关联概率 β 是 JPDA 的核心输出。"),
];

const updatedCards: DatasetPatch["updateCards"] = [
  { nodeId: "estimation", card: card("estimation", "参数与状态估计统一描述静态参数准则和动态状态递推。", [
    block("definition", "范围", "该分支同时包含 LS/ML/MAP/MMSE、运动模型、贝叶斯滤波、IMM 和一致性验证；并非所有内容都属于贝叶斯估计。"),
  ]) },
  { nodeId: "estimators", card: card("estimators", "LS、ML、MAP、MMSE 共同属于估计准则，但信息假设和优化目标不同。", [
    block("comparison", "四类目标", undefined, ["LS：最小残差。", "ML：最大似然。", "MAP：最大后验。", "MMSE：平方损失下最小后验风险。"]),
    block("misconception", "层级纠错", "不能把四者统称为似然估计；仅 ML 由似然最大化直接定义。"),
  ]) },
  { nodeId: "mahalanobis-gate", card: card("mahalanobis-gate", "马氏距离是协方差归一化的残差统计量，为门控和代价提供输入。", [
    block("principle", "角色", "d²=νᵀS⁻¹ν；它衡量量测与预测的统计距离，但本身不完成 GNN 或 JPDA 的分配。", undefined, ["formula-mahalanobis-gate"]),
    block("failure_mode", "协方差失配", "S 过小会拒绝真量测，S 过大会引入过多杂波。"),
  ], ["formula-mahalanobis-gate"]) },
  { nodeId: "gnn", card: card("gnn", "Global Nearest Neighbor 在全局一对一约束下求最小代价硬分配。", [
    block("procedure", "处理链", undefined, ["统计门控。", "构造代价矩阵。", "加入漏检/虚警代价。", "用线性分配求解器得到单一匹配。"]),
    block("misconception", "缩写消歧", "此处 GNN 指 Global Nearest Neighbor，不是 Graph Neural Network。"),
  ]) },
  { nodeId: "jpda", card: card("jpda", "JPDA 对联合可行关联事件求概率，再边缘化为各航迹的量测权重。", [
    block("principle", "软关联", "联合事件满足量测来源互斥约束；每条航迹使用边缘概率加权创新。"),
    block("failure_mode", "复杂度与航迹合并", "关联簇变大时事件数快速增长；共享量测更新还可能使相邻航迹趋同。"),
  ]) },
];

export const estimationAssociationSeedPatch: DatasetPatch = {
  id: "seed-estimation-association-v1",
  baseRevision: 1,
  addNodes: addedNodes,
  addCards: addedCards,
  addFormulas: formulas,
  addEdges: addedEdges,
  updateNodes: [
    { nodeId: "estimation", changes: { canonicalName: "参数与状态估计", shortFact: "估计准则、动态模型与递推滤波", domainId: "estimation" } },
    { nodeId: "estimators", changes: { canonicalName: "估计准则", shortFact: "LS / ML / MAP / MMSE", nodeType: "concept", domainId: "estimation" } },
    { nodeId: "mahalanobis-gate", changes: { canonicalName: "马氏距离（门控统计量）", shortFact: "协方差归一化残差，不是关联算法", nodeType: "metric", domainId: "association-tracking", primaryParentId: "statistical-gating", level: 4 } },
    { nodeId: "gnn", changes: { aliases: ["GNN", "Global Nearest Neighbor"], domainId: "association-tracking", primaryParentId: "deterministic-assignment", level: 4 } },
    { nodeId: "jpda", changes: { aliases: ["JPDA", "JPDAF", "Joint Probabilistic Data Association"], domainId: "association-tracking", primaryParentId: "probabilistic-association", level: 4 } },
    { nodeId: "gnn-association", changes: { aliases: ["GNN", "Graph Neural Network"], domainId: "ai-learning" } },
  ],
  updateCards: updatedCards,
};

export function applyDatasetPatch(dataset: KnowledgeDataset, patch: DatasetPatch): KnowledgeDataset {
  if (dataset.revision !== patch.baseRevision) {
    throw new Error(`Patch ${patch.id} expects revision ${patch.baseRevision}, received ${dataset.revision}`);
  }
  const nodeUpdates = new Map(patch.updateNodes.map((update) => [update.nodeId, update.changes]));
  const cardUpdates = new Map(patch.updateCards.map((update) => [update.nodeId, update.card]));
  return {
    revision: dataset.revision + 1,
    domains: dataset.domains.map((domain) => ({ ...domain })),
    nodes: [
      ...dataset.nodes.map((existing) => ({ ...existing, ...(nodeUpdates.get(existing.id) ?? {}) })),
      ...patch.addNodes,
    ],
    cards: [
      ...dataset.cards.map((existing) => cardUpdates.get(existing.nodeId) ?? existing),
      ...patch.addCards,
    ],
    formulas: [...dataset.formulas, ...patch.addFormulas],
    edges: [...dataset.edges, ...patch.addEdges],
  };
}

export const expandedKnowledgeDataset = applyDatasetPatch(legacyKnowledgeDataset, estimationAssociationSeedPatch);

/**
 * FMCW 毫米波雷达知识网络 —— 第一个 TaskProfile
 *
 * P3-2 逐步抽取：
 * - Step 1（已完成）：域定义抽取
 * - Step 2（待完成）：节点类型与边类型抽取
 * - Step 3（待完成）：栏目目录抽取
 * - Step 4（待完成）：审查规则配置化
 * - Step 5（待完成）：提示词抽取
 * - Step 6（待完成）：根节点与初始数据策略抽取
 * - Step 7（待完成）：Profile 加载机制与脚手架
 *
 * FMCW 基线零退化是红线：每步抽取后必须验证 FMCW 应用功能不变。
 */

import type { TaskProfile } from "../../../plugin/contracts/task-profile";
import { FMCW_PROMPTS } from "./prompts/fmcw-prompts";

/**
 * FMCW 毫米波雷达知识网络 Profile
 *
 * 11 个域按信号处理链路划分：
 * foundation（2）→ signal（3）→ data（4）→ system（1）→ ai（1）
 */
export const FMCW_PROFILE: TaskProfile = {
  id: "fmcw-radar",
  name: "FMCW 毫米波雷达知识网络",
  description: "FMCW 毫米波雷达的完整知识网络，覆盖从波形生成、信号处理、检测估计、关联跟踪到系统硬件和 AI 学习的全链路知识。",
  version: "0.1.0",
  schemaVersion: "task-profile/1",

  // ============================================================
  // Step 1：域定义（已完成抽取）
  // ============================================================
  domains: [
    {
      id: "physical-performance",
      name: "雷达物理与性能边界",
      description: "传播、散射、噪声、分辨率、模糊和链路性能。",
      visualBranch: "foundation",
      order: 0,
    },
    {
      id: "waveform-if",
      name: "FMCW 波形与 IF 形成",
      description: "Chirp、传播时延、去斜混频、拍频和数据立方体。",
      visualBranch: "foundation",
      order: 1,
    },
    {
      id: "nonideal-calibration",
      name: "非理想因素、标定与数据质量",
      description: "泄漏、相噪、杂散、量化、多径及通道校准。",
      visualBranch: "signal",
      order: 2,
    },
    {
      id: "spectral-rva",
      name: "距离、速度、角度与谱处理",
      description: "Range/Doppler/Angle 处理、加窗、插值和高分辨谱估计。",
      visualBranch: "signal",
      order: 3,
    },
    {
      id: "detection-measurement",
      name: "检测与量测形成",
      description: "积累、CFAR、Pd/Pfa、峰值和带协方差的量测输出。",
      visualBranch: "signal",
      order: 4,
    },
    {
      id: "clustering-object",
      name: "点云聚类与对象形成",
      description: "检测点聚类、对象外形与多量测表达。",
      visualBranch: "data",
      order: 5,
    },
    {
      id: "estimation",
      name: "参数与状态估计",
      description: "估计准则、状态空间、运动模型、滤波和一致性。",
      visualBranch: "data",
      order: 6,
    },
    {
      id: "association-tracking",
      name: "数据关联与航迹管理",
      description: "统计门控、分配、概率关联、航迹生命周期和身份。",
      visualBranch: "data",
      order: 7,
    },
    {
      id: "scene-events",
      name: "场景理解与事件",
      description: "停车、降雨、拥堵、扩展目标和密集场景。",
      visualBranch: "data",
      order: 8,
    },
    {
      id: "system-hardware",
      name: "RF、ADC、阵列、MIMO 与系统架构",
      description: "硬件预算、阵列几何、发射正交、同步和分布式融合。",
      visualBranch: "system",
      order: 9,
    },
    {
      id: "ai-learning",
      name: "AI 与学习式雷达",
      description: "模型驱动网络、学习检测关联、占据、域偏移和边缘部署。",
      visualBranch: "ai",
      order: 10,
    },
  ],

  // 5 个视觉分支（决定图谱画布颜色分组和布局）
  visualBranches: ["foundation", "signal", "data", "system", "ai"],

  // ============================================================
  // Step 2：节点类型与边类型（已完成抽取）
  // ============================================================
  // 11 种节点类型，每种硬编码规定"只放一个什么"和"禁止什么"
  nodeTypes: [
    { type: "domain", label: "知识域", singular: "一个知识域", forbidden: [], note: "分类节点，用于组织子节点，不承载具体知识内容", isGranularSensitive: false },
    { type: "category", label: "知识类别", singular: "一个可命名的知识类别", forbidden: ["具体知识细节", "多个分类维度"], note: "中间导航节点；按稳定维度归组子节点", isGranularSensitive: false },
    { type: "problem", label: "问题/现象", singular: "一个问题或现象", forbidden: ["解决方法", "算法", "子问题", "多个并列问题"], note: "只描述问题/现象本身（定义、原因、影响）；解决方法必须是独立的 method/algorithm 节点，通过 MITIGATES 等关系关联；子问题必须拆分为独立 problem 子节点", isGranularSensitive: true },
    { type: "concept", label: "概念", singular: "一个概念", forbidden: ["多个并列概念", "方法", "算法"], note: "只定义一个概念及其边界；多个并列概念必须拆分为独立 concept 子节点，共享共性父节点", isGranularSensitive: true },
    { type: "method", label: "方法", singular: "一个方法或解决方案", forbidden: ["多个并列方法", "问题描述", "概念定义"], note: "只描述一个方法的流程和实现；多个方法必须拆分为独立 method 子节点", isGranularSensitive: true },
    { type: "algorithm", label: "算法", singular: "一个算法", forbidden: ["多个并列算法", "问题描述"], note: "只描述一个算法的步骤、复杂度和实现；多个算法必须拆分", isGranularSensitive: true },
    { type: "model", label: "模型", singular: "一个模型", forbidden: ["多个并列模型", "问题描述"], note: "只描述一个模型的假设、公式和适用范围", isGranularSensitive: true },
    { type: "component", label: "组件", singular: "一个组件或硬件模块", forbidden: ["多个并列组件"], note: "只描述一个组件的功能、接口和特性", isGranularSensitive: false },
    { type: "artifact", label: "制品", singular: "一个制品、工具或数据集", forbidden: ["多个并列制品"], note: "只描述一个制品的用途、来源和使用方式", isGranularSensitive: false },
    { type: "parameter", label: "参数", singular: "一个参数", forbidden: ["多个并列参数"], note: "只描述一个参数的定义、取值范围和影响", isGranularSensitive: false },
    { type: "metric", label: "指标", singular: "一个指标", forbidden: ["多个并列指标"], note: "只描述一个指标的定义、计算方式和意义", isGranularSensitive: false },
    { type: "application", label: "应用", singular: "一个应用场景", forbidden: ["多个并列场景"], note: "只描述一个应用场景的需求、约束和方案", isGranularSensitive: false },
  ],
  // 12 种边类型，含方向定义（directed/symmetric）
  edgeTypes: [
    { type: "SIMILAR_TO", label: "相似于", direction: "symmetric", description: "两个节点在概念或功能上相似" },
    { type: "ALTERNATIVE_TO", label: "替代于", direction: "symmetric", description: "一个节点可以替代另一个节点" },
    { type: "PREREQUISITE_OF", label: "是...的前置", direction: "directed", description: "source 是理解 target 的前置知识" },
    { type: "PART_OF", label: "是...的一部分", direction: "directed", description: "source 是 target 的组成部分" },
    { type: "INPUT_TO", label: "输入到", direction: "directed", description: "source 是 target 的输入" },
    { type: "OUTPUT_OF", label: "是...的输出", direction: "directed", description: "source 是 target 的输出" },
    { type: "USES_MODEL", label: "使用模型", direction: "directed", description: "source 使用 target 模型" },
    { type: "IMPLEMENTS", label: "实现", direction: "directed", description: "source 实现了 target 方法/算法" },
    { type: "DERIVED_FROM", label: "派生自", direction: "directed", description: "source 派生自 target" },
    { type: "AFFECTS", label: "影响", direction: "directed", description: "source 影响 target" },
    { type: "MITIGATES", label: "缓解", direction: "directed", description: "source 方法/算法缓解了 target 问题/现象" },
    { type: "EVALUATED_BY", label: "由...评估", direction: "directed", description: "source 由 target 指标/方法评估" },
  ],

  // ============================================================
  // Step 3：栏目目录（已完成抽取）
  // ============================================================
  // 13 个知识卡栏目，含 coverage（core/conditional/optional）和 appliesTo
  cardSections: [
    { type: "definition", label: "定义与边界", definition: "说明对象是什么、不是什么，以及适用范围和与近邻概念的边界。", coverage: "core", appliesTo: "all", order: 10 },
    { type: "principle", label: "原理与推导", definition: "解释机制为何成立、关键因果链、数学依据或推导主线。", coverage: "core", appliesTo: ["problem", "concept", "method", "algorithm", "model", "component", "parameter", "metric"], order: 20 },
    { type: "assumptions", label: "成立假设", definition: "列出结论、模型或公式成立所依赖且可被检查的前提。", coverage: "conditional", appliesTo: ["concept", "method", "algorithm", "model", "parameter", "metric"], order: 30 },
    { type: "comparison", label: "同类方案比较", definition: "在同一问题与相同评价维度下比较可替代或相似方案。", coverage: "conditional", appliesTo: ["method", "algorithm", "model", "metric"], order: 40 },
    { type: "inputs_outputs", label: "输入与输出", definition: "明确方法、算法、组件或数据产物所消费与产生的数据、单位、形状和语义。", coverage: "conditional", appliesTo: ["method", "algorithm", "model", "component", "artifact", "application"], order: 50 },
    { type: "procedure", label: "实现步骤", definition: "给出可执行、可复现且有先后关系的工程或算法步骤。", coverage: "core", appliesTo: ["method", "algorithm", "component", "application"], order: 60 },
    { type: "engineering_tradeoff", label: "工程取舍", definition: "说明资源、精度、鲁棒性、时延、复杂度之间不可同时最优的选择。", coverage: "core", appliesTo: ["method", "algorithm", "model", "component", "parameter", "application"], order: 70 },
    { type: "failure_mode", label: "失效模式", definition: "描述何种条件下会失败、可观察症状、成因和影响。", coverage: "conditional", appliesTo: ["method", "algorithm", "model", "component", "application"], order: 80 },
    { type: "validation", label: "验证方法", definition: "给出可判定正确性的实验、指标、基线、数据与通过标准。", coverage: "core", appliesTo: ["method", "algorithm", "model", "component", "metric", "application"], order: 90 },
    { type: "application", label: "典型应用", definition: "说明知识在具体任务、场景或系统链路中的实际用途。", coverage: "optional", appliesTo: "all", order: 100 },
    { type: "research_topic", label: "研究热点", definition: "记录仍在演进的开放问题、新方法方向或尚未形成工程共识的议题。", coverage: "optional", appliesTo: ["problem", "concept", "method", "algorithm", "model", "application"], order: 110 },
    { type: "code", label: "最小实现", definition: "提供能表达核心运算的短代码、伪代码或关键 API 调用。", coverage: "optional", appliesTo: ["method", "algorithm", "model", "component", "application"], order: 120 },
    { type: "misconception", label: "常见误区", definition: "指出常见但错误或缺少前提的说法，并给出纠正后的表述。", coverage: "optional", appliesTo: "all", order: 130 },
  ],

  // ============================================================
  // Step 4：审查规则配置化（待抽取）
  // ============================================================
  validation: {
    domainCount: 11,
    visualBranchCount: 5,
    rootNodeRequired: true,
    maxPrimaryChildren: 8,
  },
  hierarchy: { enabled: true, intermediateNodeTypes: ["category"], planningThreshold: 6, maxDepth: 6 },

  // ============================================================
  // Step 5：提示词抽取（已完成）
  // ============================================================
  // 从 adaptive-research.ts / online-agent-service.ts / ingest/route.ts 抽取
  // 存储在 profiles/prompts/fmcw-prompts.ts，包含 react/review/finalResponse/ingest/topicAppendix
  prompts: FMCW_PROMPTS,

  // ============================================================
  // Step 6：根节点与初始数据策略（待抽取）
  // ============================================================
  initialization: {
    rootNode: {
      id: "fmcw",
      name: "FMCW 毫米波雷达",
      shortFact: "调频连续波雷达，通过发射线性调频信号并接收回波差频来同时测量距离和速度。",
    },
    mvp: {
      nodeCount: [15, 30],
      reactRounds: [2, 3],
      sectionsFilled: ["definition"],
      domainCount: [3, 5],
      durationMinutes: [2, 5],
    },
    full: {
      nodeCount: [80, 150],
      reactRounds: [6, 24],
      rootBudgetMinutes: [25, 35],
      durationMinutes: [25, 40],
    },
  },

  // 元数据
  createdAt: "2026-09-04",
  updatedAt: "2026-09-04",
  author: "knowmap-agent",
  tags: ["fmcw", "radar", "mmwave", "signal-processing"],
};

/**
 * FMCW 域 ID 类型（从 Profile.domains 提取，保持类型安全）
 * 用于替代 schema.ts 中硬编码的 SemanticDomainId
 */
export type FmcwDomainId = typeof FMCW_PROFILE.domains[number]["id"];

/**
 * 获取 FMCW Profile 的域 ID 列表
 */
export function getFmcwDomainIds(): string[] {
  return FMCW_PROFILE.domains.map((d) => d.id);
}

/**
 * 获取 FMCW Profile 的视觉分支列表
 */
export function getFmcwVisualBranches(): string[] {
  return [...FMCW_PROFILE.visualBranches];
}

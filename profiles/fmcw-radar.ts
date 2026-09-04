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

import type { TaskProfile } from "../plugin/contracts/task-profile";

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
  // Step 3：栏目目录（待抽取，当前使用 CARD_SECTION_CATALOG）
  // ============================================================
  cardSections: [],  // Step 3 填充

  // ============================================================
  // Step 4：审查规则配置化（待抽取）
  // ============================================================
  validation: {
    domainCount: 11,
    visualBranchCount: 5,
    rootNodeRequired: true,
  },

  // ============================================================
  // Step 5：提示词抽取（待抽取）
  // ============================================================
  prompts: {
    react: "",        // Step 5 填充：从 adaptive-research.ts 抽取
    review: "",       // Step 5 填充
    finalResponse: "", // Step 5 填充
    ingest: {},       // Step 5 填充：从 ingest/route.ts 抽取
  },

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

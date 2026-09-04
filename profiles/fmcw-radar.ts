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
  // Step 2：节点类型与边类型（待抽取，当前使用基础类型）
  // ============================================================
  nodeTypes: [],  // Step 2 填充：从 schema.ts 的 NODE_TYPE_SEMANTICS 抽取
  edgeTypes: [],  // Step 2 填充：从 schema.ts 的 EdgeType 抽取

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

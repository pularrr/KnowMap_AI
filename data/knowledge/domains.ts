import type { SemanticDomain } from "@/core/knowledge/schema";

export const semanticDomains: SemanticDomain[] = [
  { id: "physical-performance", name: "雷达物理与性能边界", description: "传播、散射、噪声、分辨率、模糊和链路性能。", visualBranch: "foundation", order: 0 },
  { id: "waveform-if", name: "FMCW 波形与 IF 形成", description: "Chirp、传播时延、去斜混频、拍频和数据立方体。", visualBranch: "foundation", order: 1 },
  { id: "nonideal-calibration", name: "非理想因素、标定与数据质量", description: "泄漏、相噪、杂散、量化、多径及通道校准。", visualBranch: "signal", order: 2 },
  { id: "spectral-rva", name: "距离、速度、角度与谱处理", description: "Range/Doppler/Angle 处理、加窗、插值和高分辨谱估计。", visualBranch: "signal", order: 3 },
  { id: "detection-measurement", name: "检测与量测形成", description: "积累、CFAR、Pd/Pfa、峰值和带协方差的量测输出。", visualBranch: "signal", order: 4 },
  { id: "clustering-object", name: "点云聚类与对象形成", description: "检测点聚类、对象外形与多量测表达。", visualBranch: "data", order: 5 },
  { id: "estimation", name: "参数与状态估计", description: "估计准则、状态空间、运动模型、滤波和一致性。", visualBranch: "data", order: 6 },
  { id: "association-tracking", name: "数据关联与航迹管理", description: "统计门控、分配、概率关联、航迹生命周期和身份。", visualBranch: "data", order: 7 },
  { id: "scene-events", name: "场景理解与事件", description: "停车、降雨、拥堵、扩展目标和密集场景。", visualBranch: "data", order: 8 },
  { id: "system-hardware", name: "RF、ADC、阵列、MIMO 与系统架构", description: "硬件预算、阵列几何、发射正交、同步和分布式融合。", visualBranch: "system", order: 9 },
  { id: "ai-learning", name: "AI 与学习式雷达", description: "模型驱动网络、学习检测关联、占据、域偏移和边缘部署。", visualBranch: "ai", order: 10 },
];

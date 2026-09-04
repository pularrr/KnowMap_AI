/**
 * 知识生成器（LLM 驱动，含分布式生成）
 *
 * P3-4：根据主题 + Profile，自动生成初始知识网络。
 *
 * 设计流程：
 * 1. MVP 阶段：15-30 节点，只填 definition，2-3 轮 ReAct，2-5 分钟
 * 2. 用户确认：展示 MVP 骨架，用户判断方向是否正确，可调整
 * 3. 完整开发：80-150 节点，5+ 栏目，6-24 轮 ReAct，25-40 分钟
 * 4. 分布式子调用：gaps>3 或 newNodes>8 时拆分，每组 2 个 gap，输入上限 60000 字符
 *
 * 复用 FMCW 的自适应 ReAct 机制和节点粒度硬约束。
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type { LlmProvider, LlmMessage } from "../../core/llm/contracts";
import { structuredOutputCall } from "../llm/structured-output";
import type { TaskProfile } from "../../plugin/contracts/task-profile";
import { collectAdaptiveResearch } from "./adaptive-research";
import type { KnowledgeDataset, KnowledgeNode as DatasetNode, KnowledgeCard, KnowledgeEdge, SemanticDomain } from "../../core/knowledge/schema";
import type { ResearchDocument } from "./research-output";

/**
 * 知识节点
 */
export interface KnowledgeNode {
  id: string;
  canonicalName: string;
  shortFact: string;
  nodeType: string;
  parentId: string;
  domainId?: string;
  order?: number;
}

/**
 * 知识卡片块
 */
export interface KnowledgeCardBlock {
  nodeId: string;
  type: string;
  title: string;
  text: string;
}

/**
 * 知识关系
 */
export interface KnowledgeRelation {
  sourceId: string;
  targetId: string;
  type: string;
  rationale: string;
}

/**
 * 知识网络
 */
export interface KnowledgeNetwork {
  nodes: KnowledgeNode[];
  cardBlocks: KnowledgeCardBlock[];
  relations: KnowledgeRelation[];
}

/**
 * 生成模式
 */
export type GenerationMode = "mvp" | "full";

/**
 * 生成结果
 */
export interface GenerationResult {
  network: KnowledgeNetwork;
  mode: GenerationMode;
  iterations: number;
  totalNodes: number;
  totalCardBlocks: number;
  totalRelations: number;
  distributedCalls: number;
  warnings: string[];
  converged: boolean;
}

/**
 * ReAct 观察结果
 */
interface ReActObservation {
  gaps: string[];
  newNodeCandidates: number;
  coverageScore: number;
}


/**
 * 把 KnowledgeNetwork 转换为 KnowledgeDataset（适配 collectAdaptiveResearch）
 */
function networkToDataset(network: KnowledgeNetwork, profile: TaskProfile): KnowledgeDataset {
  const domains = profile.domains.map((d, i) => ({
    id: d.id as any,
    name: d.name,
    description: d.description,
    visualBranch: d.visualBranch as any,
    order: i,
  }));

  const nodes = network.nodes.map((n) => ({
    id: n.id,
    canonicalName: n.canonicalName,
    shortFact: n.shortFact,
    nodeType: n.nodeType as any,
    primaryParentId: n.parentId || null,
    domainId: (n.domainId || null) as any,
    order: n.order ?? 0,
    visualBranch: null as any,
    aliases: [],
    tags: [],
    level: 0,
    status: "active" as any,
  }));

  const cards = network.cardBlocks.map((b, i) => ({
    id: `card-${i}`,
    nodeId: b.nodeId,
    headline: b.title,
    blocks: [{ type: b.type as any, title: b.title, contentText: b.text }],
    formulaIds: [],
    evidenceIds: [],
    revision: 1,
  }));

  const edges = network.relations.map((r, i) => ({
    id: `edge-${i}`,
    sourceId: r.sourceId,
    targetId: r.targetId,
    type: r.type as any,
    rationale: r.rationale,
    weight: 1,
    status: "active" as any,
    evidenceIds: [],
  }));

  return {
    revision: 1,
    domains: domains as any,
    nodes: nodes as any,
    cards: cards as any,
    formulas: [],
    edges: edges as any,
  } as KnowledgeDataset;
}

/**
 * 把 ResearchDocument 合并到 KnowledgeNetwork
 */
function mergeResearchToNetwork(network: KnowledgeNetwork, doc: ResearchDocument): KnowledgeNetwork {
  const existingNodeIds = new Set(network.nodes.map((n) => n.id));
  const existingNodeNames = new Set(network.nodes.map((n) => n.canonicalName.toLowerCase()));
  const existingCardKeys = new Set(network.cardBlocks.map((c) => `${c.nodeId}:${c.type}`));
  const existingRelationKeys = new Set(network.relations.map((r) => `${r.sourceId}:${r.targetId}:${r.type}`));

  // 合并新节点
  const newNodes = doc.proposal.newNodes
    .filter((n) => n.id && !existingNodeIds.has(n.id) && !existingNodeNames.has(n.canonicalName.toLowerCase()))
    .map((n) => ({
      id: n.id!,
      canonicalName: n.canonicalName,
      shortFact: n.shortFact,
      nodeType: n.nodeType,
      parentId: n.parentId || "",
    }));

  // 合并新卡片（包括节点内嵌的 blocks）
  const allCardBlocks = [
    ...doc.proposal.cardBlocks,
    ...doc.proposal.newNodes.flatMap((n) => (n.blocks || []).map((b) => ({ ...b, nodeId: n.id || b.nodeId }))),
  ];
  const newCardBlocks = allCardBlocks
    .filter((b) => b.nodeId && !existingCardKeys.has(`${b.nodeId}:${b.type}`))
    .map((b) => ({
      nodeId: b.nodeId!,
      type: b.type,
      title: b.title,
      text: b.text,
    }));

  // 合并新关系
  const newRelations = doc.proposal.relations
    .filter((r) => !existingRelationKeys.has(`${r.sourceId}:${r.targetId}:${r.type}`))
    .map((r) => ({
      sourceId: r.sourceId,
      targetId: r.targetId,
      type: r.type,
      rationale: r.rationale,
    }));

  return {
    nodes: [...network.nodes, ...newNodes],
    cardBlocks: [...network.cardBlocks, ...newCardBlocks],
    relations: [...network.relations, ...newRelations],
  };
}

/**
 * 知识生成器
 */
export class KnowledgeGenerator {
  private provider: LlmProvider;
  private profile: TaskProfile;
  private topic: string;
  private mode: GenerationMode;
  private maxIterations: number;
  private targetNodeCount: [number, number];
  private warnings: string[] = [];
  private distributedCalls: number = 0;

  constructor(provider: LlmProvider, topic: string, profile: TaskProfile, mode: GenerationMode = "mvp") {
    this.provider = provider;
    this.topic = topic;
    this.profile = profile;
    this.mode = mode;

    // 根据模式设置参数
    if (mode === "mvp") {
      this.maxIterations = profile.initialization.mvp.reactRounds[1];
      this.targetNodeCount = profile.initialization.mvp.nodeCount;
    } else {
      this.maxIterations = profile.initialization.full.reactRounds[1];
      this.targetNodeCount = profile.initialization.full.nodeCount;
    }
  }

  /**
   * 通用结构化输出调用封装
   */
  private async callStructured<T>(
    instructions: string,
    userContent: string,
    validator: (data: unknown) => T,
    maxOutputTokens: number = 8192
  ): Promise<T> {
    const messages: LlmMessage[] = [{ role: "user", content: userContent }];
    const result = await structuredOutputCall(this.provider, instructions, messages, validator, {
      maxOutputTokens,
      maxRetries: 3,
      onDiagnostic: (msg) => this.warnings.push(msg),
    });
    if (result.attempts > 1) {
      this.warnings.push(`LLM 调用重试 ${result.attempts - 1} 次后成功`);
    }
    if (result.recoveredFromIncomplete) {
      this.warnings.push("从不完整输出中恢复结构化数据");
    }
    return result.data;
  }

  /**
   * 初始化知识网络（根节点 + 所有域节点骨架）
   * 这样第一轮 ReAct 就有了明确的骨架，LLM 知道从哪里开始
   */
  private initializeNetwork(): KnowledgeNetwork {
    const rootNode = this.profile.initialization.rootNode;
    const nodes: KnowledgeNode[] = [
      {
        id: rootNode.id,
        canonicalName: rootNode.name,
        shortFact: rootNode.shortFact,
        nodeType: "domain",
        parentId: "",
        order: 0,
      },
    ];
    const cardBlocks: KnowledgeCardBlock[] = [
      {
        nodeId: rootNode.id,
        type: "definition",
        title: "定义与边界",
        text: rootNode.shortFact,
      },
    ];
    const relations: KnowledgeRelation[] = [];

    // 创建所有域节点作为骨架
    this.profile.domains.forEach((domain, index) => {
      const domainNodeId = domain.id;
      nodes.push({
        id: domainNodeId,
        canonicalName: domain.name,
        shortFact: domain.description,
        nodeType: "domain",
        parentId: rootNode.id,
        domainId: domain.id,
        order: index + 1,
      });
      cardBlocks.push({
        nodeId: domainNodeId,
        type: "definition",
        title: "定义与边界",
        text: domain.description,
      });
      // 根节点到域节点的 PART_OF 关系
      relations.push({
        sourceId: rootNode.id,
        targetId: domainNodeId,
        type: "PART_OF",
        rationale: `${domain.name} 是 ${rootNode.name} 的一个语义域`,
      });
    });

    return { nodes, cardBlocks, relations };
  }

  /**
   * 执行完整的知识生成流程
   * 真正复用 FMCW 的 collectAdaptiveResearch（逐节点 ReAct 重置、自适应预算、
   * 上下文管理、分布式子调用、批量合并、收敛判断）
   */
  async generate(): Promise<GenerationResult> {
    this.warnings = [];
    this.distributedCalls = 0;

    // Step 1: 初始化网络（根节点 + 所有域节点骨架）
    let network = this.initializeNetwork();
    this.warnings.push(
      `初始化完成：根节点 + ${this.profile.domains.length} 个域节点骨架，共 ${network.nodes.length} 节点`
    );

    // Step 2: 转换为 KnowledgeDataset（适配 collectAdaptiveResearch）
    const dataset = networkToDataset(network, this.profile);
    const rootNodeId = this.profile.initialization.rootNode.id;
    const runId = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Step 3: 根据模式设置预算覆盖
    // MVP 模式：缩短预算，快速生成骨架
    // 完整开发模式：使用 Profile 配置的完整预算
    const budgetOverride = this.mode === "mvp"
      ? {
          minRounds: 2,
          initialRounds: 3,
          maxNodeRounds: 6,
          maxCalls: 30,
          maxNodes: 30,
          minDurationMs: 0,
          maxDurationMs: 5 * 60_000, // MVP 最多 5 分钟
        }
      : undefined; // 完整开发模式使用默认预算（根节点 25-35 分钟）

    this.warnings.push(
      `开始深度检索：模式=${this.mode}，目标节点数=${this.targetNodeCount[0]}-${this.targetNodeCount[1]}，` +
      (budgetOverride ? `MVP预算覆盖：maxNodes=${budgetOverride.maxNodes}，maxDuration=${budgetOverride.maxDurationMs / 60000}分钟` : "完整开发预算（根节点25-35分钟）")
    );

    // Step 4: 调用 collectAdaptiveResearch（真正复用 FMCW 的 ReAct 机制）
    const observations: any[] = [];
    const doc = await collectAdaptiveResearch({
      provider: this.provider,
      dataset,
      nodeId: rootNodeId,
      query: `生成${this.topic}知识网络，覆盖${this.profile.domains.map((d) => d.name).join("、")}等领域`,
      runId,
      root: true,
      observations,
      budgetOverride,
      profile: this.profile, // 注入 Profile 配置
      onProgress: (msg) => {
        this.warnings.push(msg);
      },
    });

    // Step 5: 把 ResearchDocument 合并到 KnowledgeNetwork
    const beforeCount = network.nodes.length;
    network = mergeResearchToNetwork(network, doc);
    const afterCount = network.nodes.length;
    const addedCount = afterCount - beforeCount;

    this.warnings.push(
      `深度检索完成：新增 ${addedCount} 节点 / ${doc.proposal.cardBlocks.length} 卡片 / ${doc.proposal.relations.length} 关系，` +
      `当前共 ${afterCount} 节点 / ${network.cardBlocks.length} 卡片 / ${network.relations.length} 关系`
    );
    this.warnings.push(`覆盖度评估：${doc.coverageAssessment}`);
    if (doc.gaps.length > 0) {
      this.warnings.push(`剩余知识缺口（${doc.gaps.length}个）：${doc.gaps.slice(0, 5).join("；")}${doc.gaps.length > 5 ? "..." : ""}`);
    }

    // Step 6: 最终校验（结构校验 + 节点粒度审查）
    const validationWarnings = this.validateNetwork(network);
    this.warnings.push(...validationWarnings);

    return {
      network,
      mode: this.mode,
      iterations: observations.length,
      totalNodes: network.nodes.length,
      totalCardBlocks: network.cardBlocks.length,
      totalRelations: network.relations.length,
      distributedCalls: this.distributedCalls,
      warnings: this.warnings,
      converged: doc.converged,
    };
  }

  /**
   * 最终校验：结构校验 + 节点粒度审查
   */
  private validateNetwork(network: KnowledgeNetwork): string[] {
    const warnings: string[] = [];

    // 结构校验：边端点存在
    const nodeIds = new Set(network.nodes.map((n) => n.id));
    for (const rel of network.relations) {
      if (!nodeIds.has(rel.sourceId)) {
        warnings.push(`关系端点不存在：source=${rel.sourceId}`);
      }
      if (!nodeIds.has(rel.targetId)) {
        warnings.push(`关系端点不存在：target=${rel.targetId}`);
      }
    }

    // 节点粒度审查：多概念节点（名称含并列连词）
    const granularTypes = ["concept", "method", "algorithm", "model", "problem", "parameter", "metric", "application"];
    for (const node of network.nodes) {
      if (!granularTypes.includes(node.nodeType)) continue;
      // 检查名称是否含并列连词
      if (/[、/与和及]/.test(node.canonicalName) && node.canonicalName.length > 5) {
        warnings.push(`可能的多概念节点：${node.id}(${node.canonicalName})，建议拆分为子节点`);
      }
      // 检查名称是否过长
      if (node.canonicalName.length > 20) {
        warnings.push(`节点名称过长：${node.id}(${node.canonicalName.length}字)，建议缩短`);
      }
      // 检查 shortFact 是否过长
      if (node.shortFact.length > 80) {
        warnings.push(`节点摘要过长：${node.id}(${node.shortFact.length}字)，建议精简`);
      }
    }

    // problem 节点是否混入解决方法
    for (const node of network.nodes) {
      if (node.nodeType !== "problem") continue;
      if (/方法|算法|解决|方案|技术|模型/.test(node.shortFact)) {
        warnings.push(`problem节点可能混入解决方法：${node.id}，建议拆分为独立的method/algorithm节点`);
      }
    }

    if (warnings.length > 0) {
      warnings.unshift(`最终校验：发现 ${warnings.length} 个潜在问题（warning级别，不影响使用）`);
    } else {
      warnings.push("最终校验：通过，未发现结构或节点粒度问题");
    }

    return warnings;
  }

    writeNetworkToFile(network: KnowledgeNetwork, outputPath?: string): string {
    const filePath = outputPath || join(process.cwd(), "data", "runtime", `generated-${this.mode}-${Date.now()}.json`);
    writeFileSync(filePath, JSON.stringify(network, null, 2), "utf8");
    return filePath;
  }
}

export default KnowledgeGenerator;

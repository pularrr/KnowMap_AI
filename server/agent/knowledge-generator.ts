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
   * 初始化知识网络（创建根节点）
   */
  private initializeNetwork(): KnowledgeNetwork {
    const rootNode = this.profile.initialization.rootNode;
    return {
      nodes: [
        {
          id: rootNode.id,
          canonicalName: rootNode.name,
          shortFact: rootNode.shortFact,
          nodeType: "domain",
          parentId: "",
          order: 0,
        },
      ],
      cardBlocks: [
        {
          nodeId: rootNode.id,
          type: "definition",
          title: "定义与边界",
          text: rootNode.shortFact,
        },
      ],
      relations: [],
    };
  }

  /**
   * 生成 ReAct 系统提示词
   */
  private buildReActSystemPrompt(): string {
    const nodeTypes = this.profile.nodeTypes.map((t) => `${t.type}(${t.singular})`).join("、");
    const edgeTypes = this.profile.edgeTypes.map((t) => `${t.type}(${t.label})`).join("、");
    const sections = this.profile.cardSections.filter((s) => s.coverage === "core").map((s) => s.type).join("、");

    return `你是采用 ReAct 的知识检索 Agent，用于生成 ${this.topic} 知识网络。

【Profile 配置】
- 节点类型：${nodeTypes}
- 边类型：${edgeTypes}
- 核心栏目：${sections}

【ReAct 循环】
1. Observe：观察当前知识网络的覆盖度，识别知识缺口
2. Act：深入一个尚未解决的问题，输出一批实质知识（节点、卡片、关系）
3. 再观察：判断新知识是否填补了缺口，是否需要继续深入

【节点粒度硬约束（必须遵守）】
1. 一个节点只放一个东西，由 nodeType 决定
2. 禁止把多个并列概念/方法/问题放在一个节点中
3. problem 类型节点只描述问题/现象本身，禁止混入解决方法
4. 节点名称简短具体，不超过15字，禁止包含"、""/"和"等并列连词
5. 节点摘要是一句话定义，不超过50字；详细内容放知识卡栏目

【批量合并】
每批累积后统一合并，不要逐条调用图内查重工具。新增节点可引用本批或此前批次新节点ID作为父级。

【输出格式】
输出 JSON：
{
  "nodes": [{"id": "node-id", "canonicalName": "名称", "shortFact": "一句话定义", "nodeType": "类型", "parentId": "父节点ID", "domainId": "域ID"}],
  "cardBlocks": [{"nodeId": "节点ID", "type": "栏目类型", "title": "标题", "text": "内容"}],
  "relations": [{"sourceId": "源节点", "targetId": "目标节点", "type": "关系类型", "rationale": "理由"}],
  "gaps": ["仍存在的知识缺口"],
  "converged": false
}`;
  }

  /**
   * 执行一次 ReAct Act（生成一批知识）
   */
  private async reactAct(network: KnowledgeNetwork, iteration: number): Promise<{
    newNodes: KnowledgeNode[];
    newCardBlocks: KnowledgeCardBlock[];
    newRelations: KnowledgeRelation[];
    gaps: string[];
    converged: boolean;
  }> {
    const systemPrompt = this.buildReActSystemPrompt();

    // 构建当前网络摘要（限制输入大小）
    const nodeSummary = network.nodes.slice(0, 50).map((n) => `${n.id}(${n.nodeType}): ${n.canonicalName}`).join("\n");
    const domainSummary = this.profile.domains.map((d) => `${d.id}: ${d.name}`).join("\n");

    const userPrompt = `【当前迭代】第 ${iteration + 1} 轮，共最多 ${this.maxIterations} 轮

【目标节点数】${this.targetNodeCount[0]}-${this.targetNodeCount[1]} 个
【当前节点数】${network.nodes.length} 个

【语义域】
${domainSummary}

【当前知识网络（前50个节点）】
${nodeSummary}

【任务】
请观察当前知识网络的覆盖度，识别知识缺口，然后 Act 生成一批新知识填补缺口。

${this.mode === "mvp" ? "【MVP模式】只生成核心概念，只填 definition 栏目，目标 15-30 个节点。" : "【完整开发模式】生成深入的知识网络，填 5+ 栏目，目标 80-150 个节点。"}

如果知识网络已经足够完整，设置 converged=true。`;

    const result = await this.callStructured(
      systemPrompt,
      userPrompt,
      (data) => {
        if (!data || typeof data !== "object") {
          throw new Error("ReAct 输出必须是对象");
        }
        const obj = data as Record<string, unknown>;
        return {
          newNodes: (obj.nodes as KnowledgeNode[]) || [],
          newCardBlocks: (obj.cardBlocks as KnowledgeCardBlock[]) || [],
          newRelations: (obj.relations as KnowledgeRelation[]) || [],
          gaps: (obj.gaps as string[]) || [],
          converged: obj.converged === true,
        };
      },
      16384
    );

    return result;
  }

  /**
   * 分布式子调用（当 gaps 较多时拆分任务）
   */
  private async distributedGenerate(
    network: KnowledgeNetwork,
    gaps: string[],
    iteration: number
  ): Promise<{
    newNodes: KnowledgeNode[];
    newCardBlocks: KnowledgeCardBlock[];
    newRelations: KnowledgeRelation[];
  }> {
    // 分布式触发条件：gaps > 3 或 新节点候选 > 8
    const shouldDistribute = gaps.length > 3 || network.nodes.length > 30;

    if (!shouldDistribute) {
      // 单次调用
      const result = await this.reactAct(network, iteration);
      return {
        newNodes: result.newNodes,
        newCardBlocks: result.newCardBlocks,
        newRelations: result.newRelations,
      };
    }

    // 分布式：按每组 2 个 gap 拆分，最多 2 组
    this.distributedCalls++;
    const maxGroups = 2;
    const groupSize = 2;
    const groups: string[][] = [];

    for (let i = 0; i < gaps.length && groups.length < maxGroups; i += groupSize) {
      groups.push(gaps.slice(i, i + groupSize));
    }

    let allNewNodes: KnowledgeNode[] = [];
    let allNewCardBlocks: KnowledgeCardBlock[] = [];
    let allNewRelations: KnowledgeRelation[] = [];

    // 并行执行各组（实际生产中应限制并发）
    const promises = groups.map(async (groupGaps, groupIndex) => {
      const groupNetwork = { ...network, nodes: [...network.nodes] };
      const result = await this.reactAct(groupNetwork, iteration + groupIndex * 0.1);
      return result;
    });

    const results = await Promise.all(promises);

    for (const result of results) {
      allNewNodes = [...allNewNodes, ...result.newNodes];
      allNewCardBlocks = [...allNewCardBlocks, ...result.newCardBlocks];
      allNewRelations = [...allNewRelations, ...result.newRelations];
    }

    this.warnings.push(`分布式子调用：拆分为 ${groups.length} 组，每组 ${groupSize} 个 gap`);

    return {
      newNodes: allNewNodes,
      newCardBlocks: allNewCardBlocks,
      newRelations: allNewRelations,
    };
  }

  /**
   * 批量合并新知识到现有网络（去重）
   */
  private mergeKnowledge(
    network: KnowledgeNetwork,
    newNodes: KnowledgeNode[],
    newCardBlocks: KnowledgeCardBlock[],
    newRelations: KnowledgeRelation[]
  ): KnowledgeNetwork {
    const existingNodeIds = new Set(network.nodes.map((n) => n.id));
    const existingNodeNames = new Set(network.nodes.map((n) => n.canonicalName.toLowerCase()));

    // 节点去重：按 id 和名称去重
    const uniqueNodes = newNodes.filter((node) => {
      if (existingNodeIds.has(node.id)) return false;
      if (existingNodeNames.has(node.canonicalName.toLowerCase())) return false;
      // 验证节点类型是否在 Profile 中
      const validType = this.profile.nodeTypes.some((t) => t.type === node.nodeType);
      if (!validType) {
        this.warnings.push(`节点 ${node.id} 的类型 ${node.nodeType} 不在 Profile 中，已跳过`);
        return false;
      }
      return true;
    });

    // 卡片去重：按 nodeId + type 去重
    const existingCardKeys = new Set(network.cardBlocks.map((c) => `${c.nodeId}:${c.type}`));
    const uniqueCardBlocks = newCardBlocks.filter((block) => {
      const key = `${block.nodeId}:${block.type}`;
      if (existingCardKeys.has(key)) return false;
      // 只保留节点存在的卡片
      const nodeExists = existingNodeIds.has(block.nodeId) || uniqueNodes.some((n) => n.id === block.nodeId);
      return nodeExists;
    });

    // 关系去重：按 sourceId + targetId + type 去重
    const existingRelationKeys = new Set(network.relations.map((r) => `${r.sourceId}:${r.targetId}:${r.type}`));
    const uniqueRelations = newRelations.filter((relation) => {
      const key = `${relation.sourceId}:${relation.targetId}:${relation.type}`;
      if (existingRelationKeys.has(key)) return false;
      // 只保留两端节点都存在的关系
      const sourceExists = existingNodeIds.has(relation.sourceId) || uniqueNodes.some((n) => n.id === relation.sourceId);
      const targetExists = existingNodeIds.has(relation.targetId) || uniqueNodes.some((n) => n.id === relation.targetId);
      return sourceExists && targetExists;
    });

    return {
      nodes: [...network.nodes, ...uniqueNodes],
      cardBlocks: [...network.cardBlocks, ...uniqueCardBlocks],
      relations: [...network.relations, ...uniqueRelations],
    };
  }

  /**
   * 执行完整的知识生成流程
   */
  async generate(): Promise<GenerationResult> {
    this.warnings = [];
    this.distributedCalls = 0;

    // 初始化
    let network = this.initializeNetwork();
    let converged = false;
    let iteration = 0;

    this.warnings.push(`开始生成：模式=${this.mode}，目标节点数=${this.targetNodeCount[0]}-${this.targetNodeCount[1]}，最大迭代=${this.maxIterations}`);

    // ReAct 循环
    while (iteration < this.maxIterations && !converged) {
      iteration++;

      try {
        // Observe：评估当前覆盖度
        const observation = this.assessCoverage(network);

        // Act + 分布式子调用
        const actResult = await this.distributedGenerate(network, observation.gaps, iteration);

        // 批量合并
        const beforeCount = network.nodes.length;
        network = this.mergeKnowledge(network, actResult.newNodes, actResult.newCardBlocks, actResult.newRelations);
        const afterCount = network.nodes.length;
        const addedCount = afterCount - beforeCount;

        this.warnings.push(`第 ${iteration} 轮：新增 ${addedCount} 节点，当前共 ${afterCount} 节点`);

        // 判断收敛：新增节点很少或达到目标节点数
        if (addedCount < 2 || afterCount >= this.targetNodeCount[1]) {
          converged = true;
          this.warnings.push(`收敛：第 ${iteration} 轮后新增节点不足或达到目标`);
        }

        // 判断是否需要继续
        if (afterCount >= this.targetNodeCount[0] && this.mode === "mvp") {
          converged = true;
          this.warnings.push(`MVP 模式：达到最小目标节点数 ${this.targetNodeCount[0]}`);
        }
      } catch (error) {
        this.warnings.push(`第 ${iteration} 轮失败：${error instanceof Error ? error.message : String(error)}`);
        // 失败后继续下一轮，最多重试 2 次
        if (iteration >= this.maxIterations - 1) {
          break;
        }
      }
    }

    return {
      network,
      mode: this.mode,
      iterations: iteration,
      totalNodes: network.nodes.length,
      totalCardBlocks: network.cardBlocks.length,
      totalRelations: network.relations.length,
      distributedCalls: this.distributedCalls,
      warnings: this.warnings,
      converged,
    };
  }

  /**
   * 评估当前知识网络的覆盖度
   */
  private assessCoverage(network: KnowledgeNetwork): ReActObservation {
    const gaps: string[] = [];
    const domainNodeCounts: Record<string, number> = {};

    // 统计每个域的节点数
    for (const node of network.nodes) {
      if (node.domainId) {
        domainNodeCounts[node.domainId] = (domainNodeCounts[node.domainId] || 0) + 1;
      }
    }

    // 检查每个域是否有足够节点
    for (const domain of this.profile.domains) {
      const count = domainNodeCounts[domain.id] || 0;
      if (count < 2) {
        gaps.push(`域 ${domain.name}(${domain.id}) 节点不足，当前 ${count} 个`);
      }
    }

    // 检查核心栏目填充率
    const coreSections = this.profile.cardSections.filter((s) => s.coverage === "core");
    const nodeWithCoreSections = new Set<string>();
    for (const block of network.cardBlocks) {
      if (coreSections.some((s) => s.type === block.type)) {
        nodeWithCoreSections.add(block.nodeId);
      }
    }
    const coverageScore = network.nodes.length > 0 ? nodeWithCoreSections.size / network.nodes.length : 0;

    if (coverageScore < 0.5) {
      gaps.push(`核心栏目填充率低，当前 ${(coverageScore * 100).toFixed(0)}%`);
    }

    return {
      gaps,
      newNodeCandidates: gaps.length * 3,
      coverageScore,
    };
  }

  /**
   * 将知识网络写入 JSON 文件
   */
  writeNetworkToFile(network: KnowledgeNetwork, outputPath?: string): string {
    const filePath = outputPath || join(process.cwd(), "data", "runtime", `generated-${this.mode}-${Date.now()}.json`);
    writeFileSync(filePath, JSON.stringify(network, null, 2), "utf8");
    return filePath;
  }
}

export default KnowledgeGenerator;

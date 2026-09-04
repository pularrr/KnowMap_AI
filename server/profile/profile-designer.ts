/**
 * Profile 设计器（LLM 驱动）
 *
 * P3-3：通用 LLM 根据用户的任务描述，自动设计一个完整的 TaskProfile。
 *
 * 设计流程：
 * 1. 域划分设计：LLM 设计 3-8 个语义域和 3-5 个视觉分支
 * 2. 类型系统设计：基于基础 11 种节点类型 + 12 种边类型，可扩展主题特定类型
 * 3. 栏目与提示词设计：复用基础 13 个栏目，提示词基于 FMCW 模板替换主题内容
 * 4. 初始化策略设计：MVP vs 完整开发参数
 * 5. 校验+修复循环：检查是否符合契约 schema，不符合则让 LLM 修复（最多 3 轮）
 *
 * 参考 FMCW Profile 作为模板，保证设计质量下限。
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import type {
  TaskProfile,
  DomainDef,
  NodeTypeDef,
  EdgeTypeDef,
  CardSectionDef,
  PromptConfig,
} from "../../plugin/contracts/task-profile";
import { BASE_NODE_TYPES, BASE_EDGE_TYPES } from "../../plugin/contracts/task-profile";

/**
 * LLM 配置
 */
interface LLMConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

/**
 * Profile 设计结果
 */
export interface ProfileDesignResult {
  profile: TaskProfile;
  iterations: number;
  validationIssues: string[];
  warnings: string[];
}

/**
 * 设计步骤
 */
type DesignStep = "domains" | "types" | "sections" | "prompts" | "initialization" | "validation";

/**
 * Profile 设计器
 */
export class ProfileDesigner {
  private llmConfig: LLMConfig;
  private maxIterations: number = 3;
  private topic: string;
  private taskDescription: string;

  constructor(topic: string, taskDescription: string) {
    this.topic = topic;
    this.taskDescription = taskDescription;
    this.llmConfig = this.loadLLMConfig();
  }

  /**
   * 加载 LLM 配置
   */
  private loadLLMConfig(): LLMConfig {
    try {
      const configPath = join(process.cwd(), "data", "runtime", "llm-config.json");
      const config = JSON.parse(readFileSync(configPath, "utf8"));
      return {
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
      };
    } catch {
      // 默认配置（实际使用时应从环境变量或配置文件读取）
      return {
        apiKey: process.env.LLM_API_KEY || "",
        baseUrl: process.env.LLM_BASE_URL || "https://api.deepseek.com",
        model: process.env.LLM_MODEL || "deepseek-chat",
      };
    }
  }

  /**
   * 调用 LLM
   */
  private async callLLM(systemPrompt: string, userPrompt: string): Promise<string> {
    const response = await fetch(`${this.llmConfig.baseUrl}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.llmConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: this.llmConfig.model,
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`LLM 调用失败: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    // OpenAI Responses API 格式
    const outputText = data.output?.[0]?.content?.[0]?.text || data.output_text || "";
    return outputText;
  }

  /**
   * 从 LLM 输出中提取 JSON
   */
  private extractJSON(text: string): any {
    // 尝试提取 ```json 代码块
    const jsonBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonBlockMatch) {
      try {
        return JSON.parse(jsonBlockMatch[1]);
      } catch {
        // 继续尝试其他方式
      }
    }

    // 尝试提取第一个 { 到最后一个 }
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(text.substring(firstBrace, lastBrace + 1));
      } catch {
        // 继续
      }
    }

    throw new Error("无法从 LLM 输出中提取 JSON");
  }

  /**
   * Step 1: 设计域划分
   */
  private async designDomains(): Promise<{ domains: DomainDef[]; visualBranches: string[] }> {
    const systemPrompt = `你是知识图谱 Profile 设计专家。根据用户的任务描述，设计知识网络的语义域划分和视觉分支。

要求：
- 语义域数量：3-8 个，每个域代表一个独立的知识领域
- 视觉分支数量：3-5 个，用于 UI 展示的颜色/分组
- 每个域包含：id（kebab-case）、name（中文名称）、description（一句话描述）、visualBranch（所属视觉分支）、order（排序）
- 域划分要覆盖主题的主要方面，避免重叠
- 参考 FMCW 雷达的域划分：physical-performance / waveform-if / nonideal-calibration / spectral-rva / detection-measurement / clustering-object / estimation / association-tracking / scene-events / system-hardware / ai-learning

输出 JSON 格式：
{
  "domains": [
    {"id": "domain-id", "name": "域名称", "description": "描述", "visualBranch": "branch-name", "order": 1}
  ],
  "visualBranches": ["branch1", "branch2", "branch3"]
}`;

    const userPrompt = `主题：${this.topic}
任务描述：${this.taskDescription}

请设计这个知识网络的语义域划分和视觉分支。`;

    const response = await this.callLLM(systemPrompt, userPrompt);
    const result = this.extractJSON(response);

    if (!result.domains || !Array.isArray(result.domains)) {
      throw new Error("域划分设计失败：缺少 domains 数组");
    }
    if (!result.visualBranches || !Array.isArray(result.visualBranches)) {
      throw new Error("域划分设计失败：缺少 visualBranches 数组");
    }

    return {
      domains: result.domains,
      visualBranches: result.visualBranches,
    };
  }

  /**
   * Step 2: 设计类型系统（节点类型 + 边类型）
   */
  private async designTypes(domains: DomainDef[]): Promise<{ nodeTypes: NodeTypeDef[]; edgeTypes: EdgeTypeDef[] }> {
    const systemPrompt = `你是知识图谱 Profile 设计专家。根据主题和域划分，设计节点类型和边类型。

基础节点类型（11种，可复用或扩展）：
${JSON.stringify(BASE_NODE_TYPES, null, 2)}

基础边类型（12种，可复用或扩展）：
${JSON.stringify(BASE_EDGE_TYPES, null, 2)}

要求：
- 优先复用基础类型，只有主题特定的概念才新增类型
- 每种节点类型包含：type、singular（一个节点只放一个什么）、forbidden（禁止什么）、note（说明）、isGranularSensitive（是否受节点粒度约束）
- 每种边类型包含：type、label、direction（symmetric/directed）、description
- 节点类型数量：8-15 种
- 边类型数量：8-15 种

输出 JSON 格式：
{
  "nodeTypes": [
    {"type": "concept", "singular": "一个概念", "forbidden": "禁止多个并列概念", "note": "说明", "isGranularSensitive": true}
  ],
  "edgeTypes": [
    {"type": "PREREQUISITE_OF", "label": "是...的前提", "direction": "directed", "description": "描述"}
  ]
}`;

    const userPrompt = `主题：${this.topic}
域划分：${domains.map((d) => `${d.name}(${d.id})`).join("、")}

请设计这个知识网络的节点类型和边类型。优先复用基础类型，只有主题特定的概念才新增。`;

    const response = await this.callLLM(systemPrompt, userPrompt);
    const result = this.extractJSON(response);

    if (!result.nodeTypes || !Array.isArray(result.nodeTypes)) {
      throw new Error("类型系统设计失败：缺少 nodeTypes 数组");
    }
    if (!result.edgeTypes || !Array.isArray(result.edgeTypes)) {
      throw new Error("类型系统设计失败：缺少 edgeTypes 数组");
    }

    return {
      nodeTypes: result.nodeTypes,
      edgeTypes: result.edgeTypes,
    };
  }

  /**
   * Step 3: 设计栏目目录
   */
  private async designCardSections(nodeTypes: NodeTypeDef[]): Promise<CardSectionDef[]> {
    // 基础 13 个栏目，大部分主题可以直接复用
    const baseSections: CardSectionDef[] = [
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
    ];

    // 对于大多数主题，基础栏目已经足够，不需要 LLM 重新设计
    // 但可以让 LLM 判断是否需要新增主题特定栏目
    const systemPrompt = `你是知识图谱 Profile 设计专家。判断当前主题是否需要在基础 13 个栏目之外新增主题特定栏目。

基础栏目：definition, principle, assumptions, comparison, inputs_outputs, procedure, engineering_tradeoff, failure_mode, validation, application, research_topic, code, misconception

如果需要新增栏目，输出新增的栏目列表；如果不需要，输出空数组。

输出 JSON 格式：
{
  "additionalSections": [
    {"type": "section-id", "label": "栏目名称", "definition": "描述", "coverage": "optional", "appliesTo": "all", "order": 200}
  ]
}`;

    const userPrompt = `主题：${this.topic}
节点类型：${nodeTypes.map((t) => t.type).join("、")}

是否需要新增主题特定栏目？`;

    try {
      const response = await this.callLLM(systemPrompt, userPrompt);
      const result = this.extractJSON(response);
      if (result.additionalSections && Array.isArray(result.additionalSections)) {
        return [...baseSections, ...result.additionalSections];
      }
    } catch {
      // LLM 调用失败时使用基础栏目
    }

    return baseSections;
  }

  /**
   * Step 4: 设计提示词
   */
  private async designPrompts(domains: DomainDef[], nodeTypes: NodeTypeDef[]): Promise<PromptConfig> {
    const systemPrompt = `你是知识图谱 Profile 设计专家。根据主题和域划分，设计 ReAct 深度检索提示词。

要求：
- 提示词包含 ReAct 循环指令（Observe/Act/再观察）
- 包含节点粒度硬约束（一个节点只放一个概念/方法/问题，禁止多个并列概念放一个节点）
- 包含知识卡栏目填充要求
- 包含批量合并而非逐个查重的要求
- 提示词长度：500-1500 字
- 主题特定的内容要替换为当前主题

输出 JSON 格式：
{
  "react": "ReAct 提示词文本",
  "topicAppendix": "主题特定的追加说明"
}`;

    const userPrompt = `主题：${this.topic}
域划分：${domains.map((d) => d.name).join("、")}
节点类型：${nodeTypes.map((t) => t.type).join("、")}

请设计这个知识网络的 ReAct 深度检索提示词。`;

    try {
      const response = await this.callLLM(systemPrompt, userPrompt);
      const result = this.extractJSON(response);

      return {
        react: result.react || "",
        review: "",
        finalResponse: "",
        ingest: {},
        topicAppendix: result.topicAppendix || `本知识网络聚焦 ${this.topic} 领域。`,
      };
    } catch {
      // LLM 调用失败时使用基础提示词
      return {
        react: `你是采用 ReAct 的知识检索 Agent。Observe 当前节点及前轮发现；判断缺口；Act 深入一个尚未解决的问题，输出一批实质知识；再观察覆盖度。每批累积后统一合并，不要逐条调用图内查重工具。

【节点粒度硬约束】
1. 一个节点只放一个东西，由 nodeType 决定。
2. 禁止把多个并列概念/方法/问题放在一个节点中。
3. problem 类型节点只描述问题/现象本身，禁止混入解决方法。
4. 节点名称简短具体，不超过15字。
5. 节点摘要是一句话定义，不超过50字。`,
        review: "",
        finalResponse: "",
        ingest: {},
        topicAppendix: `本知识网络聚焦 ${this.topic} 领域。`,
      };
    }
  }

  /**
   * Step 5: 设计初始化策略
   */
  private designInitialization(domains: DomainDef[]): TaskProfile["initialization"] {
    const domainCount = domains.length;
    const rootId = this.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "root";

    return {
      rootNode: {
        id: rootId,
        name: this.topic,
        shortFact: `${this.topic}知识网络根节点`,
      },
      mvp: {
        nodeCount: [15, 30],
        reactRounds: [2, 3],
        sectionsFilled: ["definition"],
        domainCount: [Math.max(2, Math.floor(domainCount / 2)), domainCount],
        durationMinutes: [2, 5],
      },
      full: {
        nodeCount: [80, 150],
        reactRounds: [6, 24],
        rootBudgetMinutes: [25, 35],
        durationMinutes: [25, 40],
      },
    };
  }

  /**
   * 校验 Profile 是否符合契约
   */
  private validateProfile(profile: TaskProfile): string[] {
    const issues: string[] = [];

    // 检查必填字段
    if (!profile.id) issues.push("缺少 id");
    if (!profile.name) issues.push("缺少 name");
    if (!profile.domains || profile.domains.length === 0) issues.push("缺少 domains 或为空");
    if (!profile.visualBranches || profile.visualBranches.length === 0) issues.push("缺少 visualBranches 或为空");
    if (!profile.nodeTypes || profile.nodeTypes.length === 0) issues.push("缺少 nodeTypes 或为空");
    if (!profile.edgeTypes || profile.edgeTypes.length === 0) issues.push("缺少 edgeTypes 或为空");
    if (!profile.cardSections || profile.cardSections.length === 0) issues.push("缺少 cardSections 或为空");
    if (!profile.validation) issues.push("缺少 validation");
    if (!profile.initialization) issues.push("缺少 initialization");

    // 检查域数量与 validation 一致
    if (profile.validation && profile.domains) {
      if (profile.validation.domainCount !== profile.domains.length) {
        issues.push(`validation.domainCount(${profile.validation.domainCount}) 与 domains.length(${profile.domains.length}) 不一致`);
      }
    }

    // 检查视觉分支数量与 validation 一致
    if (profile.validation && profile.visualBranches) {
      if (profile.validation.visualBranchCount !== profile.visualBranches.length) {
        issues.push(`validation.visualBranchCount(${profile.validation.visualBranchCount}) 与 visualBranches.length(${profile.visualBranches.length}) 不一致`);
      }
    }

    // 检查每个域的 visualBranch 是否在 visualBranches 中
    if (profile.domains && profile.visualBranches) {
      for (const domain of profile.domains) {
        if (!profile.visualBranches.includes(domain.visualBranch)) {
          issues.push(`域 ${domain.id} 的 visualBranch(${domain.visualBranch}) 不在 visualBranches 列表中`);
        }
      }
    }

    return issues;
  }

  /**
   * 修复 Profile（让 LLM 修复校验问题）
   */
  private async fixProfile(profile: TaskProfile, issues: string[]): Promise<TaskProfile> {
    const systemPrompt = `你是知识图谱 Profile 修复专家。根据校验问题，修复 Profile 中的错误。

只修复列出的问题，不要改变其他正确的部分。
输出完整的修复后的 Profile JSON。`;

    const userPrompt = `当前 Profile：
${JSON.stringify(profile, null, 2)}

校验问题：
${issues.map((issue, i) => `${i + 1}. ${issue}`).join("\n")}

请修复这些问题，输出完整的修复后的 Profile JSON。`;

    const response = await this.callLLM(systemPrompt, userPrompt);
    return this.extractJSON(response);
  }

  /**
   * 执行完整的 Profile 设计流程
   */
  async design(): Promise<ProfileDesignResult> {
    const warnings: string[] = [];
    let iterations = 0;

    // Step 1: 域划分
    const { domains, visualBranches } = await this.designDomains();

    // Step 2: 类型系统
    const { nodeTypes, edgeTypes } = await this.designTypes(domains);

    // Step 3: 栏目目录
    const cardSections = await this.designCardSections(nodeTypes);

    // Step 4: 提示词
    const prompts = await this.designPrompts(domains, nodeTypes);

    // Step 5: 初始化策略
    const initialization = this.designInitialization(domains);

    // 组装 Profile
    const now = new Date().toISOString();
    let profile: TaskProfile = {
      id: this.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "custom-profile",
      name: this.topic,
      version: "0.1.0",
      description: `由 Profile 设计器自动生成：${this.taskDescription}`,
      schemaVersion: "task-profile/1",
      createdAt: now,
      updatedAt: now,
      author: "knowmap-profile-designer",
      tags: [this.topic, "auto-generated"],
      domains,
      visualBranches,
      nodeTypes,
      edgeTypes,
      cardSections,
      validation: {
        domainCount: domains.length,
        visualBranchCount: visualBranches.length,
        rootNodeRequired: true,
      },
      prompts,
      initialization,
    };

    // Step 6: 校验+修复循环
    let validationIssues = this.validateProfile(profile);
    while (validationIssues.length > 0 && iterations < this.maxIterations) {
      iterations++;
      warnings.push(`第 ${iterations} 轮修复：${validationIssues.length} 个问题`);
      try {
        profile = await this.fixProfile(profile, validationIssues);
        validationIssues = this.validateProfile(profile);
      } catch (error) {
        warnings.push(`修复失败：${error instanceof Error ? error.message : String(error)}`);
        break;
      }
    }

    if (validationIssues.length > 0) {
      warnings.push(`经过 ${iterations} 轮修复后仍有 ${validationIssues.length} 个问题未解决`);
    }

    return {
      profile,
      iterations,
      validationIssues,
      warnings,
    };
  }

  /**
   * 将 Profile 写入文件
   */
  writeProfileToFile(profile: TaskProfile, outputPath?: string): string {
    const profileId = profile.id;
    const filePath = outputPath || join(process.cwd(), "profiles", `${profileId}.ts`);

    const content = `/**
 * ${profile.name} Profile
 *
 * 由 Profile 设计器自动生成
 * 版本：${profile.version}
 * 描述：${profile.description}
 */

import type { TaskProfile } from "../plugin/contracts/task-profile";

export const ${profileId.toUpperCase().replace(/-/g, "_")}_PROFILE: TaskProfile = ${JSON.stringify(profile, null, 2)};

export default ${profileId.toUpperCase().replace(/-/g, "_")}_PROFILE;
`;

    writeFileSync(filePath, content, "utf8");
    return filePath;
  }
}

export default ProfileDesigner;

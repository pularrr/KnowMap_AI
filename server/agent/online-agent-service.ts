import { randomUUID } from "node:crypto";
import type {
  AgentInteractionResult,
  ConfirmChangeResult,
  PendingChangeView,
} from "../../core/agent/online-contracts";
import type {
  AgentGraphSnapshot,
  GraphOperation,
  KnowledgeProposal,
  ReviewFinding,
  ReviewReport,
} from "../../core/agent/contracts";
import { OfflineBuildAgent, OfflineReviewAgent } from "../../core/agent/offline-agents";
import { deterministicId } from "../../core/agent/graph-operations";
import { createAgentRun, transitionAgentRun, type PersistentAgentRun } from "../../core/agent/run-state";
import type {
  CardBlock,
  CardBlockType,
  KnowledgeCard,
  KnowledgeDataset,
  KnowledgeEvidence,
  KnowledgeNode,
  NodeType,
} from "../../core/knowledge/schema";
import { CARD_SECTION_CATALOG } from "../../core/knowledge/card-section-catalog";
import { datasetToAgentGraph } from "../../core/knowledge/portable-bundle";
import type { JsonObject, LlmMessage, LlmProvider } from "../../core/llm/contracts";
import type { StagedKnowledgeImport } from "../../core/ingestion/contracts";
import { createConfiguredLlmProvider } from "../llm/provider-factory";
import { confirmationTokenService, runtimeKnowledgeRepository, runtimeLlmConfigStore } from "../runtime/app-runtime";
import { executeKnowledgeTool, KNOWLEDGE_TOOL_DEFINITIONS, type KnowledgeToolObservation } from "./knowledge-tools";

type ProposedBlock = { nodeId?: string; type?: string; title?: string; text?: string };
type ProposedNode = {
  canonicalName?: string;
  shortFact?: string;
  nodeType?: string;
  parentId?: string;
  relationshipType?: string;
  relationshipRationale?: string;
};
type ResearchDocument = {
  answer?: string;
  coverageAssessment?: string;
  proposal?: {
    summary?: string;
    rationale?: string;
    cardBlocks?: ProposedBlock[];
    newNodes?: ProposedNode[];
    evidence?: Array<{ title?: string; url?: string; note?: string }>;
  };
};

const allowedBlockTypes = new Set(CARD_SECTION_CATALOG.map((item) => item.type));
const allowedNodeTypes = new Set<NodeType>(["domain", "problem", "concept", "method", "algorithm", "model", "phenomenon", "component", "artifact", "parameter", "metric", "application"]);

const now = () => new Date().toISOString();
const clean = (value: unknown, limit = 2_000): string => typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, limit) : "";
const sleep = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/**
 * Compact a tool observation to keep the reasoning loop's context bounded.
 * The full JSON output is truncated to a short head so the model still sees
 * entity names / ids without the payload dominating the window.
 */
function compactObservation(
  observation: KnowledgeToolObservation,
  outputLimit = 600,
): { round: number; tool: string; summary: string; outputHead: string } {
  const raw = typeof observation.output === "string" ? observation.output : JSON.stringify(observation.output);
  return {
    round: observation.round,
    tool: observation.tool,
    summary: observation.summary,
    outputHead: raw.slice(0, outputLimit),
  };
}

/** Keep the lead context + the most recent K messages for the final pass. */
function rollingContext(messages: readonly LlmMessage[], keep = 6): LlmMessage[] {
  if (messages.length <= keep + 1) return [...messages];
  const head = messages[0];
  const tail = messages.slice(-keep);
  return [head, { role: "user", content: "（中间多轮图内观察已省略，以上为关键上下文摘要与最近观察。）" }, ...tail];
}

/**
 * SSE event contract used by the streaming chat route. The frontend consumes
 * these to reproduce a general LLM web experience (user bubble → thinking →
 * streaming markdown answer).
 */
export type AnswerStreamEvent =
  | { type: "meta"; runId: string; mode: "online" | "offline"; provider?: string; model?: string }
  | { type: "delta"; text: string }
  | { type: "done"; result: AgentInteractionResult }
  | { type: "error"; message: string };

const ANSWER_INSTRUCTIONS = `你是 FMCW 雷达领域知识助手。请围绕用户的问题直接作答，给出准确、完整、结构清晰的回答。回答应主要基于问题本身与你的领域知识：下面提供的“知识领域”只用于说明用户当前所处领域与关注点，不是唯一依据，也不要逐字复述图谱原始数据。
请使用 Markdown 组织回答：标题（## / ###）、无序/有序列表、加粗、行内代码、代码块、表格。数学公式必须使用标准 LaTeX：行内公式用 $...$，独立公式用 $$...$$ 单独成段，例如距离分辨率 $\Delta R = c/(2B)$；不要使用 [Z=...] 或纯文本描述公式。回答要充实完整，尽量覆盖问题的关键方面、原理推导、工程取舍与常见误区；若数据或结论存在不确定性、缺少依据，请明确说明，不要编造具体数值。不要声称修改了图谱。
禁止生成 Markdown 图片语法（![...](...)）、图表或任何需要外部图片资源的内容；如需说明结构，请用文字、列表或表格描述。禁止输出思维过程或元话语，直接给出回答。`;

/** Builds a compact "knowledge domain" reference — not a document dump. */
function knowledgeDomainContext(dataset: KnowledgeDataset, nodeId: string): string {
  const node = dataset.nodes.find((item) => item.id === nodeId);
  if (!node) throw new Error(`Unknown node: ${nodeId}`);
  const domain = dataset.domains.find((item) => item.id === node.domainId);
  const related = dataset.nodes
    .filter((item) => item.primaryParentId === node.id || node.primaryParentId === item.id)
    .slice(0, 12)
    .map((item) => item.canonicalName);
  return [
    `当前关注节点：${node.canonicalName}（${node.nodeType}）`,
    domain ? `所属语义域：${domain.name} — ${domain.description}` : "",
    `领域简介：${node.shortFact}`,
    related.length ? `相关节点：${related.join("、")}` : "",
  ].filter(Boolean).join("\n");
}

function answerPrompt(dataset: KnowledgeDataset, nodeId: string, query: string): string {
  return `${query}\n\n【知识领域（仅作背景参考）】\n${knowledgeDomainContext(dataset, nodeId)}`;
}

function parseJsonDocument(text: string): ResearchDocument | undefined {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  if (!candidate.trim()) return undefined;
  try { return JSON.parse(candidate) as ResearchDocument; } catch { return undefined; }
}

function graphSnapshot(dataset: KnowledgeDataset): AgentGraphSnapshot {
  return { ...datasetToAgentGraph(dataset), revision: dataset.revision };
}

function offlineAnswer(dataset: KnowledgeDataset, nodeId: string, query: string): string {
  const node = dataset.nodes.find((item) => item.id === nodeId);
  if (!node) throw new Error(`Unknown node: ${nodeId}`);
  const card = dataset.cards.find((item) => item.nodeId === nodeId);
  const blocks = card?.blocks.slice(0, 6) ?? [];
  const head = `**${node.canonicalName}**\n\n${node.shortFact}`;
  if (!blocks.length) {
    return `${head}\n\n> 当前离线知识不足，无法完整回答“${clean(query, 120)}”。配置外部 LLM 后可以获得更完整的回答。`;
  }
  const sections = blocks.map((block) => {
    const body = block.text || block.items?.join("；") || block.code || "";
    return body ? `### ${block.title}\n\n${body}` : "";
  }).filter(Boolean).join("\n\n");
  return `${head}\n\n${sections}\n\n> 以上内容来自本地离线知识卡。未配置外部 LLM，回答基于图谱卡片整理。`;
}

function appendBlock(card: KnowledgeCard, block: CardBlock): KnowledgeCard {
  const sameType = card.blocks.findIndex((item) => item.type === block.type);
  const blocks = sameType >= 0
    ? card.blocks.map((item, index) => index === sameType ? block : item)
    : [...card.blocks, block];
  return { ...structuredClone(card), blocks, revision: card.revision + 1 };
}

function slug(value: string): string {
  const ascii = value.normalize("NFKD").toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
  return ascii || deterministicId("node", value).slice(0, 20);
}

function operationsFromResearch(document: ResearchDocument, dataset: KnowledgeDataset, currentNodeId: string, staged?: StagedKnowledgeImport): {
  summary: string;
  rationale: string;
  evidence: KnowledgeEvidence[];
  operations: GraphOperation[];
} {
  const proposal = document.proposal;
  if (!proposal) return { summary: "未形成可写入提案", rationale: "模型只返回了回答。", evidence: [], operations: [] };
  const evidence = (proposal.evidence ?? []).slice(0, 6).map((item, index): KnowledgeEvidence => ({
    id: deterministicId("evidence", { title: clean(item.title), url: clean(item.url), note: clean(item.note) }),
    title: clean(item.title, 160) || `在线检索证据 ${index + 1}`,
    sourceType: "document",
    ...(clean(item.url) ? { locator: clean(item.url, 1_000) } : {}),
    ...(clean(item.note) ? { excerpt: clean(item.note, 800) } : {}),
  }));
  const evidenceIds = evidence.map((item) => item.id);
  const operations: GraphOperation[] = evidence.map((item) => ({ kind: "upsert-evidence", evidence: item }));
  if (staged) {
    operations.push({ kind: "upsert-source", source: staged.artifact });
    operations.push(...staged.claims.slice(0, 24).map((claim): GraphOperation => ({ kind: "upsert-claim", claim })));
  }
  const cardByNode = new Map(dataset.cards.map((card) => [card.nodeId, card]));
  const cardBlocksByNode = new Map<string, CardBlock[]>();
  for (const suggestion of (proposal.cardBlocks ?? []).slice(0, 4)) {
    const nodeId = suggestion.nodeId && dataset.nodes.some((item) => item.id === suggestion.nodeId) ? suggestion.nodeId : currentNodeId;
    const type = allowedBlockTypes.has(suggestion.type as CardBlockType) ? suggestion.type as CardBlockType : "research_topic";
    const text = clean(suggestion.text, 2_400);
    if (!text) continue;
    const block: CardBlock = { type, title: clean(suggestion.title, 80) || CARD_SECTION_CATALOG.find((item) => item.type === type)!.label, text };
    const existing = cardBlocksByNode.get(nodeId) ?? [];
    cardBlocksByNode.set(nodeId, [...existing, block]);
  }
  for (const [nodeId, blocks] of cardBlocksByNode) {
    const existing = cardByNode.get(nodeId) ?? { nodeId, headline: dataset.nodes.find((item) => item.id === nodeId)?.shortFact ?? "知识卡片", blocks: [], formulaIds: [], evidenceIds: [], revision: dataset.revision };
    let card = existing;
    for (const block of blocks) card = appendBlock(card, block);
    card.evidenceIds = [...new Set([...card.evidenceIds, ...evidenceIds])];
    operations.push({ kind: "upsert-card", card });
  }

  const current = dataset.nodes.find((item) => item.id === currentNodeId)!;
  let nextOrder = Math.max(...dataset.nodes.map((item) => item.order), 0) + 1;
  for (const suggestion of (proposal.newNodes ?? []).slice(0, 2)) {
    const canonicalName = clean(suggestion.canonicalName, 96);
    const shortFact = clean(suggestion.shortFact, 180);
    if (!canonicalName || !shortFact) continue;
    const parent = dataset.nodes.find((item) => item.id === suggestion.parentId) ?? current;
    let id = slug(canonicalName);
    if (dataset.nodes.some((item) => item.id === id)) id = `${id}-${deterministicId("node", canonicalName).slice(-6)}`;
    const node: KnowledgeNode = {
      id,
      canonicalName,
      shortFact,
      aliases: [],
      nodeType: allowedNodeTypes.has(suggestion.nodeType as NodeType) ? suggestion.nodeType as NodeType : "concept",
      domainId: parent.domainId,
      visualBranch: parent.visualBranch,
      primaryParentId: parent.id,
      level: parent.level + 1,
      order: nextOrder++,
      tags: ["agent-generated"],
      status: "reviewed",
    };
    operations.push({ kind: "upsert-node", node });
    operations.push({ kind: "upsert-card", card: {
      nodeId: id,
      headline: shortFact,
      blocks: [{ type: "definition", title: "定义与边界", text: shortFact }],
      formulaIds: [],
      evidenceIds,
      revision: dataset.revision,
    } });
  }
  operations.push({ kind: "append-history", entry: {
    id: deterministicId("history", { currentNodeId, summary: proposal.summary, at: now() }),
    nodeId: currentNodeId,
    kind: "candidate_generated",
    summary: clean(proposal.summary, 72) || "在线 Knowledge Agent 形成知识扩充候选。",
    occurredAt: now(),
    revision: dataset.revision,
  } });
  return {
    summary: clean(proposal.summary, 160) || "在线知识扩充提案",
    rationale: clean(proposal.rationale, 800) || clean(document.coverageAssessment, 800) || "基于图谱观察与外部检索形成。",
    evidence,
    operations,
  };
}

async function semanticReview(
  provider: LlmProvider,
  proposal: KnowledgeProposal,
  dataset: KnowledgeDataset,
): Promise<ReviewFinding[]> {
  const response = await provider.createResponse({
    instructions: "你是独立 Review Agent。检查新主张与现有图谱是否冲突、taxonomy 是否合适、是否重复建点、主父级与关系方向是否正确。只输出 JSON：{\"accepted\":boolean,\"findings\":[{\"code\":string,\"severity\":\"error\"|\"warning\",\"message\":string,\"operationIndex\":number|null}]}。不要输出思维过程。",
    messages: [{ role: "user", content: JSON.stringify({ proposal, nearbyNodes: dataset.nodes.slice(0, 140) }) }],
    maxOutputTokens: 4_096,
  });
  const parsed = parseJsonDocument(response.text) as { accepted?: boolean; findings?: ReviewFinding[] } | undefined;
  // Loose parse: if the review is malformed (some models return prose or an
  // incomplete envelope), we fail-open to the deterministic hard review
  // instead of blocking a legitimate candidate on a fragile JSON contract.
  if (!parsed || typeof parsed.accepted !== "boolean" || !Array.isArray(parsed.findings)) {
    return [{
      code: "SEMANTIC_REVIEW_SKIPPED",
      severity: "warning",
      message: "语义 Review 未返回可解析结构，已跳过 LLM 语义二审（结构门禁仍由确定性硬性审查把关）。",
    }];
  }
  const findings: ReviewFinding[] = parsed.findings.slice(0, 20).map((finding): ReviewFinding => ({
    code: clean(finding.code, 64) || "SEMANTIC_REVIEW",
    severity: finding.severity === "warning" ? "warning" : "error",
    message: clean(finding.message, 400) || "语义审查发现问题。",
    ...(Number.isInteger(finding.operationIndex) ? { operationIndex: finding.operationIndex } : {}),
  }));
  if (!parsed.accepted && !findings.some((finding) => finding.severity === "error")) {
    findings.push({ code: "SEMANTIC_REVIEW_REJECTED", severity: "error", message: "语义 Review 拒绝了该提案。" });
  }
  return findings;
}

export class OnlineAgentService {
  private readonly hardReview = new OfflineReviewAgent();
  private readonly buildAgent = new OfflineBuildAgent();

  async answer(input: { sessionId: string; nodeId: string; query: string }): Promise<AgentInteractionResult> {
    const repository = runtimeKnowledgeRepository();
    const dataset = repository.snapshot();
    const runId = randomUUID();
    let run = createAgentRun({ id: runId, sessionId: input.sessionId, kind: "chat", baseRevision: dataset.revision, currentNodeId: input.nodeId, querySummary: clean(input.query, 120), at: now() });
    if (!runtimeLlmConfigStore().status().configured) {
      run = transitionAgentRun(run, "answering", { actor: "knowledge-agent", summary: "使用离线知识卡回答", at: now() });
      run = transitionAgentRun(run, "applied", { actor: "development-agent", summary: "离线回答完成", at: now() });
      await repository.putRun(run);
      return { runId, mode: "offline", text: offlineAnswer(dataset, input.nodeId, input.query), observations: [], warning: "未配置外部 LLM，已使用离线知识卡回答。" };
    }
    run = transitionAgentRun(run, "answering", { actor: "knowledge-agent", summary: "调用外部通用 LLM 回答", at: now() });
    await repository.putRun(run);
    const provider = createConfiguredLlmProvider({ environment: runtimeLlmConfigStore().environment() });
    const response = await provider.createResponse({
      instructions: ANSWER_INSTRUCTIONS,
      messages: [{ role: "user", content: answerPrompt(dataset, input.nodeId, input.query) }],
    });
    run = transitionAgentRun(run, "applied", { actor: "development-agent", summary: "在线回答完成", at: now() });
    await repository.putRun(run);
    return { runId, mode: "online", provider: response.provider, model: response.model, text: response.text, observations: [] };
  }

  /** Streaming variant of {@link answer} consumed by the SSE chat route. */
  async *answerStream(input: { sessionId: string; nodeId: string; query: string }): AsyncIterable<AnswerStreamEvent> {
    const repository = runtimeKnowledgeRepository();
    const dataset = repository.snapshot();
    const runId = randomUUID();
    let run = createAgentRun({ id: runId, sessionId: input.sessionId, kind: "chat", baseRevision: dataset.revision, currentNodeId: input.nodeId, querySummary: clean(input.query, 120), at: now() });
    if (!runtimeLlmConfigStore().status().configured) {
      yield { type: "meta", runId, mode: "offline" };
      run = transitionAgentRun(run, "answering", { actor: "knowledge-agent", summary: "使用离线知识卡回答", at: now() });
      await repository.putRun(run);
      await sleep(650);
      const text = offlineAnswer(dataset, input.nodeId, input.query);
      run = transitionAgentRun(run, "applied", { actor: "development-agent", summary: "离线回答完成", at: now() });
      await repository.putRun(run);
      yield { type: "done", result: { runId, mode: "offline", text, observations: [], warning: "未配置外部 LLM，已使用离线知识卡回答。" } };
      return;
    }
    run = transitionAgentRun(run, "answering", { actor: "knowledge-agent", summary: "调用外部通用 LLM 回答", at: now() });
    await repository.putRun(run);
    const provider = createConfiguredLlmProvider({ environment: runtimeLlmConfigStore().environment() });
    const request = {
      instructions: ANSWER_INSTRUCTIONS,
      messages: [{ role: "user", content: answerPrompt(dataset, input.nodeId, input.query) }],
    } as const;
    yield { type: "meta", runId, mode: "online", provider: provider.name };
    let fullText = "";
    let model = "";
    try {
      if (provider.createStream) {
        for await (const event of provider.createStream(request)) {
          if (event.type === "text_delta") {
            fullText += event.text;
            yield { type: "delta", text: event.text };
          } else if (event.type === "done") {
            model = event.result.model;
          } else if (event.type === "error") {
            throw event.error;
          }
        }
      } else {
        const response = await provider.createResponse(request);
        fullText = response.text;
        model = response.model;
        yield { type: "delta", text: fullText };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "LLM 回答失败。";
      yield { type: "error", message };
      return;
    }
    run = transitionAgentRun(run, "applied", { actor: "development-agent", summary: "在线回答完成", at: now() });
    await repository.putRun(run);
    yield { type: "done", result: { runId, mode: "online", provider: provider.name, model, text: fullText, observations: [] } };
  }

  async deepSearch(input: { sessionId: string; nodeId: string; query: string; staged?: StagedKnowledgeImport }): Promise<AgentInteractionResult> {
    const repository = runtimeKnowledgeRepository();
    const dataset = repository.snapshot();
    const target = dataset.nodes.find((item) => item.id === input.nodeId);
    if (!target) throw new Error(`Unknown node: ${input.nodeId}`);
    const runId = randomUUID();
    let run = createAgentRun({ id: runId, sessionId: input.sessionId, kind: input.staged ? "ingest" : "deep_search", baseRevision: dataset.revision, currentNodeId: input.nodeId, querySummary: clean(input.query || `扩充 ${target.canonicalName}`, 120), at: now() });
    run = transitionAgentRun(run, "knowledge_researching", { actor: "knowledge-agent", summary: "开始知识观察与缺口判断", at: now() });
    await repository.putRun(run);

    const mandatory: Array<[string, JsonObject]> = [
      ["get_node", { nodeId: input.nodeId }],
      ["get_card", { nodeId: input.nodeId }],
      ["assess_coverage", { nodeId: input.nodeId }],
      ["traverse_graph", { nodeId: input.nodeId, maxDepth: 2, maxNodes: 18 }],
    ];
    const observations: KnowledgeToolObservation[] = mandatory.map(([tool, args], index) => {
      const result = executeKnowledgeTool(dataset, tool, args);
      return { round: index + 1, tool, input: args, ...result };
    });

    if (!runtimeLlmConfigStore().status().configured) {
      run = transitionAgentRun(run, "applied", { actor: "development-agent", summary: "离线覆盖检查完成", at: now() });
      await repository.putRun(run);
      return {
        runId,
        mode: "offline",
        text: `${observations[2].summary} 已完成本地图谱观察；配置外部 LLM 后才能执行在线深度搜索与形成生长提案。`,
        observations: observations.map(({ round, tool, summary }) => ({ round, tool, summary })),
        warning: "离线模式仅做覆盖检查，不冒充深度搜索。",
      };
    }

    const provider = createConfiguredLlmProvider({ environment: runtimeLlmConfigStore().environment() });
    const messages: LlmMessage[] = [{
      role: "user",
      content: `研究问题：${clean(input.query, 2_000) || `围绕“${target.canonicalName}”扩充知识点`}\n当前节点：${target.canonicalName}\n已有观察：${JSON.stringify(observations.map((item) => compactObservation(item)))}`,
    }];
    let lastProvider = provider.name;
    let lastModel = "";
    const maxRounds = Math.min(runtimeLlmConfigStore().environment().LLM_MAX_TOOL_ROUNDS ? Number(runtimeLlmConfigStore().environment().LLM_MAX_TOOL_ROUNDS) : 8, 8);
    for (let round = 0; round < Math.max(1, maxRounds - 2); round += 1) {
      const response = await provider.createResponse({
        instructions: "你是 Knowledge Agent。阅读观察，判断知识是否全面；若需要更多图内信息则调用一个只读工具。禁止调用 get_history，除非用户明确给出 historyIds。若图内信息已充分，说明下一步应检索的外部主题。不要生成最终提案。",
        messages,
        tools: KNOWLEDGE_TOOL_DEFINITIONS,
        toolChoice: round === 0 ? "required" : "auto",
        maxOutputTokens: 4_096,
      });
      lastProvider = response.provider;
      lastModel = response.model;
      if (!response.toolCalls.length) {
        messages.push({ role: "assistant", content: response.text || "图内观察已经充分，进入外部检索与归纳。" });
        break;
      }
      for (const call of response.toolCalls.slice(0, 2)) {
        if (!call.arguments) continue;
        try {
          const result = executeKnowledgeTool(dataset, call.name, call.arguments);
          const observation: KnowledgeToolObservation = { round: observations.length + 1, tool: call.name, input: call.arguments, ...result };
          observations.push(observation);
          const compact = compactObservation(observation);
          messages.push({ role: "user", content: `只读工具 ${call.name} 返回：${compact.summary}\n关键内容：${compact.outputHead}\n请据此继续判断是否全面。` });
        } catch (error) {
          messages.push({ role: "user", content: `工具 ${call.name} 拒绝：${error instanceof Error ? error.message : "unknown error"}` });
        }
      }
      if (observations.length >= 12) break;
    }

    const matchContext = input.staged && input.staged.matches?.length
      ? `\n\n【资料-图谱匹配判定（来自知识检索 Agent，需参考）】\n${JSON.stringify(input.staged.matches.map((m) => ({ claimId: m.claimId, decision: m.decision, matchedNodeId: m.matchedNodeId ?? null, score: m.score, rationale: m.rationale, ...(m as unknown as { proposedRelationType?: string }).proposedRelationType ? { proposedRelationType: (m as unknown as { proposedRelationType?: string }).proposedRelationType } : {} })))}`
      : "";

    // Phase A: external verification. The web_search tool is a server-side
    // builtin; when it's forced with toolChoice "required", some providers
    // return only the tool call with no text on the first pass. We run it in
    // its own turn, then carry its output into a separate text-only JSON pass.
    const researchBase = [...rollingContext(messages, 6), ...(matchContext ? [{ role: "user" as const, content: `研究问题：${clean(input.query, 2_000)}（资料整理任务）${matchContext}` }] : [])];
    let searchContext = "";
    try {
      const searchResponse = await provider.createResponse({
        instructions: "使用 web_search 检索与研究问题、资料声明相关的权威来源（论文、TI/Infineon 文档、IEEE、专利等），核对外部知识并收集证据。只输出检索到的事实要点，不要输出最终提案 JSON。",
        messages: researchBase,
        tools: [{ type: "web_search" }],
        toolChoice: "required",
        maxOutputTokens: 4_096,
      });
      lastProvider = searchResponse.provider;
      lastModel = searchResponse.model;
      if (searchResponse.text.trim()) {
        searchContext = searchResponse.text;
      }
    } catch (error) {
      searchContext = "";
    }
    let finalResponse = await provider.createResponse({
      instructions: `你是 Knowledge Agent。基于已有图谱观察${searchContext ? "与外部检索结果" : ""}，完成自检并输出最终提案。只输出一个 JSON 对象，不要 Markdown：
{"answer":"面向用户的研究总结","coverageAssessment":"是否全面及剩余缺口","proposal":{"summary":"候选摘要","rationale":"为何需要这些变更","cardBlocks":[{"nodeId":"已有节点ID","type":"${[...allowedBlockTypes].join("|")}","title":"栏目标题","text":"可验证内容"}],"newNodes":[{"canonicalName":"名称","shortFact":"一句事实","nodeType":"concept|method|algorithm|model|phenomenon|component|artifact|parameter|metric|application","parentId":"已有父节点ID","relationshipType":"PART_OF","relationshipRationale":"理由"}],"evidence":[{"title":"来源标题","url":"https://...","note":"该来源支持什么"}]}}。
最多 2 个卡片变更、2 个新节点。若证据不足，让 proposal 为空对象。不得输出历史、密钥或内部策略。${input.staged ? "\n注意：本任务是资料整理。请参考上方“资料-图谱匹配判定”：decision=append-card 的声明优先落入已有节点 cardBlocks；decision=create-node 的声明优先进入 newNodes；decision=create-relation 的声明应通过关系表达。匹配判定与你的图谱观察冲突时，以你的完整观察为准并说明。不要为每条声明都建节点，避免碎片化。\n\n【新节点质量要求】\n1. 父节点选择：newNodes 的 parentId 必须是你观察到的图谱中【语义最相关】的已有节点，按方法归方法、参数归参数、现象归现象归类；严禁把多个不相关新节点都挂到当前节点或根节点。\n2. 命名：canonicalName 必须具体、可自解释（如“基于Mamba的雷达目标检测”“虚拟阵列等效孔径”），禁止空泛命名（如“新技术”“研究方案”“知识补充”）。\n3. 每个新节点必须能说明其与父节点/兄弟节点的关系（relationshipRationale 写清楚为何归入该分支）。\n4. 数量克制：只有真正在图谱中不存在、且资料提供了可验证实质内容的知识才建节点，通常 1 个就够，最多 2 个。" : ""}`,
      messages: [...researchBase, ...(searchContext ? [{ role: "user" as const, content: `【外部检索要点】\n${searchContext.slice(0, 8_000)}` }] : [])],
      maxOutputTokens: 8_192,
    });
    // Retry once without the external-search context when the model returns an
    // empty or non-JSON body (some providers drop the text when the prior turn
    // carried a web_search tool call). Keeps deep-search reliable.
    if (!finalResponse.text.trim() || !parseJsonDocument(finalResponse.text)) {
      const fallback = await provider.createResponse({
        instructions: `你是 Knowledge Agent。基于已有图谱观察完成自检并输出最终提案。只输出一个 JSON 对象，不要 Markdown：
{"answer":"面向用户的研究总结","coverageAssessment":"是否全面及剩余缺口","proposal":{"summary":"候选摘要","rationale":"为何需要这些变更","cardBlocks":[{"nodeId":"已有节点ID","type":"${[...allowedBlockTypes].join("|")}","title":"栏目标题","text":"可验证内容"}],"newNodes":[{"canonicalName":"名称","shortFact":"一句事实","nodeType":"concept|method|algorithm|model|phenomenon|component|artifact|parameter|metric|application","parentId":"已有父节点ID","relationshipType":"PART_OF","relationshipRationale":"理由"}],"evidence":[{"title":"来源标题","url":"https://...","note":"该来源支持什么"}]}}。
最多 2 个卡片变更、2 个新节点。若证据不足，让 proposal 为空对象。不得输出历史、密钥或内部策略。${input.staged ? "\n注意：本任务是资料整理。请参考上方“资料-图谱匹配判定”：decision=append-card 的声明优先落入已有节点 cardBlocks；decision=create-node 的声明优先进入 newNodes；decision=create-relation 的声明应通过关系表达。匹配判定与你的图谱观察冲突时，以你的完整观察为准并说明。不要为每条声明都建节点，避免碎片化。\n\n【新节点质量要求】\n1. 父节点选择：newNodes 的 parentId 必须是你观察到的图谱中【语义最相关】的已有节点，按方法归方法、参数归参数、现象归现象归类；严禁把多个不相关新节点都挂到当前节点或根节点。\n2. 命名：canonicalName 必须具体、可自解释（如“基于Mamba的雷达目标检测”“虚拟阵列等效孔径”），禁止空泛命名（如“新技术”“研究方案”“知识补充”）。\n3. 每个新节点必须能说明其与父节点/兄弟节点的关系（relationshipRationale 写清楚为何归入该分支）。\n4. 数量克制：只有真正在图谱中不存在、且资料提供了可验证实质内容的知识才建节点，通常 1 个就够，最多 2 个。" : ""}`,
        messages: researchBase,
        maxOutputTokens: 8_192,
      });
      lastProvider = fallback.provider || lastProvider;
      lastModel = fallback.model || lastModel;
      finalResponse = fallback;
    }
    lastProvider = finalResponse.provider;
    lastModel = finalResponse.model;
    const document = parseJsonDocument(finalResponse.text);
    if (!document) {
      run = transitionAgentRun(run, "failed", { actor: "knowledge-agent", summary: "模型结构化输出解析失败", at: now(), changes: { failureCode: "MALFORMED_RESEARCH_OUTPUT" } });
      await repository.putRun(run);
      return { runId, mode: "online", provider: lastProvider, model: lastModel, text: finalResponse.text || "在线研究未返回可解析结果。", observations: observations.map(({ round, tool, summary }) => ({ round, tool, summary })), warning: "结构化输出无效，已阻止写入。" };
    }

    const prepared = operationsFromResearch(document, dataset, input.nodeId, input.staged);
    if (!prepared.operations.some((operation) => operation.kind.startsWith("upsert-"))) {
      run = transitionAgentRun(run, "applied", { actor: "development-agent", summary: "研究完成，无可写入提案", at: now() });
      await repository.putRun(run);
      return { runId, mode: "online", provider: lastProvider, model: lastModel, text: clean(document.answer, 8_000) || finalResponse.text, observations: observations.map(({ round, tool, summary }) => ({ round, tool, summary })), warning: "证据或结构不足，本次未生成写入候选。" };
    }

    const proposal: KnowledgeProposal = {
      id: deterministicId("proposal", { runId, operations: prepared.operations }),
      baseRevision: dataset.revision,
      context: { conversationSummary: clean(document.answer, 2_000), currentNodeId: input.nodeId, query: clean(input.query, 1_000), retrievedNodeIds: [...new Set(observations.flatMap((item) => item.tool === "traverse_graph" ? [] : [input.nodeId]))] },
      summary: prepared.summary,
      rationale: prepared.rationale,
      evidence: [
        ...prepared.evidence.map((item) => ({ id: item.id, title: item.title, source: item.locator ?? "online-llm", note: item.excerpt })),
        ...(input.staged ? [{ id: input.staged.artifact.id, title: input.staged.artifact.title, source: input.staged.artifact.storageRef ?? "user-supplied", note: `${input.staged.claims.length} 条结构化声明` }] : []),
      ],
      candidateOperations: prepared.operations,
      createdAt: now(),
      createdBy: "knowledge-agent",
    };
    run = transitionAgentRun(run, "semantic_reviewing", { actor: "review-agent", summary: "执行独立语义二审", at: now(), changes: { proposalId: proposal.id } });
    await repository.putRun(run);
    const semanticFindings = await semanticReview(provider, proposal, dataset);
    const hardReview = this.hardReview.review(proposal, graphSnapshot(dataset));
    const findings = [...semanticFindings, ...hardReview.findings];
    const review: ReviewReport = { ...hardReview, findings, accepted: !findings.some((item) => item.severity === "error") };
    if (!review.accepted) {
      run = transitionAgentRun(run, "gate_failed", { actor: "review-agent", summary: "语义或结构门禁拒绝提案", at: now() });
      await repository.putRun(run);
      return { runId, mode: "online", provider: lastProvider, model: lastModel, text: clean(document.answer, 8_000) || "研究完成，但候选未通过审查。", observations: observations.map(({ round, tool, summary }) => ({ round, tool, summary })), warning: findings.map((item) => item.message).join("；") };
    }

    run = transitionAgentRun(run, "building", { actor: "build-agent", summary: "构建确定性 GraphPatch", at: now() });
    const patch = this.buildAgent.build(proposal, review, graphSnapshot(dataset));
    const issued = confirmationTokenService().issue(patch, input.sessionId);
    run = transitionAgentRun(run, "awaiting_user_confirmation", { actor: "development-agent", summary: "等待用户确认", at: now(), changes: { patchId: patch.id, confirmationExpiresAt: issued.expiresAt } });
    await repository.putRun(run);
    await repository.putPendingChange({ runId, patchId: patch.id, sessionId: input.sessionId, proposal, review, patch, confirmationToken: issued.token, confirmationExpiresAt: issued.expiresAt });
    const candidate: PendingChangeView = { runId, proposalId: proposal.id, patchId: patch.id, summary: proposal.summary, rationale: proposal.rationale, operations: proposal.candidateOperations, projectionDiff: patch.projectionDiff, findings, confirmationToken: issued.token, confirmationExpiresAt: issued.expiresAt };
    return { runId, mode: "online", provider: lastProvider, model: lastModel, text: clean(document.answer, 8_000) || proposal.summary, observations: observations.map(({ round, tool, summary }) => ({ round, tool, summary })), candidate };
  }

  async prepareCardEdit(input: { sessionId: string; nodeId: string; headline: string; blocks: CardBlock[] }): Promise<PendingChangeView> {
    const repository = runtimeKnowledgeRepository();
    const dataset = repository.snapshot();
    const existing = dataset.cards.find((item) => item.nodeId === input.nodeId);
    if (!existing) throw new Error("Knowledge card does not exist.");
    const card: KnowledgeCard = { ...structuredClone(existing), headline: clean(input.headline, 240), blocks: input.blocks.slice(0, 24).map((block) => ({ ...block, title: clean(block.title, 80), ...(block.text ? { text: clean(block.text, 4_000) } : {}) })), revision: existing.revision + 1 };
    const operations: GraphOperation[] = [{ kind: "upsert-card", card }, { kind: "append-history", entry: { id: deterministicId("history", { nodeId: input.nodeId, revision: dataset.revision, card }), nodeId: input.nodeId, kind: "revision_applied", summary: "用户编辑知识卡片", occurredAt: now(), revision: dataset.revision } }];
    const runId = randomUUID();
    let run = createAgentRun({ id: runId, sessionId: input.sessionId, kind: "card_edit", baseRevision: dataset.revision, currentNodeId: input.nodeId, querySummary: "用户编辑知识卡片", at: now() });
    run = transitionAgentRun(run, "knowledge_researching", { actor: "knowledge-agent", summary: "整理卡片草稿", at: now() });
    const proposal: KnowledgeProposal = { id: deterministicId("proposal", operations), baseRevision: dataset.revision, context: { conversationSummary: "用户编辑知识卡片", currentNodeId: input.nodeId }, summary: "保存知识卡片编辑", rationale: "用户主动编辑，提交前仍执行结构门禁与显式确认。", evidence: [{ id: "manual-user-edit", title: "用户编辑", source: "manual" }], candidateOperations: operations, createdAt: now(), createdBy: "knowledge-agent" };
    const review = this.hardReview.review(proposal, graphSnapshot(dataset));
    if (!review.accepted) throw new Error(review.findings.map((item) => item.message).join("；"));
    run = transitionAgentRun(run, "semantic_reviewing", { actor: "review-agent", summary: "执行卡片结构门禁", at: now(), changes: { proposalId: proposal.id } });
    run = transitionAgentRun(run, "building", { actor: "build-agent", summary: "构建卡片变更", at: now() });
    const patch = this.buildAgent.build(proposal, review, graphSnapshot(dataset));
    const issued = confirmationTokenService().issue(patch, input.sessionId);
    run = transitionAgentRun(run, "awaiting_user_confirmation", { actor: "development-agent", summary: "等待用户确认卡片编辑", at: now(), changes: { patchId: patch.id, confirmationExpiresAt: issued.expiresAt } });
    await repository.putRun(run);
    await repository.putPendingChange({ runId, patchId: patch.id, sessionId: input.sessionId, proposal, review, patch, confirmationToken: issued.token, confirmationExpiresAt: issued.expiresAt });
    return { runId, proposalId: proposal.id, patchId: patch.id, summary: proposal.summary, rationale: proposal.rationale, operations, projectionDiff: patch.projectionDiff, findings: review.findings, confirmationToken: issued.token, confirmationExpiresAt: issued.expiresAt };
  }

  async confirm(input: { sessionId: string; patchId: string; confirmationToken: string }): Promise<ConfirmChangeResult> {
    const repository = runtimeKnowledgeRepository();
    const pending = repository.getPendingChange(input.patchId, input.sessionId);
    if (!pending) throw new Error("Pending change was not found for this session.");
    if (pending.confirmationToken !== input.confirmationToken) throw new Error("Confirmation token does not match the pending change.");
    const storedRun = repository.getRun(pending.runId);
    if (!storedRun) throw new Error("Agent run is missing.");
    let run = transitionAgentRun(storedRun, "committing", { actor: "development-agent", summary: "消费用户确认并提交", at: now() });
    await repository.putRun(run);
    const proof = confirmationTokenService().verify(input.confirmationToken, pending.patch, input.sessionId);
    const applied = await repository.applyConfirmedPatch(pending.patch, proof, "user");
    run = transitionAgentRun(run, "applied", { actor: "development-agent", summary: `写入修订 ${applied.dataset.revision}`, at: now() });
    await repository.putRun(run);
    await repository.removePendingChange(input.patchId);
    return { applied: true, revision: applied.dataset.revision, patchId: input.patchId, idempotent: applied.idempotent };
  }

  async reject(input: { sessionId: string; patchId: string }): Promise<void> {
    const repository = runtimeKnowledgeRepository();
    const pending = repository.getPendingChange(input.patchId, input.sessionId);
    if (!pending) throw new Error("Pending change was not found for this session.");
    const storedRun = repository.getRun(pending.runId);
    if (storedRun) await repository.putRun(transitionAgentRun(storedRun, "rejected", { actor: "user", summary: "用户拒绝候选", at: now() }));
    await repository.removePendingChange(input.patchId);
  }
}

const globalService = globalThis as typeof globalThis & { __fmcwOnlineAgentService?: OnlineAgentService };
export const onlineAgentService = () => (globalService.__fmcwOnlineAgentService ??= new OnlineAgentService());

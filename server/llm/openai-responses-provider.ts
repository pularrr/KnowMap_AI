import {
  LlmAbortedError,
  LlmHttpError,
  LlmRequestError,
  LlmTimeoutError,
  type JsonObject,
  type JsonValue,
  type LlmFunctionCall,
  type LlmFunctionTool,
  type LlmProvider,
  type LlmResponseRequest,
  type LlmResponseResult,
  type LlmResponseStatus,
  type LlmUsage,
  type LlmTool,
} from "../../core/llm/contracts";
import type { LlmServerConfig } from "../config/llm-config";

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const optionalString = (value: unknown): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const numeric = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const jsonOutput = (value: string | JsonValue): string =>
  typeof value === "string" ? value : JSON.stringify(value);

const statusOf = (value: unknown): LlmResponseStatus => {
  if (value === "completed" || value === "incomplete" || value === "failed") return value;
  return "unknown";
};

function parseArguments(rawArguments: string): Pick<LlmFunctionCall, "arguments" | "argumentParseError"> {
  try {
    const parsed: unknown = JSON.parse(rawArguments);
    if (!isRecord(parsed)) {
      return { arguments: null, argumentParseError: "Function arguments must be a JSON object." };
    }
    return { arguments: parsed as JsonObject };
  } catch (error) {
    return {
      arguments: null,
      argumentParseError: error instanceof Error ? error.message : "Invalid JSON arguments.",
    };
  }
}

function parseToolCalls(output: unknown): LlmFunctionCall[] {
  if (!Array.isArray(output)) return [];
  const calls: LlmFunctionCall[] = [];
  for (const item of output) {
    if (!isRecord(item) || item.type !== "function_call") continue;
    const callId = optionalString(item.call_id);
    const name = optionalString(item.name);
    if (!callId || !name) continue;
    const rawArguments = typeof item.arguments === "string" ? item.arguments : "{}";
    calls.push({
      ...(optionalString(item.id) ? { id: optionalString(item.id) } : {}),
      callId,
      name,
      rawArguments,
      ...parseArguments(rawArguments),
    });
  }
  return calls;
}

function parseText(response: UnknownRecord): string {
  if (typeof response.output_text === "string") return response.output_text;
  if (!Array.isArray(response.output)) return "";
  const fragments: string[] = [];
  for (const item of response.output) {
    if (!isRecord(item) || item.type !== "message" || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (isRecord(content) && content.type === "output_text" && typeof content.text === "string") {
        fragments.push(content.text);
      }
    }
  }
  return fragments.join("");
}

function parseUsage(value: unknown): LlmUsage | undefined {
  if (!isRecord(value)) return undefined;
  const inputTokens = numeric(value.input_tokens);
  const outputTokens = numeric(value.output_tokens);
  const totalTokens = numeric(value.total_tokens);
  if (inputTokens === undefined || outputTokens === undefined || totalTokens === undefined) return undefined;

  const inputDetails = isRecord(value.input_tokens_details) ? value.input_tokens_details : undefined;
  const outputDetails = isRecord(value.output_tokens_details) ? value.output_tokens_details : undefined;
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    ...(numeric(inputDetails?.cached_tokens) !== undefined
      ? { cachedInputTokens: numeric(inputDetails?.cached_tokens) }
      : {}),
    ...(numeric(outputDetails?.reasoning_tokens) !== undefined
      ? { reasoningTokens: numeric(outputDetails?.reasoning_tokens) }
      : {}),
  };
}

function toolPayload(tool: LlmTool): UnknownRecord {
  if ("type" in tool && tool.type === "web_search") return { type: "web_search" };
  const functionTool = tool as LlmFunctionTool;
  return {
    type: "function",
    name: functionTool.name,
    description: functionTool.description,
    parameters: functionTool.parameters,
    strict: functionTool.strict ?? true,
  };
}

async function errorFromResponse(response: Response): Promise<LlmHttpError> {
  const requestId = response.headers.get("x-request-id") ?? undefined;
  let message = `LLM provider returned HTTP ${response.status}.`;
  let code: string | undefined;
  try {
    const payload: unknown = await response.json();
    if (isRecord(payload) && isRecord(payload.error)) {
      message = optionalString(payload.error.message) ?? message;
      code = optionalString(payload.error.code);
    }
  } catch {
    // Keep the status-only message. Raw provider bodies may contain sensitive data.
  }
  return new LlmHttpError(message, response.status, requestId, code);
}

export class OpenAiResponsesProvider implements LlmProvider {
  readonly name = "openai-responses";

  constructor(
    private readonly config: LlmServerConfig,
    private readonly fetchImpl: FetchLike = globalThis.fetch,
  ) {}

  async createResponse(request: LlmResponseRequest): Promise<LlmResponseResult> {
    const messages = request.messages ?? [];
    const toolOutputs = request.toolOutputs ?? [];
    const tools = request.tools ?? [];
    if (messages.length === 0 && toolOutputs.length === 0) {
      throw new LlmRequestError("At least one message or function call output is required.");
    }
    if (toolOutputs.length > 0 && !request.session?.previousResponseId) {
      throw new LlmRequestError("Function call outputs require a previous response id.");
    }
    if (tools.length > this.config.maxTools) {
      throw new LlmRequestError(`Tool count exceeds the configured limit of ${this.config.maxTools}.`);
    }

    const inputChars =
      (request.instructions?.length ?? 0) +
      messages.reduce((total, message) => total + message.content.length, 0) +
      toolOutputs.reduce((total, output) => total + jsonOutput(output.output).length, 0);
    if (inputChars > this.config.maxInputChars) {
      throw new LlmRequestError(`Input exceeds the configured limit of ${this.config.maxInputChars} characters.`);
    }

    const maxOutputTokens = request.maxOutputTokens ?? this.config.maxOutputTokens;
    if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens < 1 || maxOutputTokens > this.config.maxOutputTokens) {
      throw new LlmRequestError(
        `maxOutputTokens must be between 1 and the configured limit of ${this.config.maxOutputTokens}.`,
      );
    }

    const input: UnknownRecord[] = [
      ...messages.map((message) => ({ role: message.role, content: message.content })),
      ...toolOutputs.map((output) => ({
        type: "function_call_output",
        call_id: output.callId,
        output: jsonOutput(output.output),
      })),
    ];
    const body: UnknownRecord = {
      model: this.config.model,
      input,
      max_output_tokens: maxOutputTokens,
      store: false,
      ...(request.instructions ? { instructions: request.instructions } : {}),
      ...(tools.length ? { tools: tools.map(toolPayload) } : {}),
      ...(request.toolChoice ? { tool_choice: request.toolChoice } : {}),
      ...(request.parallelToolCalls !== undefined
        ? { parallel_tool_calls: request.parallelToolCalls }
        : {}),
      ...(request.session?.previousResponseId
        ? { previous_response_id: request.session.previousResponseId }
        : {}),
      ...(request.metadata ? { metadata: request.metadata } : {}),
    };

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.config.timeoutMs);
    const abort = () => controller.abort(request.signal?.reason);
    request.signal?.addEventListener("abort", abort, { once: true });

    try {
      if (request.signal?.aborted) throw new LlmAbortedError("LLM request was aborted.");
      const headers = new Headers({ "content-type": "application/json" });
      this.config.authorize(headers);
      const response = await this.fetchImpl(`${this.config.baseUrl}/responses`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) throw await errorFromResponse(response);

      const payload: unknown = await response.json();
      if (!isRecord(payload)) throw new LlmRequestError("LLM provider returned an invalid response body.");
      const id = optionalString(payload.id);
      if (!id) throw new LlmRequestError("LLM provider response is missing an id.");
      const incompleteDetails = isRecord(payload.incomplete_details) ? payload.incomplete_details : undefined;
      return {
        id,
        provider: this.name,
        model: optionalString(payload.model) ?? this.config.model,
        status: statusOf(payload.status),
        text: parseText(payload),
        toolCalls: parseToolCalls(payload.output),
        ...(parseUsage(payload.usage) ? { usage: parseUsage(payload.usage) } : {}),
        session: { previousResponseId: id },
        ...(response.headers.get("x-request-id")
          ? { requestId: response.headers.get("x-request-id")! }
          : {}),
        ...(optionalString(incompleteDetails?.reason)
          ? { incompleteReason: optionalString(incompleteDetails?.reason) }
          : {}),
      };
    } catch (error) {
      if (timedOut) throw new LlmTimeoutError(`LLM request exceeded ${this.config.timeoutMs} ms.`);
      if (request.signal?.aborted || (controller.signal.aborted && !timedOut)) {
        throw new LlmAbortedError("LLM request was aborted.");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      request.signal?.removeEventListener("abort", abort);
    }
  }
}

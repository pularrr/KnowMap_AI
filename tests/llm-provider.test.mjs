import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true, hmr: false },
});

const llm = await vite.ssrLoadModule("/server/llm/index.ts");
const configModule = await vite.ssrLoadModule("/server/config/index.ts");
after(async () => vite.close());

const environment = (overrides = {}) => ({
  LLM_API_KEY: "test-secret-key",
  LLM_MODEL: "test-model",
  LLM_TIMEOUT_MS: "1000",
  LLM_MAX_OUTPUT_TOKENS: "2048",
  LLM_MAX_TOOL_ROUNDS: "6",
  LLM_MAX_INPUT_CHARS: "10000",
  LLM_MAX_TOOLS: "8",
  ...overrides,
});

test("plain Responses API text and usage are normalized without exposing the key", async () => {
  let captured;
  const provider = llm.createConfiguredLlmProvider({
    environment: environment(),
    fetch: async (url, init) => {
      captured = { url: String(url), init, body: JSON.parse(init.body) };
      return new Response(JSON.stringify({
        id: "resp_text",
        model: "test-model-2026",
        status: "completed",
        output: [{
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "FMCW answer" }],
        }],
        usage: {
          input_tokens: 14,
          output_tokens: 5,
          total_tokens: 19,
          input_tokens_details: { cached_tokens: 4 },
          output_tokens_details: { reasoning_tokens: 2 },
        },
      }), { status: 200, headers: { "content-type": "application/json", "x-request-id": "req_1" } });
    },
  });

  const result = await provider.createResponse({
    instructions: "Answer from the graph.",
    messages: [{ role: "user", content: "Explain beat frequency." }],
    maxOutputTokens: 512,
    // JavaScript callers can add unknown fields; the provider must ignore them.
    baseUrl: "https://client-controlled.invalid/v1",
  });

  assert.equal(captured.url, "https://api.openai.com/v1/responses");
  assert.equal(new Headers(captured.init.headers).get("authorization"), "Bearer test-secret-key");
  assert.equal(captured.body.baseUrl, undefined);
  assert.equal(captured.body.base_url, undefined);
  assert.equal(captured.body.model, "test-model");
  assert.equal(captured.body.max_output_tokens, 512);
  assert.equal(result.text, "FMCW answer");
  assert.equal(result.session.previousResponseId, "resp_text");
  assert.deepEqual(result.usage, {
    inputTokens: 14,
    outputTokens: 5,
    totalTokens: 19,
    cachedInputTokens: 4,
    reasoningTokens: 2,
  });
  assert.equal(result.requestId, "req_1");

  const config = configModule.loadLlmConfig(environment());
  const serialized = JSON.stringify(config);
  assert.doesNotMatch(serialized, /test-secret-key/);
  assert.equal(config.toJSON().configured, true);
});

test("function calls continue with previous_response_id and function_call_output", async () => {
  const requests = [];
  const responses = [
    {
      id: "resp_tool",
      model: "test-model",
      status: "completed",
      output: [{
        id: "fc_1",
        type: "function_call",
        call_id: "call_lookup",
        name: "get_node",
        arguments: "{\"nodeId\":\"jpda\"}",
      }],
    },
    {
      id: "resp_final",
      model: "test-model",
      status: "completed",
      output_text: "JPDA is a probabilistic association method.",
      output: [],
    },
  ];
  const provider = llm.createConfiguredLlmProvider({
    environment: environment({ LLM_BASE_URL: "https://llm.example.test/compatible/v1/" }),
    fetch: async (url, init) => {
      requests.push({ url: String(url), body: JSON.parse(init.body) });
      return Response.json(responses[requests.length - 1]);
    },
  });

  const first = await provider.createResponse({
    messages: [{ role: "user", content: "What is JPDA?" }],
    tools: [{
      name: "get_node",
      description: "Read one knowledge node.",
      parameters: {
        type: "object",
        properties: { nodeId: { type: "string" } },
        required: ["nodeId"],
        additionalProperties: false,
      },
    }],
  });
  assert.deepEqual(first.toolCalls[0].arguments, { nodeId: "jpda" });
  assert.equal(first.toolCalls[0].callId, "call_lookup");

  const second = await provider.createResponse({
    session: first.session,
    toolOutputs: [{ callId: first.toolCalls[0].callId, output: { title: "JPDA" } }],
    tools: [{
      name: "get_node",
      description: "Read one knowledge node.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    }],
  });

  assert.equal(requests[0].url, "https://llm.example.test/compatible/v1/responses");
  assert.equal(requests[1].body.previous_response_id, "resp_tool");
  assert.deepEqual(requests[1].body.input, [{
    type: "function_call_output",
    call_id: "call_lookup",
    output: "{\"title\":\"JPDA\"}",
  }]);
  assert.equal(second.text, "JPDA is a probabilistic association method.");
});

test("request limits and AbortSignal are enforced before or during fetch", async () => {
  const provider = llm.createConfiguredLlmProvider({
    environment: environment({ LLM_MAX_OUTPUT_TOKENS: "16", LLM_MAX_TOOLS: "1" }),
    fetch: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }),
  });

  await assert.rejects(
    provider.createResponse({ messages: [{ role: "user", content: "x" }], maxOutputTokens: 17 }),
    /configured limit of 16/,
  );
  await assert.rejects(
    provider.createResponse({
      messages: [{ role: "user", content: "x" }],
      tools: [
        { name: "a", description: "a", parameters: {} },
        { name: "b", description: "b", parameters: {} },
      ],
    }),
    /Tool count exceeds/,
  );

  const controller = new AbortController();
  const pending = provider.createResponse({
    messages: [{ role: "user", content: "wait" }],
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(pending, { name: "LlmAbortedError" });
});

test("function outputs require a stateful session and HTTP errors stay sanitized", async () => {
  const provider = llm.createConfiguredLlmProvider({
    environment: environment(),
    fetch: async () => new Response(JSON.stringify({
      error: { message: "provider rejected request", code: "bad_request" },
    }), { status: 400, headers: { "content-type": "application/json", "x-request-id": "req_error" } }),
  });
  await assert.rejects(
    provider.createResponse({ toolOutputs: [{ callId: "call_1", output: "ok" }] }),
    /previous response id/,
  );
  await assert.rejects(
    provider.createResponse({ messages: [{ role: "user", content: "bad" }] }),
    (error) => {
      assert.equal(error.name, "LlmHttpError");
      assert.equal(error.status, 400);
      assert.equal(error.requestId, "req_error");
      assert.equal(error.code, "bad_request");
      assert.doesNotMatch(error.message, /test-secret-key/);
      return true;
    },
  );
});

test("Responses provider forwards the built-in web search tool without exposing configuration", async () => {
  let captured;
  const provider = llm.createConfiguredLlmProvider({
    environment: environment({ LLM_BASE_URL: "https://api.deepseek.com" }),
    fetch: async (_url, init) => {
      captured = JSON.parse(init.body);
      return Response.json({ id: "resp_web", model: "test-model", status: "completed", output_text: "researched", output: [] });
    },
  });
  const result = await provider.createResponse({ messages: [{ role: "user", content: "research" }], tools: [{ type: "web_search" }], toolChoice: "required" });
  assert.deepEqual(captured.tools, [{ type: "web_search" }]);
  assert.equal(captured.store, false);
  assert.equal(result.text, "researched");
});

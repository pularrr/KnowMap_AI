import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { realpath } from "node:fs/promises";
import { basename, join, relative, resolve, sep } from "node:path";
import { spawn } from "node:child_process";
import type { CodeCitation, CodeGraphIndexState, RepositoryConnection } from "../../core/codegraph/schema";

const DEFAULT_EXCLUDES = [".git/**", ".env*", "**/*.pem", "**/*.key", "node_modules/**", "dist/**", "build/**", "coverage/**"];

export class CodeGraphUnavailableError extends Error {}
export class RepositoryAccessError extends Error {}

export type CodeContextBundle = { answer: string; citations: CodeCitation[]; limitations: string[] };
export type CodeGraphFile = { path: string; language: string; nodeCount: number; size: number };

export interface CodeGraphAdapter {
  indexRepository(connection: RepositoryConnection, signal?: AbortSignal): Promise<{ revision?: string }>;
  syncRepository(connection: RepositoryConnection, signal?: AbortSignal): Promise<{ revision?: string }>;
  getRepositoryStatus(connection: RepositoryConnection): Promise<{ state: CodeGraphIndexState; revision?: string }>;
  getRelatedContext(connection: RepositoryConnection, question: string, signal?: AbortSignal): Promise<CodeContextBundle>;
  listFiles(connection: RepositoryConnection, signal?: AbortSignal): Promise<CodeGraphFile[]>;
}

function commandSpec(): { executable: string; prefixArgs: string[] } {
  if (process.env.CODEGRAPH_COMMAND?.trim()) return { executable: process.env.CODEGRAPH_COMMAND.trim(), prefixArgs: [] };
  // npm global executables are not always inherited by a desktop-launched
  // Next process on Windows. Invoke the package shim with Node directly rather
  // than shelling out through codegraph.cmd, so user questions never become
  // shell syntax. The explicit env override remains authoritative.
  if (process.platform === "win32" && process.env.APPDATA) return { executable: process.execPath, prefixArgs: [join(process.env.APPDATA, "npm", "node_modules", "@colbymchenry", "codegraph", "npm-shim.js")] };
  return { executable: "codegraph", prefixArgs: [] };
}

function runCli(args: string[], cwd: string, signal?: AbortSignal): Promise<string> {
  return new Promise((resolveResult, reject) => {
    const spec = commandSpec();
    const child = spawn(spec.executable, [...spec.prefixArgs, ...args], { cwd, windowsHide: true, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, CODEGRAPH_TELEMETRY: "0" } });
    let stdout = "", stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", (error) => reject(new CodeGraphUnavailableError(`CodeGraph 不可用：${error.message}`)));
    child.once("close", (code) => code === 0 ? resolveResult(stdout) : reject(new Error(`CodeGraph 命令失败（${code ?? "unknown"}）：${stderr || stdout}`)));
    signal?.addEventListener("abort", () => child.kill(), { once: true });
  });
}

function runProgram(program: string, args: string[], cwd: string): Promise<string | undefined> {
  return new Promise((resolveResult) => {
    const child = spawn(program, args, { cwd, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    let stdout = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.once("error", () => resolveResult(undefined));
    child.once("close", (code) => resolveResult(code === 0 ? stdout.trim() || undefined : undefined));
  });
}

function revisionFrom(text: string) {
  const match = text.match(/(?:revision|commit|HEAD)\s*[:=]\s*([0-9a-f]{7,64})/i);
  return match?.[1];
}

async function repositoryRevision(rootPath: string) {
  return await runProgram("git", ["rev-parse", "HEAD"], rootPath) ?? "working-tree";
}

type ContextJson = {
  summary?: unknown;
  codeBlocks?: Array<{ filePath?: unknown; startLine?: unknown; endLine?: unknown; content?: unknown; nodeName?: unknown }>;
};

function parseContextJson(raw: string, revision: string): CodeContextBundle {
  let parsed: ContextJson;
  try { parsed = JSON.parse(raw) as ContextJson; }
  catch { throw new Error("CodeGraph context 未返回 JSON；请确认已安装 colbymchenry/codegraph 1.6.0 或更高版本。"); }
  const blocks = (parsed.codeBlocks ?? []).flatMap((block) => typeof block.filePath === "string"
    && typeof block.startLine === "number" && typeof block.endLine === "number" && typeof block.content === "string"
    ? [{ path: block.filePath, startLine: block.startLine, endLine: block.endLine, ...(typeof block.nodeName === "string" ? { symbol: block.nodeName } : {}), revision, contentHash: createHash("sha256").update(block.content).digest("hex"), source: "codegraph-fact" as const, content: block.content }]
    : []);
  const citations = blocks.map(({ content: _content, ...citation }) => citation);
  const text = [
    typeof parsed.summary === "string" ? parsed.summary : "",
    ...blocks.map((block) => `\n\n【${block.path}:${block.startLine}-${block.endLine}${block.symbol ? ` · ${block.symbol}` : ""}】\n\`\`\`\n${block.content}\n\`\`\``),
  ].filter(Boolean).join("\n");
  return { answer: text, citations, limitations: citations.length ? [] : ["CodeGraph 未返回可核验代码块，本轮不会将源码作为事实证据。"] };
}

/** The external executable is isolated here: no route, UI or knowledge agent
 * invokes CodeGraph directly. P4-0 uses its documented local-command mode. */
export class LocalCodeGraphAdapter implements CodeGraphAdapter {
  async indexRepository(connection: RepositoryConnection, signal?: AbortSignal) {
    await runCli(["init"], connection.rootPath, signal);
    return { revision: await repositoryRevision(connection.rootPath) };
  }

  async syncRepository(connection: RepositoryConnection, signal?: AbortSignal) {
    await runCli(["sync"], connection.rootPath, signal);
    return { revision: await repositoryRevision(connection.rootPath) };
  }

  async getRepositoryStatus(connection: RepositoryConnection) {
    try {
      const result = await runCli(["status"], connection.rootPath);
      return { state: (/up to date|ready|indexed|healthy/i.test(result) ? "ready" : "stale") as CodeGraphIndexState, revision: revisionFrom(result) ?? await repositoryRevision(connection.rootPath) };
    } catch (error) {
      if (error instanceof CodeGraphUnavailableError) return { state: "failed" as const };
      throw error;
    }
  }

  async getRelatedContext(connection: RepositoryConnection, question: string, signal?: AbortSignal): Promise<CodeContextBundle> {
    const answer = await runCli(["context", "--format", "json", "--max-nodes", "4", question], connection.rootPath, signal);
    return parseContextJson(answer, await repositoryRevision(connection.rootPath));
  }

  async listFiles(connection: RepositoryConnection, signal?: AbortSignal): Promise<CodeGraphFile[]> {
    const output = await runCli(["files", "--format", "flat", "--json"], connection.rootPath, signal);
    try {
      const values = JSON.parse(output) as Array<Partial<CodeGraphFile>>;
      return values.flatMap((value) => typeof value.path === "string"
        ? [{ path: value.path.replaceAll("\\", "/"), language: typeof value.language === "string" ? value.language : "text", nodeCount: typeof value.nodeCount === "number" && Number.isSafeInteger(value.nodeCount) ? value.nodeCount : 0, size: typeof value.size === "number" && Number.isSafeInteger(value.size) ? value.size : 0 }]
        : []);
    } catch {
      throw new Error("CodeGraph files 未返回 JSON，无法构建源码解读导航分支。");
    }
  }
}

export async function validateRepositoryRoot(input: string): Promise<string> {
  if (!input || !existsSync(input)) throw new RepositoryAccessError("仓库目录不存在。");
  const root = await realpath(input);
  const configuredRoots = (process.env.CODEGRAPH_ALLOWED_ROOTS ?? process.cwd()).split(";").filter(Boolean).map((item) => resolve(/* turbopackIgnore: dynamic user-configured path */ item));
  const permitted = configuredRoots.some((allowed) => root === allowed || root.startsWith(`${allowed}${sep}`));
  if (!permitted) throw new RepositoryAccessError("该目录不在 CODEGRAPH_ALLOWED_ROOTS 允许范围内。");
  return root;
}

export function createRepository(rootPath: string, allowContext: boolean): RepositoryConnection {
  const now = new Date().toISOString();
  return { id: randomUUID(), rootPath, displayName: basename(rootPath), allowedToSendContext: allowContext, excludePatterns: [...DEFAULT_EXCLUDES], state: "idle", createdAt: now, updatedAt: now };
}

export function citationForFile(rootPath: string, absolutePath: string, text: string, startLine = 1, endLine = 1): CodeCitation {
  return { path: relative(rootPath, absolutePath).replaceAll("\\", "/"), startLine, endLine, revision: "unverified", contentHash: createHash("sha256").update(text).digest("hex"), source: "codegraph-fact" };
}

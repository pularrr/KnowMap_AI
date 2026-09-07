import type { Context } from "@deepseek-ai/cordis";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { resolve, relative, isAbsolute } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const name = "knowmap-dsh";
export const inject = ["tools"];
export interface Config { projectRoot?: string; outputRoot: string }
type SafeAction = "profile-example" | "validate-profile" | "validate" | "inject";

function inside(root: string, value: string) {
  const path = resolve(root, value); const rel = relative(root, path);
  if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) return path;
  throw new Error(`路径超出隔离任务目录: ${value}`);
}
function outside(projectRoot: string, outputRoot: string) {
  const rel = relative(projectRoot, outputRoot);
  if (rel === "" || (!rel.startsWith("..") && !isAbsolute(rel))) throw new Error("outputRoot 必须位于 KnowMap 项目根目录之外");
}

export async function apply(ctx: Context, config: Config) {
  if (!config?.outputRoot) throw new Error("knowmap-dsh 必须配置项目外的 outputRoot");
  const projectRoot = resolve(config.projectRoot ?? fileURLToPath(new URL("../../..", import.meta.url)));
  const outputRoot = resolve(config.outputRoot); outside(projectRoot, outputRoot);
  const { runKnowmap } = await import(pathToFileURL(resolve(projectRoot, "scripts", "knowmap.mjs")).href) as { runKnowmap(input: { action: SafeAction; input?: string; output?: string }): Promise<unknown> };
  const { createApp } = await import(pathToFileURL(resolve(projectRoot, "scripts", "create-app.mjs")).href) as { createApp(input: { profileFile: string; name: string; output: string }): Promise<unknown> };

  const register = (action: SafeAction, description: string, inputRequired = true) => ctx.tools.register(defineTool({
    name: `knowmap_${action.replaceAll("-", "_")}`, description,
    parameters: {
      input: { type: "string", ...(inputRequired ? { required: true as const } : {}), description: "隔离任务目录内、由 DSH 宿主编写的 JSON 文件。" },
      output: { type: "string", required: true, description: "隔离任务目录内的新输出路径。" },
    },
    output: { schema: { type: "string" }, render: (_args: unknown, value: string) => [{ type: "text", text: value }] },
    async execute(args: { input?: string; output: string }) {
      return JSON.stringify(await runKnowmap({ action, input: args.input ? inside(outputRoot, args.input) : undefined, output: inside(outputRoot, args.output) }), null, 2);
    },
  }));

  register("profile-example", "在隔离目录输出 Profile 示例，不调用任何项目 LLM Provider。", false);
  register("validate-profile", "校验 DSH 宿主直接编写的 TaskProfile；13栏目应按任务选择子集。");
  register("validate", "校验 DSH 宿主直接编写的 MVP 或完整知识网络。");
  register("inject", "把已审查网络注入隔离目录中的新应用，不调用项目 LLM Provider。");
  ctx.tools.register(defineTool({
    name: "knowmap_create_app", description: "从已校验 Profile 在隔离目录创建新的 KnowMap 应用。",
    parameters: {
      profileFile: { type: "string", required: true, description: "隔离目录内的 Profile JSON。" },
      name: { type: "string", required: true, description: "小写英文、数字和连字符组成的应用名。" },
      output: { type: "string", required: true, description: "隔离目录内尚不存在的应用目录。" },
    },
    output: { schema: { type: "string" }, render: (_args: unknown, value: string) => [{ type: "text", text: value }] },
    async execute(args: { profileFile: string; name: string; output: string }) {
      return JSON.stringify(await createApp({ profileFile: inside(outputRoot, args.profileFile), name: args.name, output: inside(outputRoot, args.output) }), null, 2);
    },
  }));
}
export default { name, inject, apply };

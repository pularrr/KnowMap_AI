#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { discoverKnowmap } from "../plugin/discovery.mjs";
import { withProjectModules } from "./lib/project-modules.mjs";

const read = path => JSON.parse(readFileSync(resolve(path), "utf8").replace(/^\uFEFF/, ""));
const write = (path, data) => { mkdirSync(dirname(resolve(path)), { recursive: true }); writeFileSync(resolve(path), JSON.stringify(data, null, 2), { encoding: "utf8", flag: "wx" }); };

export async function runKnowmap({ action, input, output }) {
  if (action === "discover") return discoverKnowmap();
  if (["design", "mvp", "full"].includes(action)) throw new Error("构建阶段禁止调用项目内已配置的 LLM Provider。请由宿主 LLM 按 plugin/SKILL.md 直接生成 JSON，再调用 validate-profile/validate；API Key 仅供生成应用交付后由用户配置。");
  if (!discoverKnowmap().inputSchema.properties.action.enum.includes(action)) throw new Error(`未知 action: ${action}`);
  if (!output) throw new Error("需要 --output");
  if (action !== "inject" && existsSync(resolve(output))) throw new Error("输出已存在；请指定新文件，避免覆盖检查点");
  const request = input ? read(input) : {};
  return withProjectModules(async load => {
    const { validateProfile } = await load("/server/profile/validate-profile.ts");
    if (action === "profile-example") {
      const { LIDAR_TECH_ROUTE_PROFILE } = await load("/plugin/examples/lidar-profile-example.ts");
      const profile = validateProfile(LIDAR_TECH_ROUTE_PROFILE); write(output, profile); return { output: resolve(output), profileId: profile.id };
    }
    if (action === "validate-profile") {
      const profile = validateProfile(request.profile ?? request); write(output, profile); return { valid: true, output: resolve(output) };
    }
    const { networkToDataset } = await load("/server/agent/network-dataset.ts");
    const { validateKnowledgeDataset } = await load("/core/knowledge/validation.ts");
    if (action === "validate" || action === "inject") {
      const profile = validateProfile(request.profile);
      const dataset = networkToDataset(request.network, profile);
      const report = validateKnowledgeDataset(dataset, { profile });
      if (action === "validate") { write(output, report); return report; }
      const app = resolve(output);
      const installedProfile = read(join(app, "profiles", "active.json"));
      if (JSON.stringify(installedProfile) !== JSON.stringify(profile)) throw new Error("产物 Profile 与审查输入不一致；请重新创建脚手架");
      const target = join(app, "data", "runtime", "knowledge-state.json");
      if (existsSync(target) || existsSync(target + ".bak")) throw new Error("运行时状态已存在；请在新产物中注入，或通过应用内审查写入");
      const { RuntimeKnowledgeRepository } = await load("/server/runtime/runtime-repository.ts");
      const repository = new RuntimeKnowledgeRepository(target, dataset);
      if (JSON.stringify(repository.snapshot()) !== JSON.stringify(dataset)) throw new Error("运行时数据往返验证失败");
      return { output: target, totalNodes: dataset.nodes.length, warnings: report.warnings };
    }
    throw new Error(`未实现 action: ${action}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [action = "discover", ...args] = process.argv.slice(2);
  try {
    const options = { action };
    for (let i = 0; i < args.length; i += 2) {
      if (!["--input", "--output"].includes(args[i]) || !args[i + 1]) throw new Error("用法: knowmap.mjs <action> --input <file> --output <path>");
      options[args[i].slice(2)] = args[i + 1];
    }
    console.log(JSON.stringify(await runKnowmap(options), null, 2));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}

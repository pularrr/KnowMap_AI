#!/usr/bin/env node
/**
 * KnowMap 应用脚手架脚本（完整版）
 *
 * P3 插件化：复制完整应用模板 + 注入 Profile + 自动替换配置
 *
 * 用法：
 *   node scripts/create-app.mjs --profile fmcw-radar --name my-app
 *   node scripts/create-app.mjs --list-profiles
 *
 * 功能：
 * - 复制 templates/app/ 完整应用模板（~210个文件，包含通用核心引擎）
 * - 注入选择的 Profile（复制到 profiles/）
 * - 自动替换 app/config.ts 中的占位符（应用名称、根节点ID等）
 * - 自动替换 package.json 中的 name
 * - 创建空的 data/runtime/ 目录（用户自己配置 LLM 和生成知识数据）
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync, rmSync } from "fs";
import { join, resolve, basename } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");
const TEMPLATE_DIR = join(PROJECT_ROOT, "templates", "app");

// 解析命令行参数
function parseArgs() {
  const args = process.argv.slice(2);
  const result = {
    profile: null,
    name: null,
    listProfiles: false,
    output: null,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--profile":
      case "-p":
        result.profile = args[++i];
        break;
      case "--name":
      case "-n":
        result.name = args[++i];
        break;
      case "--output":
      case "-o":
        result.output = args[++i];
        break;
      case "--list-profiles":
      case "-l":
        result.listProfiles = true;
        break;
      case "--help":
      case "-h":
        result.help = true;
        break;
    }
  }

  return result;
}

// 打印帮助信息
function printHelp() {
  console.log(`
KnowMap 应用脚手架（完整版）

用法：
  node scripts/create-app.mjs --profile <profile-id> --name <app-name>
  node scripts/create-app.mjs --list-profiles

选项：
  -p, --profile <id>     Profile ID（如 fmcw-radar）
  -n, --name <name>      应用名称（如 my-radar-app）
  -o, --output <path>    输出目录（默认：./<app-name>）
  -l, --list-profiles    列出所有可用 Profile
  -h, --help             显示帮助信息

示例：
  node scripts/create-app.mjs --profile fmcw-radar --name my-radar-app
  node scripts/create-app.mjs --profile lidar --name lidar-knowledge-graph

功能：
  - 复制 templates/app/ 完整应用模板（~210个文件）
  - 包含通用核心引擎：自适应 ReAct、上下文管理、分布式子调用、节点粒度审查、LlmProvider、知识图谱 UI
  - 注入选择的 Profile 配置
  - 自动替换应用名称、根节点 ID 等配置
`);
}

// 列出可用 Profile
function listProfiles() {
  const profilesDir = join(PROJECT_ROOT, "profiles");
  console.log("\n可用 Profile：\n");
  console.log("  ID".padEnd(20) + "名称".padEnd(30) + "说明");
  console.log("  " + "-".repeat(80));

  if (existsSync(profilesDir)) {
    const files = readdirSync(profilesDir).filter((f) => f.endsWith(".ts"));
    for (const file of files) {
      const id = file.replace(".ts", "");
      // 尝试读取 Profile 名称
      let name = "";
      let description = "";
      try {
        const content = readFileSync(join(profilesDir, file), "utf8");
        const nameMatch = content.match(/name:\s*["']([^"']+)["']/);
        if (nameMatch) name = nameMatch[1];
        const descMatch = content.match(/description:\s*["']([^"']+)["']/);
        if (descMatch) description = descMatch[1];
      } catch (e) {
        // 忽略解析错误
      }
      console.log("  " + id.padEnd(20) + (name || "(待加载)").padEnd(30) + (description || ""));
    }
  } else {
    console.log("  （未找到 profiles 目录）");
  }

  console.log("\n提示：使用 --profile <id> --name <app-name> 创建应用\n");
}

// 递归复制目录
function copyDir(src, dest) {
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      copyFileSync(srcPath, destPath);
    }
  }
}

// 替换文件中的占位符
function replacePlaceholders(filePath, replacements) {
  if (!existsSync(filePath)) return;
  let content = readFileSync(filePath, "utf8");
  for (const [placeholder, value] of Object.entries(replacements)) {
    content = content.split(placeholder).join(value);
  }
  writeFileSync(filePath, content, "utf8");
}

// 创建应用
function createApp(profileId, appName, outputPath) {
  if (!profileId) {
    console.error("错误：必须指定 --profile");
    process.exit(1);
  }
  if (!appName) {
    console.error("错误：必须指定 --name");
    process.exit(1);
  }

  const targetDir = outputPath || join(process.cwd(), appName);

  console.log(`\n创建 KnowMap 应用...`);
  console.log(`  Profile: ${profileId}`);
  console.log(`  应用名称: ${appName}`);
  console.log(`  输出目录: ${targetDir}`);
  console.log();

  // 检查模板目录
  if (!existsSync(TEMPLATE_DIR)) {
    console.error(`错误：模板目录不存在: ${TEMPLATE_DIR}`);
    console.error(`请先运行 P3 插件化开发，创建 templates/app/ 目录`);
    process.exit(1);
  }

  // 检查目标目录
  if (existsSync(targetDir)) {
    console.error(`错误：目录 ${targetDir} 已存在`);
    process.exit(1);
  }

  // Step 1: 复制完整应用模板
  console.log("Step 1/5: 复制完整应用模板...");
  copyDir(TEMPLATE_DIR, targetDir);
  console.log("  ✓ 已复制 templates/app/ 完整模板");

  // Step 2: 注入 Profile
  console.log("Step 2/5: 注入 Profile 配置...");
  const profileSource = join(PROJECT_ROOT, "profiles", `${profileId}.ts`);
  const profileTarget = join(targetDir, "profiles", `${profileId}.ts`);
  if (existsSync(profileSource)) {
    // 确保 profiles 目录存在
    if (!existsSync(join(targetDir, "profiles"))) {
      mkdirSync(join(targetDir, "profiles"), { recursive: true });
    }
    copyFileSync(profileSource, profileTarget);
    console.log(`  ✓ 已复制 Profile: ${profileId}`);
  } else {
    console.log(`  ⚠ Profile 文件未找到: ${profileSource}`);
    console.log(`    将创建基础 Profile 模板`);
    // 创建基础 Profile
    const baseProfile = `// ${appName} Profile
// 基于 ${profileId} 模板

export const profile = {
  id: "${profileId}",
  name: "${appName}",
  version: "0.1.0",
  domains: [],
  nodeTypes: [],
  edgeTypes: [],
  cardSections: [],
  validation: { domainCount: 0, visualBranchCount: 0, rootNodeRequired: true },
  prompts: { react: "", review: "", finalResponse: "", ingest: {} },
  initialization: {
    rootNode: { id: "root", name: "${appName}", shortFact: "" },
    mvp: { nodeCount: [15, 30], reactRounds: [2, 3], sectionsFilled: ["definition"], domainCount: [3, 5], durationMinutes: [2, 5] },
    full: { nodeCount: [80, 150], reactRounds: [6, 24], rootBudgetMinutes: [25, 35], durationMinutes: [25, 40] }
  },
};
`;
    writeFileSync(profileTarget, baseProfile, "utf8");
    console.log(`  ✓ 已创建基础 Profile 模板`);
  }

  // Step 3: 替换 app/config.ts 占位符
  console.log("Step 3/5: 替换应用配置占位符...");
  const configPath = join(targetDir, "app", "config.ts");
  const storagePrefix = appName.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const rootNodeId = profileId.toLowerCase().replace(/[^a-z0-9]/g, "-");
  replacePlaceholders(configPath, {
    "{{APP_NAME}}": appName,
    "{{APP_SUBTITLE}}": `${appName}知识网络`,
    "{{ROOT_NODE_ID}}": rootNodeId,
    "{{STORAGE_PREFIX}}": storagePrefix,
    "{{EYEBROW}}": "KNOWLEDGE GRAPH · AI ASSISTANT",
  });
  console.log(`  ✓ 已替换 app/config.ts 占位符`);
  console.log(`    - APP_NAME: ${appName}`);
  console.log(`    - ROOT_NODE_ID: ${rootNodeId}`);
  console.log(`    - STORAGE_PREFIX: ${storagePrefix}`);

  // Step 4: 替换 package.json 中的 name
  console.log("Step 4/5: 替换 package.json 配置...");
  const packageJsonPath = join(targetDir, "package.json");
  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8"));
    packageJson.name = appName;
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), "utf8");
    console.log(`  ✓ 已替换 package.json name: ${appName}`);
  }

  // Step 5: 创建空的 data/runtime/ 目录
  console.log("Step 5/5: 创建运行时数据目录...");
  const runtimeDir = join(targetDir, "data", "runtime");
  if (!existsSync(runtimeDir)) {
    mkdirSync(runtimeDir, { recursive: true });
  }
  // 创建 .gitkeep 文件
  writeFileSync(join(runtimeDir, ".gitkeep"), "", "utf8");
  console.log("  ✓ 已创建 data/runtime/ 目录（用户自己配置 LLM 和生成知识数据）");

  // 完成
  console.log(`\n✓ 应用创建成功！\n`);
  console.log(`  目录: ${targetDir}`);
  console.log();
  console.log(`  包含功能：`);
  console.log(`    ✓ 自适应 ReAct（逐节点重置、自适应预算）`);
  console.log(`    ✓ 上下文管理（compactObservation + rollingContext）`);
  console.log(`    ✓ 分布式子调用（gaps>3 或 newNodes>8 时触发）`);
  console.log(`    ✓ 节点粒度审查（4条规则：多概念节点、名称过长、摘要过长、problem混入解决方法）`);
  console.log(`    ✓ LlmProvider（推理模型兼容、重试、repair）`);
  console.log(`    ✓ 知识图谱 UI（图谱渲染、知识树、卡片面板、聊天界面、字号设置）`);
  console.log(`    ✓ API 路由（/api/agent/generate、/api/chat、/api/knowledge 等）`);
  console.log();
  console.log(`  下一步：`);
  console.log(`    1. cd ${appName}`);
  console.log(`    2. npm install`);
  console.log(`    3. 配置 LLM API（在应用右上角点击"配置 LLM"）`);
  console.log(`    4. 点击"生成知识网络"按钮，生成初始知识图谱`);
  console.log(`    5. npm run dev 启动开发服务器`);
  console.log();
  console.log(`  注意：`);
  console.log(`    - 知识数据存储在 data/runtime/knowledge-state.json`);
  console.log(`    - LLM 配置存储在 data/runtime/llm-config.json`);
  console.log(`    - Profile 配置在 profiles/${profileId}.ts，可根据需要修改`);
  console.log();
}

// 主函数
function main() {
  const args = parseArgs();

  if (args.help) {
    printHelp();
    return;
  }

  if (args.listProfiles) {
    listProfiles();
    return;
  }

  createApp(args.profile, args.name, args.output);
}

main();

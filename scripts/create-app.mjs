#!/usr/bin/env node
/**
 * KnowMap 应用脚手架脚本
 *
 * P3-2 Step7：Profile 加载机制与脚手架
 *
 * 用法：
 *   node scripts/create-app.mjs --profile fmcw-radar --name my-app
 *   node scripts/create-app.mjs --list-profiles
 *
 * 当前版本（基础版）：
 * - 列出可用 Profile
 * - 生成应用目录结构
 * - 复制 Profile 配置
 * - 输出后续步骤说明
 *
 * 完整版本（P3-5/P3-6 完善）：
 * - 复制完整应用模板
 * - 自动安装依赖
 * - 自动配置 LLM
 * - 自动启动开发服务器
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, copyFileSync, readdirSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..");

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
KnowMap 应用脚手架

用法：
  node scripts/create-app.mjs --profile <profile-id> --name <app-name>
  node scripts/create-app.mjs --list-profiles

选项：
  -p, --profile <id>     Profile ID（如 fmcw-radar）
  -n, --name <name>      应用名称
  -o, --output <path>    输出目录（默认：./<app-name>）
  -l, --list-profiles    列出所有可用 Profile
  -h, --help             显示帮助信息

示例：
  node scripts/create-app.mjs --profile fmcw-radar --name my-radar-app
  node scripts/create-app.mjs --list-profiles
`);
}

// 列出可用 Profile
function listProfiles() {
  const profilesDir = join(PROJECT_ROOT, "profiles");
  if (!existsSync(profilesDir)) {
    console.log("未找到 profiles 目录");
    return;
  }

  console.log("\n可用 Profile：\n");
  console.log("  ID              名称                              版本");
  console.log("  " + "-".repeat(70));

  // FMCW Profile（已知）
  console.log("  fmcw-radar      FMCW 毫米波雷达知识网络           0.1.0");

  // 扫描 profiles 目录中的其他 Profile
  if (existsSync(profilesDir)) {
    const files = readdirSync(profilesDir).filter((f) => f.endsWith(".ts") && f !== "fmcw-radar.ts");
    for (const file of files) {
      const id = file.replace(".ts", "");
      console.log(`  ${id.padEnd(16)}（待加载）`.padEnd(50) + "  -");
    }
  }

  console.log("\n提示：使用 --profile <id> --name <app-name> 创建应用\n");
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

  // 检查目标目录
  if (existsSync(targetDir)) {
    console.error(`错误：目录 ${targetDir} 已存在`);
    process.exit(1);
  }

  // 创建目录结构
  const dirs = [
    "",
    "app",
    "app/api",
    "components",
    "core",
    "core/knowledge",
    "data",
    "data/runtime",
    "profiles",
    "server",
    "server/agent",
    "server/profile",
    "public",
    "scripts",
    "docs",
  ];

  for (const dir of dirs) {
    mkdirSync(join(targetDir, dir), { recursive: true });
  }
  console.log("✓ 创建目录结构");

  // 复制 Profile
  const profileSource = join(PROJECT_ROOT, "profiles", `${profileId}.ts`);
  const profileTarget = join(targetDir, "profiles", `${profileId}.ts`);
  if (existsSync(profileSource)) {
    copyFileSync(profileSource, profileTarget);
    console.log(`✓ 复制 Profile: ${profileId}`);
  } else {
    console.log(`⚠ Profile 文件未找到: ${profileSource}`);
    console.log(`  将创建基础 Profile 模板`);
    writeFileSync(
      profileTarget,
      `// ${appName} Profile\n// 基于 ${profileId} 模板\n\nexport const profile = {\n  id: "${profileId}",\n  name: "${appName}",\n  version: "0.1.0",\n  domains: [],\n  nodeTypes: [],\n  edgeTypes: [],\n  cardSections: [],\n  validation: { domainCount: 0, visualBranchCount: 0, rootNodeRequired: true },\n  prompts: { react: "", review: "", finalResponse: "", ingest: {} },\n  initialization: { rootNode: { id: "root", name: "${appName}", shortFact: "" }, mvp: { nodeCount: [15, 30], reactRounds: [2, 3], sectionsFilled: ["definition"], domainCount: [3, 5], durationMinutes: [2, 5] }, full: { nodeCount: [80, 150], reactRounds: [6, 24], rootBudgetMinutes: [25, 35], durationMinutes: [25, 40] } },\n};\n`,
      "utf8"
    );
  }

  // 创建 package.json
  const packageJson = {
    name: appName,
    version: "0.1.0",
    private: true,
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "next lint",
      "type-check": "tsc --noEmit",
    },
    dependencies: {
      next: "^16.2.6",
      react: "^19.2.6",
      "react-dom": "^19.2.6",
    },
    devDependencies: {
      typescript: "^5.9.3",
      "@types/node": "^22.13.0",
      "@types/react": "^19.0.0",
      "@types/react-dom": "^19.0.0",
    },
  };
  writeFileSync(join(targetDir, "package.json"), JSON.stringify(packageJson, null, 2), "utf8");
  console.log("✓ 创建 package.json");

  // 创建 tsconfig.json
  const tsconfig = {
    compilerOptions: {
      target: "ES2022",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      plugins: [{ name: "next" }],
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  };
  writeFileSync(join(targetDir, "tsconfig.json"), JSON.stringify(tsconfig, null, 2), "utf8");
  console.log("✓ 创建 tsconfig.json");

  // 创建 README
  const readme = `# ${appName}

基于 KnowMap 插件生成的知识图谱应用。

## Profile

- ID: ${profileId}
- 配置文件: profiles/${profileId}.ts

## 快速开始

\`\`\`bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 类型检查
npm run type-check
\`\`\`

## 项目结构

\`\`\`
${appName}/
├── app/                    # Next.js App Router
├── components/             # React 组件
├── core/                   # 核心逻辑（知识图谱 schema、验证、栏目）
├── data/                   # 运行时数据
├── profiles/               # Profile 配置
├── server/                 # 服务端逻辑（Agent、Profile 加载）
├── scripts/                # 脚本
└── docs/                   # 文档
\`\`\`

## 下一步

1. 完善 Profile 配置（profiles/${profileId}.ts）
2. 实现知识图谱 UI 组件
3. 实现 Agent Loop（ReAct 深度检索）
4. 配置 LLM API
5. 运行 \`npm run dev\` 启动应用

## 参考

- KnowMap 插件文档: plugin/SKILL.md
- FMCW 基准应用: ../../fmcw-radar-knowledge-graph
`;
  writeFileSync(join(targetDir, "README.md"), readme, "utf8");
  console.log("✓ 创建 README.md");

  // 完成
  console.log(`\n✓ 应用创建成功！\n`);
  console.log(`  目录: ${targetDir}`);
  console.log();
  console.log(`  下一步：`);
  console.log(`    1. cd ${appName}`);
  console.log(`    2. npm install`);
  console.log(`    3. 完善 profiles/${profileId}.ts`);
  console.log(`    4. npm run dev`);
  console.log();
  console.log(`  注意：当前为基础脚手架，完整应用模板将在 P3-5/P3-6 完善。`);
  console.log(`  可参考 FMCW 基准应用（${PROJECT_ROOT}）的完整实现。\n`);
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

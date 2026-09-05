/** Host-neutral discovery. The host registers the descriptor and supplies local tool access. */
export function discoverKnowmap() {
  return {
    schemaVersion: "knowmap-discovery/1",
    name: "knowmap_plugin",
    description: "从用户主题设计 Profile，生成并确认 MVP，研究完整知识网络，校验后交付可运行的知识图谱应用。已有应用内问答请使用运行时 API。",
    inputSchema: { type: "object", properties: {
      action: { type: "string", enum: ["profile-example", "design", "validate-profile", "mvp", "full", "validate", "inject"] },
      input: { type: "string", description: "本地 JSON 输入文件绝对路径；profile-example 可省略" },
      output: { type: "string", description: "新的输出文件；inject 时为已有应用目录" },
    }, required: ["action", "output"], additionalProperties: false },
    entrypoint: "node scripts/knowmap.mjs <action> --input <json-file> --output <path>",
    skill: "plugin/SKILL.md", scaffold: "node scripts/create-app.mjs --profile-file <profile.json> --name <name> --output <directory>",
    requirements: { localTools: true, node: ">=22.13.0", dependencies: "npm install", generationProtocol: "Responses API with structured JSON output; web_search is optional" },
    limits: ["宿主必须显式注册此描述或加载 SKILL.md；模型不会自行扫描磁盘。", "发现接口不安装插件、不配置密钥、不证明所有模型或 API 协议兼容。", "full 需要确认过的 MVP；研究上限35分钟，节点数量是建议目标。"],
  };
}
export default discoverKnowmap;

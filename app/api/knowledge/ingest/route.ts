import { NextResponse } from "next/server";
import { stageTextImport } from "../../../../core/ingestion/offline-intake";
import { onlineAgentService } from "../../../../server/agent/online-agent-service";

export const runtime = "nodejs";

const INGEST_PROMPTS: Record<string, string> = {
  conversation: `你正在整理一段与其他 LLM 的对话记录。请：
1. 提取对话中的核心观点、结论和达成一致的知识点；
2. 识别对话中提到的方法、算法、参数和工程取舍；
3. 区分"已确认的事实"和"讨论中的推测"，只把可验证的事实作为知识候选；
4. 检索当前图谱判断这些知识点是否已存在，是续写已有卡片还是创建新节点；
5. 对话中的口语化表达请转为规范的学术表述。

对话内容如下：
`,
  summary: `你正在整理一份知识摘要。请：
1. 提取摘要中的关键知识点、方法、结论和数据；
2. 判断每个知识点与当前图谱的关系（已存在/补充/冲突/新增）；
3. 对已存在的节点，判断应续写哪个栏目；对新知识，判断应创建什么类型的节点；
4. 只保留可验证、有实质内容的知识点，过滤空泛描述。

摘要内容如下：
`,
  paper: `你正在整理一篇最新文献方案或技术方案。请：
1. 提取方案的关键设计：核心方法、创新点、算法流程、关键参数和假设；
2. 识别方案与现有图谱中方法的关系（替代/补充/扩展/冲突）；
3. 对方法类知识，优先创建 method 或 algorithm 类型节点，父级指向当前节点或最相关的已有节点；
4. 提取方案中的实验结论、性能指标和适用场景作为卡片内容；
5. 明确标注方案中的不确定性和未验证部分。

文献方案内容如下：
`,
  document: `你正在整理一份技术文档。请：
1. 提取文档中的关键知识点、定义、方法和结论；
2. 检索当前图谱判断知识点是否已存在，决定续写卡片或创建新节点；
3. 只保留可验证、有实质内容的知识点。

文档内容如下：
`,
};

export async function POST(request: Request) {
  try {
    const body = await request.json() as { sessionId?: string; nodeId?: string; title?: string; text?: string; kind?: "conversation" | "summary" | "paper" | "document" };
    if (!body.sessionId?.trim() || !body.nodeId?.trim() || !body.text?.trim()) throw new Error("sessionId, nodeId and source text are required.");
    const kind = body.kind ?? "document";
    const staged = stageTextImport({ kind, title: body.title?.trim() || "用户提供资料", text: body.text, suppliedBy: "local-user", currentNodeId: body.nodeId });
    const promptTemplate = INGEST_PROMPTS[kind] ?? INGEST_PROMPTS.document;
    const result = await onlineAgentService().deepSearch({
      sessionId: body.sessionId,
      nodeId: body.nodeId,
      query: `${promptTemplate}${body.text.slice(0, 20_000)}`,
      staged,
    });
    return NextResponse.json({ ...result, stagedArtifactId: staged.artifact.id, stagedClaimCount: staged.claims.length, ingestKind: kind });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Knowledge ingestion failed." }, { status: 400 });
  }
}

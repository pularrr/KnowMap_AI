import { NextResponse } from "next/server";
import { stageTextImport } from "../../../../core/ingestion/offline-intake";
import { onlineAgentService } from "../../../../server/agent/online-agent-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { sessionId?: string; nodeId?: string; title?: string; text?: string; kind?: "conversation" | "summary" | "paper" | "document" };
    if (!body.sessionId?.trim() || !body.nodeId?.trim() || !body.text?.trim()) throw new Error("sessionId, nodeId and source text are required.");
    const staged = stageTextImport({ kind: body.kind ?? "document", title: body.title?.trim() || "用户提供资料", text: body.text, suppliedBy: "local-user", currentNodeId: body.nodeId });
    const result = await onlineAgentService().deepSearch({ sessionId: body.sessionId, nodeId: body.nodeId, query: `整理这份资料并扩充当前节点：\n${body.text.slice(0, 20_000)}`, staged });
    return NextResponse.json({ ...result, stagedArtifactId: staged.artifact.id, stagedClaimCount: staged.claims.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Knowledge ingestion failed." }, { status: 400 });
  }
}

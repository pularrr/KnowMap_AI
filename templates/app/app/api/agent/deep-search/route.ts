import { NextResponse } from "next/server";
import { onlineAgentService } from "../../../../server/agent/online-agent-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { sessionId?: string; nodeId?: string; query?: string };
    if (!body.sessionId?.trim() || !body.nodeId?.trim()) throw new Error("sessionId and nodeId are required.");
    return NextResponse.json(await onlineAgentService().deepSearch({ sessionId: body.sessionId, nodeId: body.nodeId, query: body.query?.trim() || "" }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Deep search failed." }, { status: 400 });
  }
}

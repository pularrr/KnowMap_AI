import { NextResponse } from "next/server";
import { onlineAgentService } from "../../../../server/agent/online-agent-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { sessionId?: string; nodeId?: string; query?: string };
    if (!body.sessionId?.trim() || !body.nodeId?.trim() || !body.query?.trim()) throw new Error("sessionId, nodeId and query are required.");
    return NextResponse.json(await onlineAgentService().answer({ sessionId: body.sessionId, nodeId: body.nodeId, query: body.query }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Agent request failed." }, { status: 400 });
  }
}

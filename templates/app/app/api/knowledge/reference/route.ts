import { NextResponse } from "next/server";
import { buildReferenceDataset } from "../../../../server/knowledge/reference-baseline";
import { createPortableKnowledgeBundle } from "../../../../core/knowledge/portable-bundle";
import { onlineAgentService } from "../../../../server/agent/online-agent-service";
export const runtime="nodejs";
export async function GET() {
  const {dataset} = buildReferenceDataset();
  return NextResponse.json(createPortableKnowledgeBundle(dataset),{headers:{"Content-Disposition":'attachment; filename="fmcw-reference-map.json"'}});
}
export async function POST(request:Request) {
  try {
    const {sessionId} = await request.json();
    if (typeof sessionId !== "string" || !sessionId.trim()) throw new Error("缺少会话标识");
    return NextResponse.json(await onlineAgentService().prepareReference(sessionId));
  } catch(error) {return NextResponse.json({error:String(error)},{status:400});}
}

import { NextResponse } from "next/server";
import { buildReferenceDataset } from "../../../../server/knowledge/reference-baseline";
import { createPortableKnowledgeBundle } from "../../../../core/knowledge/portable-bundle";
import { onlineAgentService } from "../../../../server/agent/online-agent-service";
import { ACTIVE_PROFILE } from "../../../../profiles/active";
export const runtime="nodejs";
export async function GET() {
  if (ACTIVE_PROFILE.id !== "fmcw-radar") return NextResponse.json({error:"当前主题不使用 FMCW 基准数据"},{status:404});
  const {dataset} = buildReferenceDataset();
  return NextResponse.json(createPortableKnowledgeBundle(dataset),{headers:{"Content-Disposition":'attachment; filename="fmcw-reference-map.json"'}});
}
export async function POST(request:Request) {
  if (ACTIVE_PROFILE.id !== "fmcw-radar") return NextResponse.json({error:"当前主题不使用 FMCW 基准数据"},{status:404});
  try {
    const {sessionId} = await request.json();
    if (typeof sessionId !== "string" || !sessionId.trim()) throw new Error("缺少会话标识");
    return NextResponse.json(await onlineAgentService().prepareReference(sessionId));
  } catch(error) {return NextResponse.json({error:String(error)},{status:400});}
}

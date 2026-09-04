import { NextResponse } from "next/server";
import { runtimeKnowledgeRepository } from "../../../server/runtime/app-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const repository = runtimeKnowledgeRepository();
  return NextResponse.json({ dataset: repository.snapshot(), savepoints: repository.state().savepoints.map(({ dataset: _dataset, ...item }) => item) });
}

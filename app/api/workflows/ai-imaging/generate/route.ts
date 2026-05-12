import { NextRequest, NextResponse } from "next/server";
import { backendPost } from "@/lib/backend-client";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = await backendPost("/api/workflows/ai-imaging/generate", body);
  return NextResponse.json(data);
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: "Method not allowed", code: 405 },
    { status: 405 }
  );
}

import { NextRequest, NextResponse } from "next/server";
import { backendGet } from "@/lib/backend-client";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const data = await backendGet("/api/workflows/ai-imaging/images", Object.fromEntries(searchParams));
  return NextResponse.json(data);
}

export async function POST() {
  return NextResponse.json(
    { success: false, error: "Method not allowed", code: 405 },
    { status: 405 }
  );
}

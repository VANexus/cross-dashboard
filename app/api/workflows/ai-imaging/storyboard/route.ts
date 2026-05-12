import { NextResponse } from "next/server";
import { backendGet } from "@/lib/backend-client";

export async function GET() {
  const data = await backendGet("/api/workflows/ai-imaging/storyboard");
  return NextResponse.json(data);
}

export async function POST() {
  return NextResponse.json(
    { success: false, error: "Method not allowed", code: 405 },
    { status: 405 }
  );
}

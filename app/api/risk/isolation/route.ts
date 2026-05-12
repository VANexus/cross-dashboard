import { NextRequest, NextResponse } from "next/server";
import { backendGet, backendPatch } from "@/lib/backend-client";

export async function GET() {
  const data = await backendGet("/api/risk/isolation");
  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const data = await backendPatch("/api/risk/isolation", body);
  return NextResponse.json(data);
}

export async function POST() {
  return NextResponse.json(
    { success: false, error: "Method not allowed", code: 405 },
    { status: 405 }
  );
}

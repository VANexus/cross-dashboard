import { NextRequest, NextResponse } from "next/server";
import { backendGet, backendPost } from "@/lib/backend-client";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const data = await backendGet("/api/memory", Object.fromEntries(searchParams));
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const data = await backendPost("/api/memory", body);
  return NextResponse.json(data);
}

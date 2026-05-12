import { NextRequest, NextResponse } from "next/server";
import { backendPatch } from "@/lib/backend-client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const data = await backendPatch(`/api/risk/events/${id}`, body);
  if (!data.success) {
    return NextResponse.json(data, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: "Method not allowed", code: 405 },
    { status: 405 }
  );
}

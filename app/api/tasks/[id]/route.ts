import { NextRequest, NextResponse } from "next/server";
import { backendGet, backendPatch, backendDelete } from "@/lib/backend-client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await backendGet(`/api/tasks/${id}`);
  if (!data.success) {
    return NextResponse.json(data, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const data = await backendPatch(`/api/tasks/${id}`, body);
  if (!data.success) {
    return NextResponse.json(data, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await backendDelete(`/api/tasks/${id}`);
  if (!data.success) {
    return NextResponse.json(data, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function POST() {
  return NextResponse.json(
    { success: false, error: "Method not allowed", code: 405 },
    { status: 405 }
  );
}

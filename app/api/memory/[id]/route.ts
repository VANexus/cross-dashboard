import { NextRequest, NextResponse } from "next/server";
import { backendGet, backendPut, backendDelete } from "@/lib/backend-client";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await backendGet(`/api/memory/${id}`);
  if (!data.success) {
    return NextResponse.json(data, { status: 404 });
  }
  return NextResponse.json(data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const data = await backendPut(`/api/memory/${id}`, body);
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
  const data = await backendDelete(`/api/memory/${id}`);
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

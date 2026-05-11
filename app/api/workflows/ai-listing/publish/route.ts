import { NextRequest } from "next/server";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { publishListingSchema } from "@/lib/api-validation";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = publishListingSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid publish data", parsed.error.flatten());
  return success({ success: true, listingId: `listing-${Date.now()}` });
}

export async function GET() {
  return methodNotAllowed();
}

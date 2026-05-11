import { NextRequest } from "next/server";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { z } from "zod";

const exportSchema = z.object({
  format: z.enum(["csv", "xlsx"]),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = exportSchema.safeParse(body);
  if (!parsed.success) return badRequest("Invalid export params", parsed.error.flatten());
  return success({ url: `/exports/ad-report-${Date.now()}.${parsed.data.format}` });
}

export async function GET() {
  return methodNotAllowed();
}

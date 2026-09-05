import type { NextRequest } from "next/server";
import { withDb } from "@/lib/server/api-helpers";
import { success, badRequest, methodNotAllowed } from "@/lib/server/api-response";
import { WorkflowService } from "@/lib/server/services";

const service = new WorkflowService();

export const POST = withDb(async (request: NextRequest) => {
  let format: "csv" | "xlsx" = "csv";
  try {
    const body = (await request.json()) as { format?: string };
    if (body.format === "xlsx" || body.format === "csv") format = body.format;
  } catch {
    /* 无 body 时按 csv */
  }
  if (format !== "csv" && format !== "xlsx") return badRequest("format 仅支持 csv / xlsx");
  const data = await service.exportAdData(format);
  return success(data);
});

export { methodNotAllowed as GET };
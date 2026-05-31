import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest, methodNotAllowed, error } from "@/lib/api-response";
import { WorkflowService } from "@/lib/services";

const service = new WorkflowService();

export const POST = withDb(async (request: NextRequest) => {
  let body: {
    keyword: string;
    currentData: {
      impressions: number;
      clicks: number;
      spend: number;
      sales: number;
      acos: number;
    };
  };

  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  if (!body.keyword || !body.currentData) {
    return badRequest("Missing required fields: keyword, currentData");
  }

  try {
    const result = await service.analyzeAdKeyword(body);
    return success(result);
  } catch (err) {
    return error(err instanceof Error ? err.message : "操作失败", 500);
  }
});

export { methodNotAllowed as GET };

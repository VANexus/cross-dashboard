import type { NextRequest } from "next/server";
import { withDb } from "@/lib/api-helpers";
import { success, badRequest, methodNotAllowed } from "@/lib/api-response";
import { B2BSettingsService } from "@/lib/services";
import type { B2BSettingsGroup } from "@/lib/types";

const service = new B2BSettingsService();
const GROUPS: B2BSettingsGroup[] = ["mcp", "channel", "alibaba", "longcat", "allin", "webhook"];

export const GET = withDb(async (
  _request: NextRequest,
  { params }: { params: Promise<{ group: string }> },
) => {
  const { group } = await params;
  if (!GROUPS.includes(group as B2BSettingsGroup)) {
    return badRequest(`Unknown group: ${group}. Allowed: ${GROUPS.join(", ")}`);
  }
  const settings = await service.getSettings();
  const result = await service.testGroup(group as B2BSettingsGroup, settings);
  return success(result);
});

export { methodNotAllowed as POST };
export { methodNotAllowed as PUT };
export { methodNotAllowed as DELETE };

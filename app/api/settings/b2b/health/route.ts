import { withDb } from "@/lib/server/api-helpers";
import { success } from "@/lib/server/api-response";
import { B2BSettingsService } from "@/lib/server/services";

const service = new B2BSettingsService();

export const GET = withDb(async () => success(await service.health()));

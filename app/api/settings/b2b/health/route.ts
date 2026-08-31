import { withDb } from "@/lib/api-helpers";
import { success } from "@/lib/api-response";
import { B2BSettingsService } from "@/lib/services";

const service = new B2BSettingsService();

export const GET = withDb(async () => success(await service.health()));

import { withDb } from "@/lib/server/api-helpers";
import { success } from "@/lib/server/api-response";
import { ContentService, ContentMCPError } from "@/lib/server/services";

const service = new ContentService();

/**
 * GET /api/content-studio/health
 *
 * 探活 MCP 服务连接状态 + 运行时统计。
 * 用于前端状态展示或外部监控系统。
 */
export const GET = withDb(async () => {
  const stats = await service.getMCPStatus();

  try {
    const reachable = await service.checkMCPHealth();

    return success({
      status: reachable ? "healthy" : "degraded",
      reachable,
      stats,
    });
  } catch (err) {
    const message = err instanceof ContentMCPError
      ? err.message
      : err instanceof Error ? err.message : "未知错误";

    return success({
      status: "unhealthy",
      reachable: false,
      error: {
        category: err instanceof ContentMCPError ? err.category : "unknown",
        message,
      },
      stats,
    });
  }
});

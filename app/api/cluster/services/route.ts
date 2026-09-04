/**
 * GET /api/cluster/services — 集群服务目录的浏览器脱敏视图
 *
 * 前后端分离 & 服务化的配套端点：浏览器不再持有内网 svc 地址，
 * 只拿到「服务是什么 + 浏览器可达地址（边缘同源反代）+ 形态」。
 * 设置页「集群服务 · 自动连接」卡片与 discovery 预设端点都消费本路由。
 *
 * P2 拆分后本路由随其他路由迁入 flowmind-api（handler 逻辑不变）。
 */
import type { NextRequest } from "next/server";
import { success, CONFIG_CACHE_HEADERS } from "@/lib/server/api-response";
import { clusterMode, publicServiceView } from "@/lib/cluster";

export const GET = async (request: NextRequest) => {
  const origin = new URL(request.url).origin;
  return success(
    { mode: clusterMode(), services: publicServiceView(origin) },
    undefined,
    200,
    CONFIG_CACHE_HEADERS,
  );
};

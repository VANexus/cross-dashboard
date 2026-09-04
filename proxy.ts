import { type NextRequest, NextResponse } from "next/server";

/**
 * FlowMind — Proxy（Next 16，原 Middleware）
 *
 * 当前：请求标记 + 安全响应头。
 * 鉴权占位（全栈架构 §9）：自用期放行；SaaS 阶段在此挂会话校验
 * （乐观检查仅做重定向级拦截，完整鉴权在路由/Server Action 层）。
 */
export function proxy(_: NextRequest) {
  const requestId = crypto.randomUUID();
  const response = NextResponse.next();
  response.headers.set("X-Request-Id", requestId);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

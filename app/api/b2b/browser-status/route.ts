import { withDb } from "@/lib/api-helpers";
import { success, badRequest } from "@/lib/api-response";
import { B2BSettingsService } from "@/lib/services/b2b-settings.service";

/**
 * 用户浏览器 CDP 连接状态（渠道授权主路径）：
 * 探测 /json/version 判连通，/json 列出 tabs 推断各平台是否在浏览器里打开过。
 * 登录态本身永远留在用户浏览器，这里只读元信息，不碰会话内容。
 */
export const GET = withDb(async () => {
  const settings = await new B2BSettingsService().getSettings();
  const cdp = (settings.browserDebugUrl || "").replace(/\/+$/, "");
  if (!cdp) return badRequest("浏览器 CDP 地址未配置");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const version = await fetch(`${cdp}/json/version`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (!version) {
      return success({
        connected: false,
        browser: "",
        cdp,
        hint: "无法连接浏览器调试端口。请完全退出浏览器，然后用带调试端口的方式重启（渠道授权页可复制命令）。",
        platforms: {},
      });
    }
    const tabs = await fetch(`${cdp}/json`, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [] as Array<{ url?: string }>);

    const urls = (Array.isArray(tabs) ? tabs : [])
      .map((t) => (typeof t?.url === "string" ? t.url : ""))
      .filter(Boolean);
    const platforms = {
      tiktok: urls.some((u) => /tiktok\.com/i.test(u)),
      instagram: urls.some((u) => /instagram\.com/i.test(u)),
      alibaba: urls.some((u) => /alibaba\.com/i.test(u)),
    };
    return success({
      connected: true,
      browser: String(version.Browser ?? ""),
      cdp,
      tabs: urls.length,
      platforms,
      hint: "已连接你的浏览器。各平台登录状态以浏览器内实际登录为准（tabs 出现仅代表开过该平台页面）。",
    });
  } finally {
    clearTimeout(timer);
  }
});

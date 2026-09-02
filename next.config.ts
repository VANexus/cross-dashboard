import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

// 加载工作区根目录 .env（KEY=VALUE，忽略注释/空行，值去引号；不覆盖已有环境变量）
try {
  const rootEnv = resolve(process.cwd(), "..", ".env");
  for (const line of readFileSync(rootEnv, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m || line.trimStart().startsWith("#")) continue;
    const key = m[1];
    const value = m[2].replace(/^["']|["']$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
} catch {
  // 根 .env 不存在时静默跳过，使用项目自身 env / 默认值
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  // dev(3000) 与 prod build/benchmark 用不同目录，防止 chunk 文件互踩（NEXT_DIST_DIR=.next-build）
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // 集群化（core-ui 金丝雀）：standalone 产物由 deploy/docker/Dockerfile 打包
  output: "standalone",
  // dev(3000) 与 prod build/benchmark 用不同目录，防止 chunk 文件互踩（NEXT_DIST_DIR=.next-build）
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;

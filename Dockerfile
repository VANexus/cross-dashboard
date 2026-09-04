# =============================================================================
# flowmind — Next.js 16 standalone → 集群 core-ui ns（金丝雀）
#
# 镜像仓库约定：harbor.app.xrak.top/core-ui/flowmind:{SHA8,latest}
# 构建：GitLab CI kaniko（见 .gitlab-ci.yml），勿本地 push（selfHeal 纪律）
# 运行时：node server.js（standalone 产物自带最小依赖树）
#
# 注意：
#   1. 本镜像【零密钥】——所有基础设施端点由 lib/cluster 服务目录在运行时解析，
#      Secret 只注入 flowmind-api / flowmind-mcp；
#   2. P2 前后端分离后本文件继续服务 core-ui；core-api 镜像见 deploy/docker/Dockerfile.api。
# =============================================================================

# ── 依赖安装（Bun 为包管理器，见 AGENTS.md）─────────────────────
FROM oven/bun:1-alpine AS deps
WORKDIR /app
RUN apk add --no-cache git
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

# ── 构建 ───────────────────────────────────────────────────────
FROM oven/bun:1-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# standalone 输出（next.config.ts output:"standalone"）→ .next/standalone
RUN bun run build

# ── 运行 ───────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
RUN addgroup -S flowmind && adduser -S flowmind -G flowmind
COPY --from=build --chown=flowmind:flowmind /app/.next/standalone ./
COPY --from=build --chown=flowmind:flowmind /app/.next/static ./.next/static
COPY --from=build --chown=flowmind:flowmind /app/public ./public
USER flowmind
EXPOSE 3000
# k8s 探活对齐：/api/health（如无则用 rollout 默认 TCP 探针）
CMD ["node", "server.js"]

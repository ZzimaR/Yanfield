# 砚田 Yantian — 生产镜像
#
# 多阶段构建：deps（装依赖）→ builder（next build）→ runner（standalone 产物）
# 运行：docker run --rm -p 3000:3000 -v yantian-data:/app/data yantian
#
# 依赖 next.config.ts 中的 output: "standalone"；没有它 .next/standalone 不会生成。

# ---------- 1. 依赖 ----------
FROM node:22.13-alpine AS deps
WORKDIR /app
# 与 pnpm-lock.yaml（lockfileVersion 9.0）匹配的 pnpm 主版本
RUN npm install -g pnpm@11 && pnpm --version
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---------- 2. 构建 ----------
FROM node:22.13-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm@11
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
RUN pnpm exec next build

# ---------- 3. 运行 ----------
FROM node:22.13-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# 数据库位置：默认 cwd/data/yanfield.db → /app/data/yanfield.db
# 想换位置可在运行时覆盖，例如 -e YANFIELD_DB_PATH=/app/data/novels.db
ENV YANFIELD_DB_PATH=/app/data/yanfield.db

# 非 root 运行
RUN addgroup -g 1001 -S nodejs \
 && adduser -S yantian -u 1001 -G nodejs

# standalone 产物已包含裁剪后的 node_modules 与 server.js
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# 种子脚本：允许在容器内 `node scripts/seed.mjs` 只重置示例数据（不删你的作品）
COPY --from=builder /app/scripts ./scripts

# 数据卷：SQLite 单文件，挂载后容器重建不丢稿
VOLUME ["/app/data"]
RUN mkdir -p /app/data && chown -R yantian:nodejs /app && chmod 0775 /app/data

USER yantian
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ >/dev/null || exit 1

CMD ["node", "server.js"]

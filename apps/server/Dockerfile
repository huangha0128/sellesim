# ===== YYeSim 后端服务 Dockerfile =====
# 多阶段构建：构建阶段编译 TS + 生成 Prisma Client，运行阶段仅保留运行所需产物

# ---------- 构建阶段 ----------
FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

# 先复制清单文件，最大化利用 Docker 层缓存
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/server/package.json apps/server/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/miniapp/package.json apps/miniapp/package.json
RUN pnpm install --no-frozen-lockfile

# 复制全部源码
COPY . .

# 生成 Prisma Client 并编译 TypeScript
RUN pnpm --filter @sellsim/server exec prisma generate \
    && pnpm --filter @sellsim/server build

# ---------- 运行阶段 ----------
FROM node:22-alpine AS runtime
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories || true; \
    apk add --no-cache openssl ca-certificates || true
ENV NODE_ENV=production
WORKDIR /app

# 复制工作区依赖与 server 产物（保留 pnpm workspace 结构）
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server ./apps/server

EXPOSE 6660

# 启动：初始化数据库 → 填充基础数据 → 启动 API 服务
# 使用 npx 而非 pnpm 命令，避免 pnpm v11 自动依赖检查触发 ERR_PNPM_IGNORED_BUILDS
CMD ["sh", "-c", "set -e; cd apps/server && npx prisma db push && node bootstrap-sync.mjs && exec node dist/index.js"]
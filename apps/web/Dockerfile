# ===== YYeSim 官网静态站 Dockerfile =====
# 多阶段构建：构建阶段产出 apps/web/dist；运行阶段仅安装 rsync，把 dist 同步进 Caddy 挂载的 WWW_ROOT 目录

# ---------- 构建阶段 ----------
FROM node:22-alpine AS build
RUN corepack enable
# corepack 默认从 registry.npmjs.org 下载 pnpm（国内不可达），改为 npmmirror
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
WORKDIR /app
# 先复制清单文件，最大化利用 Docker 层缓存
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/server/package.json apps/server/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/miniapp/package.json apps/miniapp/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --no-frozen-lockfile

# 复制全部源码
COPY . .

# 构建官网（vue-tsc 类型检查 + vite build → apps/web/dist）
RUN pnpm --filter @sellsim/web build

# ---------- 运行阶段（一次性铺盘任务）----------
FROM alpine:3.20
RUN apk add --no-cache rsync
WORKDIR /deploy
COPY --from=build /app/apps/web/dist /dist
COPY apps/web/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
CMD ["/entrypoint.sh"]
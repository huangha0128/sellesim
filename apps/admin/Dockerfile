# ===== YYeSim 管理后台 Dockerfile =====
# 多阶段构建：Node 阶段编译 Vue 产物，nginx 阶段提供静态服务
# 后台部署在 /backend 路径下，API 统一走 /api 反向代理

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

# Next.js 静态导出（basePath=/backend，产物输出到 out/）
RUN pnpm --filter @sellsim/admin build

# ---------- 运行阶段（nginx）----------
FROM nginx:1.27-alpine
COPY apps/admin/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/admin/out /usr/share/nginx/html/backend
EXPOSE 80

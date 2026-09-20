# ===== YYeSim 伙伴门户 Dockerfile =====
# 多阶段构建：Node 阶段编译 Next.js 静态产物，nginx 阶段提供静态服务
# 门户部署在 /partner 路径下，API 统一走 /api 反向代理

# ---------- 构建阶段 ----------
FROM node:22-alpine AS build
# 安装 openssl，使 Prisma 构建产物与其他包一致（若 partner 声明依赖 prisma 才需要）
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories || true; \
    apk add --no-cache openssl || true
RUN corepack enable
# corepack 默认从 registry.npmjs.org 下载 pnpm（国内不可达），改为 npmmirror
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
WORKDIR /app

# 先复制清单文件，最大化利用 Docker 层缓存
# partner 依赖 @sellsim/server 的 prisma schema（若共享 prisma 客户端）；为稳妥一并安装工作区
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/server/package.json apps/server/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/miniapp/package.json apps/miniapp/package.json
COPY apps/partner/package.json apps/partner/package.json
RUN pnpm install --no-frozen-lockfile

# 复制全部源码
COPY . .

# Next.js 静态导出（basePath=/partner，产物输出到 out/）
RUN pnpm --filter @sellsim/partner build

# ---------- 运行阶段（nginx）----------
FROM nginx:1.27-alpine
COPY apps/partner/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/partner/out /usr/share/nginx/html/partner
EXPOSE 80
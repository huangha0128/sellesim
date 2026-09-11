# ===== YYeSim 后端服务 Dockerfile =====
# 多阶段构建：构建阶段编译 TS + 生成 Prisma Client，运行阶段仅保留运行所需产物

# ---------- 构建阶段 ----------
FROM node:22-alpine AS build
# 安装 openssl，让 Prisma 正确探测 libssl 版本（Alpine 3.x = openssl-3.0.x），
# 使 "native" 与下方 binaryTargets 的 linux-musl-openssl-3.0.x 一致
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories || true; \
    apk add --no-cache openssl || true
RUN corepack enable
# corepack 默认从 registry.npmjs.org 下载 pnpm（国内不可达），改为 npmmirror
ENV COREPACK_NPM_REGISTRY=https://registry.npmmirror.com
WORKDIR /app
# 服务器在国内，无法访问 binaries.prisma.sh，改用 npmmirror 镜像下载 Prisma engine。
# 注意：Prisma 会自动在镜像基址后拼接 "/all_commits/<commit>/<platform>/<file>"，
# 因此这里只写到 .../binary/prisma，不要加 all_commits（否则会变成 .../all_commits/all_commits）
ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma

# 先复制清单文件，最大化利用 Docker 层缓存
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/server/package.json apps/server/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/miniapp/package.json apps/miniapp/package.json
RUN pnpm install --no-frozen-lockfile

# 复制全部源码
COPY . .

# 生成 Prisma Client 并编译 TypeScript
# 占位 DATABASE_URL：prisma generate 需要解析 datasource url 的 env，
# 但 generate 不连接数据库，占位即可（真实连接串由 compose 运行期注入）
ENV DATABASE_URL=mysql://placeholder:placeholder@localhost:3306/placeholder
# 生成时显式请求 linux-musl 平台 engine，随产物一起打包进运行镜像，避免运行时联网下载
RUN pnpm --filter @sellsim/server exec prisma generate --generator client \
    && pnpm --filter @sellsim/server build \
    && echo "==> 校验 Prisma engine 已固化进镜像 ==" \
    && find /app/node_modules -type f \( -name 'libquery_engine-*.so.node' -o -name 'schema-engine-*' \) | sort \
    && COUNT=$(find /app/node_modules -type f -name 'libquery_engine-linux-musl-openssl-3.0.x.so.node' | wc -l) \
    && echo "libquery_engine found: $COUNT" \
    && [ "$COUNT" -gt 0 ] || (echo "FATAL: libquery_engine-linux-musl not found in build!"; exit 1)

# ---------- 运行阶段 ----------
FROM node:22-alpine AS runtime
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories || true; \
    apk add --no-cache openssl ca-certificates || true
ENV NODE_ENV=production
# 兜底：即使运行时仍需要下载 Prisma engine，也走国内镜像而非 binaries.prisma.sh。
# 与构建阶段一致：Prisma 会自动拼接 /all_commits/<commit>/<platform>/<file>，
# 因此这里只写到 .../binary/prisma，不要加 all_commits
ENV PRISMA_ENGINES_MIRROR=https://registry.npmmirror.com/-/binary/prisma
WORKDIR /app

# 复制工作区依赖与 server 产物（保留 pnpm workspace 结构）
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server ./apps/server

EXPOSE 6660

# 启动：初始化数据库 → 填充基础数据 → 启动 API 服务
# --no-install 强制 npx 使用镜像内已安装的 prisma（5.10.0），避免 npx 临时下载其他版本导致 engine 版本不匹配
# --accept-data-loss：套餐已改为实时来自 TigerESIM，需删除本地 Package 表与 Esim.pkgId 外键列
CMD ["sh", "-c", "set -e; cd apps/server && npx --no-install prisma db push --accept-data-loss && node bootstrap-sync.mjs && exec node dist/index.js"]
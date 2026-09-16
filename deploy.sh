#!/usr/bin/env bash
# ============================================================
# YYeSim 一键部署脚本（在服务器上执行）
# 用法:
#   服务器上:   ./deploy.sh
#   Windows 开发机 (通过 SSH):  ssh <user>@<服务器IP> "cd <仓库路径> && ./deploy.sh"
# 流程: 拉取最新代码 → 备份 MySQL → 构建启动 → 等待健康 → 校验 bootstrap 同步 → 清理镜像
# ============================================================
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DEPLOY_DIR"

echo "==> [1/7] 检查并安装 git"
if ! command -v git &>/dev/null; then
  echo "    git 未安装，尝试自动安装..."
  if command -v yum &>/dev/null; then
    yum install -y git
  elif command -v apk &>/dev/null; then
    apk add --no-cache git
  elif command -v apt-get &>/dev/null; then
    apt-get update -qq && apt-get install -y -qq git
  else
    echo "    错误：无法自动安装 git，请手动安装后重试" >&2
    exit 1
  fi
  echo "    git 安装完成: $(git --version)"
fi

echo "==> [2/7] 拉取最新代码 (master)"
# 重要：本脚本自身也在仓库里，reset 会把它一起覆盖。bash 是流式读取脚本文件的，
# 运行中被替换会导致后续行错乱/被跳过（新增的构建步骤曾因此静默失效，线上不更新）。
# 这里对比 reset 前后的自身校验和，若已变化则用新版本重新执行（此时代码已是最新，
# 再次 reset 不会变化，不会死循环）。
SELF_PATH="${BASH_SOURCE[0]:-$0}"
SELF_SUM_BEFORE="$(md5sum "$SELF_PATH" 2>/dev/null | awk '{print $1}')"
git fetch origin master
git reset --hard origin/master
SELF_SUM_AFTER="$(md5sum "$SELF_PATH" 2>/dev/null | awk '{print $1}')"
if [ -n "$SELF_SUM_BEFORE" ] && [ "$SELF_SUM_BEFORE" != "$SELF_SUM_AFTER" ]; then
  echo "    部署脚本自身已更新，改用新版本重新执行..."
  exec bash "$SELF_PATH" "$@"
fi

echo "==> [3/7] 备份 MySQL 数据"
# 仅在 mysql 容器已运行时备份（首次部署尚无 mysql 时跳过），备份文件保留在 backups/
if [ -n "$(docker compose ps -q mysql 2>/dev/null || true)" ]; then
  mkdir -p "$DEPLOY_DIR/backups"
  BACKUP_FILE="$DEPLOY_DIR/backups/mysql-$(date +%Y%m%d-%H%M%S).sql"
  if docker compose exec -T mysql sh -c 'exec mysqldump -uroot -p"$MYSQL_ROOT_PASSWORD" --single-transaction --databases "$MYSQL_DATABASE"' > "$BACKUP_FILE" 2>/dev/null; then
    echo "    MySQL 数据已备份: $BACKUP_FILE"
  else
    echo "    MySQL 备份失败（容器可能未就绪），已跳过"
    rm -f "$BACKUP_FILE"
  fi
else
  echo "    MySQL 容器未运行，跳过备份"
fi

echo "==> [4/7] 构建并启动容器"
# server 使用 --no-cache：强制重新生成 Prisma Client 并从国内镜像固化 engine，
# 避免复用到旧的、未固化 engine 的缓存层
# admin 也一并构建：后台已迁移到 Next.js(shadcn/ui)，产物打进 admin 镜像，
# 不重建则线上会一直停留在旧的 Vue 页面
# 注意：admin 不加 --no-cache，依赖安装层可复用缓存，避免全量重装依赖占用磁盘与时间
# 官网静态站（web）：一次性铺盘容器（restart: "no"），必须先删除旧容器再重建镜像。
# 否则 compose 会复用绑定旧镜像的旧容器（只是 start 而非 recreate），
# rsync 铺的仍是旧 dist，线上官网永远停在第一次部署的那一版。
docker compose build --no-cache server
docker compose build admin
docker compose rm -f web 2>/dev/null || true
docker compose build web
docker compose up -d

echo "==> [5/7] 等待后端健康检查通过"
for _ in $(seq 1 60); do
  status="$(docker inspect -f '{{.State.Health.Status}}' sellsim-server 2>/dev/null || true)"
  if [ "$status" = "healthy" ]; then
    echo "    后端已就绪"
    break
  fi
  if [ "$status" = "unhealthy" ]; then
    echo "    健康检查异常，请查看: docker logs sellsim-server" >&2
    break
  fi
  sleep 2
done

echo "==> [6/7] 校验 bootstrap 同步结果"
sleep 3
docker logs --since 2m sellsim-server 2>&1 | grep -E '\[bootstrap\]' | tail -n 5 \
  || echo "    (未捕获到 bootstrap 日志，请用 docker logs sellsim-server 查看)"

echo "==> [7/7] 清理无用镜像与构建缓存"
# 仅清悬空镜像：docker image prune -f
# server 采用 --no-cache 构建，会产生大量 legacy 构建器中间层/缓存（可达 26G+），
# 这些不会因 image prune 被删除，必须再用 builder prune 清空，否则每次部署都会快速占满磁盘
docker image prune -f || true
docker builder prune -af || true

echo "==> 部署完成"
docker ps --filter name=sellsim-server

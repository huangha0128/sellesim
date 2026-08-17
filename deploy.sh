#!/usr/bin/env bash
# ============================================================
# YYeSim 一键部署脚本（在服务器上执行）
# 用法:
#   服务器上:   ./deploy.sh
#   Windows 开发机 (通过 SSH):  ssh <user>@<服务器IP> "cd <仓库路径> && ./deploy.sh"
# 流程: 拉取最新代码 → 构建启动 → 等待健康 → 校验 bootstrap 同步 → 清理镜像
# ============================================================
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DEPLOY_DIR"

echo "==> [1/5] 拉取最新代码 (master)"
git fetch origin master
git reset --hard origin/master

echo "==> [2/5] 构建并启动容器"
# server 使用 --no-cache：强制重新生成 Prisma Client 并从国内镜像固化 engine，
# 避免复用到旧的、未固化 engine 的缓存层
docker compose build --no-cache server
docker compose up -d

echo "==> [3/5] 等待后端健康检查通过"
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

echo "==> [4/5] 校验 bootstrap 同步结果"
sleep 3
docker logs --since 2m sellsim-server 2>&1 | grep -E '\[bootstrap\]' | tail -n 5 \
  || echo "    (未捕获到 bootstrap 日志，请用 docker logs sellsim-server 查看)"

echo "==> [5/5] 清理无用镜像"
docker image prune -f || true

echo "==> 部署完成"
docker ps --filter name=sellsim-server

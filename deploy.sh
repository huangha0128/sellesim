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

echo "==> [1/6] 检查并安装 git"
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

echo "==> [2/6] 拉取最新代码 (master)"
git fetch origin master
git reset --hard origin/master

echo "==> [3/6] 构建并启动容器"
# server 使用 --no-cache：强制重新生成 Prisma Client 并从国内镜像固化 engine，
# 避免复用到旧的、未固化 engine 的缓存层
docker compose build --no-cache server
docker compose up -d

echo "==> [4/6] 等待后端健康检查通过"
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

echo "==> [5/6] 校验 bootstrap 同步结果"
sleep 3
docker logs --since 2m sellsim-server 2>&1 | grep -E '\[bootstrap\]' | tail -n 5 \
  || echo "    (未捕获到 bootstrap 日志，请用 docker logs sellsim-server 查看)"

echo "==> [6/6] 清理无用镜像"
docker image prune -f || true

echo "==> 部署完成"
docker ps --filter name=sellsim-server

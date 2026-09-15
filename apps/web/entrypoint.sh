#!/bin/sh
# 将官网构建产物同步到 Caddy 挂载的 WWW_ROOT 目录（compose 中 /www → ${WWW_ROOT}）
# 该容器为一次性铺盘任务，完成后退出（exit 0 即成功）
set -e

if [ ! -d /dist ]; then
  echo "FATAL: /dist not found (build output missing)" >&2
  exit 1
fi

# 确保目标目录存在
mkdir -p /www
rsync -a --delete /dist/ /www/

echo "==> official website deployed to /www"
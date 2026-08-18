#!/bin/sh
set -e

CADDYFILE="/etc/caddy/Caddyfile"

# 根据环境变量动态生成 Caddyfile
# 模式1：配置了域名 → 手动证书 HTTPS（证书路径未显式指定时按 certbot 标准目录自动拼接）
# 模式2：其他 → HTTP 模式

if [ -n "$CADDY_DOMAIN" ] && [ "$CADDY_DOMAIN" != ":80" ]; then
    # 未显式指定证书路径时，按 certbot 目录结构自动拼接
    CERT_FILE="${CADDY_CERT_FILE:-/etc/caddy/cert/live/$CADDY_DOMAIN/fullchain.pem}"
    KEY_FILE="${CADDY_KEY_FILE:-/etc/caddy/cert/live/$CADDY_DOMAIN/privkey.pem}"
    echo "==> 启用 HTTPS 模式 (域名: $CADDY_DOMAIN, 手动证书)"
    cat > "$CADDYFILE" << EOF
$CADDY_DOMAIN {
    tls $CERT_FILE $KEY_FILE

    encode gzip zstd

    handle /api/* {
        reverse_proxy server:6660
    }

    handle /backend* {
        reverse_proxy admin:80
    }

    handle {
        respond "YYeSim 服务已启动"
    }
}
EOF
else
    echo "==> 启用 HTTP 模式 (端口 80)"
    cat > "$CADDYFILE" << 'EOF'
:80 {
    encode gzip zstd

    handle /api/* {
        reverse_proxy server:6660
    }

    handle /backend* {
        reverse_proxy admin:80
    }

    handle {
        respond "YYeSim 服务已启动"
    }
}
EOF
fi

# 执行 Caddy
exec caddy run --config "$CADDYFILE" --adapter caddyfile
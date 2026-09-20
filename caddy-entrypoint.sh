#!/bin/sh
set -e

CADDYFILE="/etc/caddy/Caddyfile"

# 根据环境变量动态生成 Caddyfile
# 模式0：设置 CADDY_UPSTREAM → 出口代理模式。本机仅终止 TLS，所有流量反代到该地址
#        （由上游 Caddy 内部分发 /api、/backend、/open-api 与官网静态）。适用于双机负载均衡
#        场景下老服仅作为备案域名出口节点、后端承载在别服的情形。
# 模式1：配置了域名 → 手动证书 HTTPS（证书路径未显式指定时按 certbot 标准目录自动拼接）
# 模式2：其他 → HTTP 模式

if [ -n "$CADDY_UPSTREAM" ]; then
    echo "==> 启用下游代理模式 (upstream: $CADDY_UPSTREAM)"
    cat > "$CADDYFILE" << EOF
{
}
$CADDY_DOMAIN {
    tls ${CADDY_CERT_FILE:-/etc/caddy/cert/live/$CADDY_DOMAIN/fullchain.pem} ${CADDY_KEY_FILE:-/etc/caddy/cert/live/$CADDY_DOMAIN/privkey.pem}

    encode gzip zstd

    # 所有流量统一反代到上游出口（244 的 Caddy:80，由其内部分发）
    handle {
        reverse_proxy $CADDY_UPSTREAM
    }
}
EOF
elif [ -n "$CADDY_DOMAIN" ] && [ "$CADDY_DOMAIN" != ":80" ]; then
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

    handle /partner* {
        reverse_proxy partner:80
    }

    handle /open-api* {
        reverse_proxy server:6660
    }

    # 默认路由 -> 官网静态站点
    handle {
        root * /www/wwwroot/www.bjyyxx.com
        file_server
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

    handle /partner* {
        reverse_proxy partner:80
    }

    handle /open-api* {
        reverse_proxy server:6660
    }

    # 默认路由 -> 官网静态站点
    handle {
        root * /www/wwwroot/www.bjyyxx.com
        file_server
    }
}
EOF
fi

# 执行 Caddy
exec caddy run --config "$CADDYFILE" --adapter caddyfile
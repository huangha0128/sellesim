# YYeSim（SellSim）全球 eSIM 上网卡商城

一个完整的 eSIM 上网卡商城系统，采用 pnpm monorepo 组织，包含：

- **后端 API 服务**（Express + Prisma + SQLite）
- **商城小程序**（uni-app + Vue 3，支持 H5 / 微信小程序 / 支付宝小程序）
- **管理后台**（Vue 3 + Element Plus）
- **资源生成工具脚本**（Python 3.10+）
- **一键部署**（Docker Compose + Caddy 反向代理）

核心流程：用户通过支付宝授权登录 → 浏览国家/地区套餐 → 下单购买 → 支付后自动下发 eSIM（可对接 Tiger eSIM 合作方 API，未配置时使用本地模拟）→ 小程序内查看激活码并扫码安装。

## 技术栈

| 模块 | 技术 |
| --- | --- |
| 后端 `apps/server` | Node.js + TypeScript + Express + Prisma ORM + SQLite |
| 商城小程序 `apps/miniapp` | uni-app + Vue 3 + Vite + SCSS |
| 管理后台 `apps/admin` | Vue 3 + TypeScript + Vite + Element Plus |
| 工具脚本 `scripts` | Python 3.10+（标准库为主，Pillow 用于图标生成） |
| 部署 | Docker Compose + Caddy（自动 HTTPS） |

## 目录结构

```
sellsim/
├── apps/
│   ├── server/               # 后端 API 服务
│   │   ├── prisma/           # Prisma schema 与种子数据（SQLite: dev.db）
│   │   └── src/
│   │       ├── routes/       # auth / countries / packages / orders / esims / admin
│   │       ├── tiger/        # Tiger eSIM 上游对接（下发、ICCID 池、同步）
│   │       └── config.ts     # JWT / 支付宝配置
│   ├── miniapp/              # 商城小程序（uni-app + Vue 3）
│   │   └── src/
│   │       ├── pages/        # 首页、国家列表、套餐、详情、结算、支付、我的 eSIM 等
│   │       ├── components/   # PackageCard / EsimQr / CountryCell
│   │       ├── static/icons/ # 全部 PNG 图标（无 emoji）
│   │       ├── utils/api.js  # 后端 API 封装
│   │       └── pages.json    # 页面与 tabBar 配置
│   └── admin/                # 管理后台（Vue 3 + Element Plus）
│       └── src/views/        # Dashboard / Orders / Esims / Countries / Packages / TigerSync
├── scripts/                  # 图标、国旗、AI 生图、兑换码等工具脚本
├── .github/workflows/        # GitHub Actions：master 分支自动部署
├── docker-compose.yml        # server + admin + caddy 编排
├── Caddyfile                 # /api/* → server，/backend/* → admin
└── pnpm-workspace.yaml
```

## 快速开始

### 环境要求

- Node.js 20+（推荐 22，与 Dockerfile 一致）
- pnpm 11.x（推荐通过 `corepack enable` 启用）
- Python 3.10+（仅使用工具脚本时需要）

### 安装与初始化

```bash
pnpm install

# 初始化数据库（创建 SQLite 表结构）
pnpm db:push

# 填充种子数据：36 个国家 + 5 个区域 + 基础套餐
pnpm db:seed
```

### 启动开发环境

同时启动后端、小程序（H5）和管理后台：

```bash
pnpm dev
```

也可以单独启动：

```bash
pnpm dev:server     # 后端 API，http://localhost:6660
pnpm dev:miniapp    # 小程序 H5，默认 http://localhost:5173
pnpm dev:admin      # 管理后台，http://localhost:6661（/api 已代理到 6660）
```

> 提示：小程序前端请求地址在 `apps/miniapp/src/utils/api.js` 的 `BASE_URL` 中配置。本地开发时改为 `http://localhost:6660/api`，联调/上线时改为服务器地址。

### 构建生产版本

```bash
pnpm build                  # 依次构建 server / miniapp / admin
pnpm build:server
pnpm build:miniapp          # H5 产物
pnpm build:admin
```

小程序还可单独构建微信 / 支付宝端：

```bash
pnpm --filter @sellsim/miniapp dev:mp-weixin     # 微信小程序
pnpm --filter @sellsim/miniapp build:mp-weixin
pnpm --filter @sellsim/miniapp dev:mp-alipay     # 支付宝小程序
pnpm --filter @sellsim/miniapp build:mp-alipay
```

## 环境变量

复制 `.env.example` 为 `.env` 后按需修改（Docker 部署使用）：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `CADDY_DOMAIN` | 域名，配置后 Caddy 自动申请 HTTPS；留空则监听 80 端口 HTTP | 空 |
| `SERVER_PORT` | 后端 API 对外端口（映射到容器内 6660） | `6501` |
| `ADMIN_PORT` | 管理后台对外端口 | `6500` |
| `HTTP_PORT` / `HTTPS_PORT` | Caddy 对外端口 | `80` / `443` |
| `JWT_SECRET` | JWT 签名密钥，生产环境务必修改 | 默认开发值 |
| `TIGER_CLIENT_ID` / `TIGER_CLIENT_SECRET` | Tiger eSIM 合作方凭据（填写后启用真实下发） | 空 |
| `TIGER_BASE_URL` | Tiger API 基础地址 | `https://partner.tigeresims.com` |
| `TIGER_SMDP_ADDRESS` | eSIM SM-DP+ 地址兜底值 | 空 |
| `TIGER_ICCIDS` | 已采购卡片 ICCID 池，逗号分隔，下单时按序取用 | 空 |

后端单独运行时（本地开发）可在 `apps/server/.env` 中配置 `TIGER_*` 变量。

## API 一览

所有业务接口统一返回 `{ code, message?, data? }`，`code: 0` 表示成功。

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查 |
| POST | `/api/auth/login` | 支付宝授权码登录，返回 JWT |
| POST | `/api/auth/update-profile` | 更新用户资料 |
| GET | `/api/countries` | 国家/区域列表（支持 `limit`） |
| GET | `/api/countries/hot` | 热门国家 |
| GET | `/api/countries/search` | 关键词搜索（中文名/英文/拼音/代码） |
| GET | `/api/countries/:code` | 国家详情 |
| GET | `/api/packages?countryCode=` | 套餐列表（`all=1` 返回全部，默认仅推荐） |
| GET | `/api/packages/min-prices` | 各国最低价（首页展示） |
| GET | `/api/packages/:id` | 套餐详情 |
| POST | `/api/orders` | 创建订单 |
| POST | `/api/orders/:orderNo/pay` | 支付并下发 eSIM |
| GET | `/api/orders` | 订单列表 |
| GET | `/api/esims` | 我的 eSIM 列表 |
| POST | `/api/esims/:id/activate` | 标记 eSIM 已激活 |
| DELETE | `/api/esims/:id` | 删除 eSIM |
| GET | `/api/admin/dashboard` | 后台统计数据 |
| GET / POST / PUT / DELETE | `/api/admin/countries...` | 国家管理 CRUD |
| GET / POST / PUT / DELETE | `/api/admin/packages...` | 套餐管理 CRUD（含分页） |
| GET | `/api/admin/orders`、`/api/admin/esims` | 订单 / eSIM 管理 |
| GET | `/api/admin/tiger/status` | Tiger 接入状态 |
| POST | `/api/admin/tiger/sync-regions` | 同步区域 |
| POST | `/api/admin/tiger/sync-packages` | 同步套餐并回填 `tigerPkgId` |
| POST | `/api/admin/tiger/sync-all` | 全量同步 |

## Tiger eSIM 对接

系统支持两种 eSIM 下发模式（`/api/admin/tiger/status` 可查看当前模式）：

- **真实下发（tiger）**：配置 `TIGER_CLIENT_ID` / `TIGER_CLIENT_SECRET` 后启用。支付成功时从 `TIGER_ICCIDS` 卡片池取一张未使用卡片，调用 Tiger API 绑定套餐，解析返回的激活码 / ICCID / SM-DP+ 地址并入库。
- **本地模拟（mock）**：未配置时回退为模拟下发，生成格式正确的测试激活码（`LPA:1$...`），便于本地开发与演示。

后台「Tiger 同步」页面可一键同步区域与套餐、查看匹配与未匹配明细。

## Docker 部署

```bash
cp .env.example .env   # Windows: copy .env.example .env
# 编辑 .env：JWT_SECRET、TIGER_*、端口等

docker compose up -d --build
```

访问入口：

| 服务 | 地址 |
| --- | --- |
| 管理后台（经 Caddy） | `http://<IP>/backend/` |
| 管理后台（直连） | `http://<IP>:6500/backend/` |
| 后端 API | `http://<IP>:6501/api/`（或经 Caddy `/api/`） |

配置域名后（`CADDY_DOMAIN=example.com`，域名解析到服务器，开放 80/443），Caddy 会自动申请并续期 HTTPS 证书。

仓库已内置 GitHub Actions 工作流：推送 `master` 分支时通过 SSH 登录服务器执行 `docker compose up -d --build` 自动部署（需要在仓库 Secrets 中配置 `DEPLOY_HOST` / `DEPLOY_USER` / `DEPLOY_SSH_KEY` / `DEPLOY_PORT`，以及 `DEPLOY_DIR` 变量）。

需要手动在服务器上部署时，可在仓库根目录执行一键脚本（拉代码 → 构建启动 → 健康检查 → 校验 bootstrap 同步）：

```bash
./deploy.sh
```

## 工具脚本

脚本仅依赖 Python 标准库（图标生成使用 Pillow），可通过 `--help` 查看用法：

| 脚本 | 用途 | 示例 |
| --- | --- | --- |
| `scripts/gen_icons.py` | 用 Pillow 生成基础 PNG 图标 | `python scripts/gen_icons.py` |
| `scripts/download_flags.py` | 从 flagcdn.com 下载国旗图标 | `python scripts/download_flags.py` |
| `scripts/gen_image.py` | MaaS AI 生图（`--list-models` 查看模型） | `python scripts/gen_image.py "prompt" --size 1024x1024` |
| `scripts/gen_video.py` | AI 视频生成 | `python scripts/gen_video.py ...` |
| `scripts/remove_background.py` | 图片抠图（去除背景） | `python scripts/remove_background.py input.jpg -o output.png` |
| `scripts/generate_redeem_codes.py` | 批量生成兑换码（HMAC-SHA256 签名） | `python scripts/generate_redeem_codes.py 50` |

## 开发约定

- 使用 pnpm 作为包管理器，Monorepo 工作区结构（`apps/*`、`packages/*`）。
- 文件编码 UTF-8，注释与输出使用中文（zh-CN）。
- 小程序图标全部使用 PNG 图片，不使用 emoji；国旗从 flagcdn.com 下载，品牌素材由 AI 生成 + 抠图处理。
- API 密钥等敏感信息存放在环境变量中，不入库。

## 注意事项

- 支付接口 `POST /api/orders/:orderNo/pay` 当前为模拟实现（直接置为已支付并下发 eSIM），真实支付宝支付需要在此基础上接入当面付/小程序支付回调验签。
- 管理后台接口目前未强制 JWT 鉴权，生产环境部署时建议通过网关、防火墙或补充鉴权中间件限制访问。
- SQLite 数据库文件位于 `apps/server/prisma/data/dev.db`，Docker 部署时通过命名卷挂载在 `/app/apps/server/prisma/data` 持久化；备份/迁移时注意保留该文件。

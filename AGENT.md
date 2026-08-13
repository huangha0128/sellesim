# AGENT.md

## Project Overview

SellSim (YYeSim) - 一个完整的 eSIM 上网卡商城系统，包含后端服务、小程序前端、管理后台和工具脚本。

## Tech Stack

### 后端服务 (apps/server)
- Node.js + TypeScript
- Prisma ORM + SQLite
- RESTful API

### 小程序前端 (apps/miniapp)
- uni-app + Vue 3 + Vite
- 支持 H5、微信小程序、支付宝小程序
- SCSS 样式
- 所有图标使用 PNG 图片（无 emoji）

### 管理后台 (apps/admin)
- Vue 3 + TypeScript + Vite
- 后台管理系统

### 工具脚本 (scripts)
- Python 3.10+ (stdlib only, zero external dependencies)
- MaaS API (mass.hzxmfg.com) for image/video generation
- HMAC-SHA256 for redeem code signing
- Pillow for icon generation

## Directory Structure

```
sellsim/
├── apps/
│   ├── server/              # 后端服务
│   │   ├── prisma/          # Prisma schema 和数据库
│   │   │   ├── schema.prisma
│   │   │   ├── dev.db       # SQLite 数据库
│   │   │   └── seed.ts      # 数据填充脚本
│   │   └── src/
│   │       ├── routes/      # API 路由
│   │       │   ├── admin.ts
│   │       │   ├── country.ts
│   │       │   ├── esim.ts
│   │       │   ├── order.ts
│   │       │   └── package.ts
│   │       └── index.ts     # 服务入口
│   │
│   ├── miniapp/             # 小程序前端
│   │   ├── src/
│   │   │   ├── components/  # Vue 组件
│   │   │   │   ├── CountryCell.vue
│   │   │   │   ├── EsimQr.vue
│   │   │   │   └── PackageCard.vue
│   │   │   ├── mock/        # Mock 数据
│   │   │   │   └── data.js
│   │   │   ├── pages/       # 页面
│   │   │   │   ├── checkout/    # 结算页
│   │   │   │   ├── countries/   # 国家列表
│   │   │   │   ├── detail/      # 套餐详情
│   │   │   │   ├── esims/       # 我的 eSIM
│   │   │   │   ├── guide/       # 安装指南
│   │   │   │   ├── index/       # 首页
│   │   │   │   ├── packages/    # 套餐列表
│   │   │   │   ├── payment/     # 支付页
│   │   │   │   └── profile/     # 个人中心
│   │   │   ├── static/icons/    # 图标资源（76 个 PNG）
│   │   │   ├── store/       # 状态管理
│   │   │   ├── utils/       # 工具函数
│   │   │   ├── pages.json   # 页面配置
│   │   │   └── manifest.json
│   │   └── package.json
│   │
│   └── admin/               # 管理后台
│       ├── src/
│       │   ├── api/         # API 接口
│       │   ├── layouts/     # 布局组件
│       │   ├── router/      # 路由配置
│       │   └── views/       # 页面视图
│       │       ├── Countries.vue
│       │       ├── Dashboard.vue
│       │       ├── Esims.vue
│       │       ├── Orders.vue
│       │       └── Packages.vue
│       └── package.json
│
├── scripts/                 # 工具脚本
│   ├── gen_image.py         # MaaS AI 图片/视频生成
│   ├── gen_icons.py         # 使用 Pillow 生成基础图标
│   ├── download_flags.py    # 从 flagcdn.com 下载国旗图标
│   ├── remove_background.py # 图片抠图（去除背景）
│   ├── generate_redeem_codes.py  # 批量生成兑换码
│   ├── gen_video.py         # AI 视频生成
│   └── outputs/             # 生成输出目录
│       └── brand/           # 品牌素材
│           ├── hero-logo.png
│           └── hero-avatar.png
│
├── .agent/                  # Agent 配置
│   ├── rules/project_rules.md
│   └── skills/              # 29 个 Agent 技能
│
├── package.json             # Monorepo 根配置
└── pnpm-workspace.yaml      # pnpm 工作区配置
```

## Conventions

### 通用规范
- 使用 pnpm 作为包管理器
- Monorepo 结构，使用 pnpm workspace
- 文件编码 UTF-8，注释和输出使用中文 (zh-CN)
- API 密钥存储在环境变量中

### 小程序前端
- **所有图标使用 PNG 图片，不使用 emoji**
- 图标资源位于 `apps/miniapp/src/static/icons/`
- 国旗图标从 flagcdn.com 下载（真实国旗图片）
- 品牌素材使用 AI 生成 + 抠图处理
- 基础图标使用 Pillow 生成几何图形

### 脚本规范
- 所有脚本仅使用 Python stdlib，无 pip 依赖
- 脚本通过 argparse 接受 CLI 参数，使用 --help 查看用法
- API 密钥使用环境变量或脚本内回退值

## Running Scripts

### 生成图标资源

1. 使用 Pillow 生成基础图标：
```bash
python scripts/gen_icons.py
```

2. 从 flagcdn.com 下载国旗图标：
```bash
python scripts/download_flags.py
```

3. 使用 AI 生成高质量品牌素材：
```bash
python scripts/gen_image.py "prompt" --model doubao-seedream-5-0 --size 1024x1024 --out ./outputs/brand
```

4. 抠图处理（去除背景）：
```bash
python scripts/remove_background.py input.jpg -o output.png
```

### 生成兑换码

生成兑换码（默认 100 个）：
```bash
python scripts/generate_redeem_codes.py 50
```

### AI 图片/视频生成

列出可用的图片模型：
```bash
python scripts/gen_image.py --list-models
```

生成图片：
```bash
python scripts/gen_image.py "a cute red panda on a tree branch" --size 1024x1024
```

## Development

### 启动开发服务器

启动所有服务（后端 + 小程序 + 管理后台）：
```bash
pnpm dev
```

或单独启动：
```bash
# 小程序 H5 开发服务器
pnpm dev:miniapp

# 后端服务
pnpm dev:server

# 管理后台
pnpm dev:admin
```

### 构建生产版本

构建所有应用：
```bash
pnpm build
```

或单独构建：
```bash
pnpm build:miniapp
pnpm build:server
pnpm build:admin
```

### 数据库操作

推送 Prisma schema 到数据库：
```bash
pnpm db:push
```

填充初始数据：
```bash
pnpm db:seed
```

## Icon Resources

小程序使用的所有图标资源说明：

| 类别 | 数量 | 来源 | 说明 |
|------|------|------|------|
| 品牌 Logo | 1 | AI 生成 + 抠图 | hero-logo.png |
| 头像图标 | 1 | AI 生成 + 抠图 | hero-avatar.png |
| 国旗图标 | 42 | flagcdn.com 下载 | flag-*.png |
| Tab 栏图标 | 6 | Pillow 生成 | tab-*.png |
| 功能图标 | 26 | Pillow 生成 | 各种功能图标 |
| **总计** | **76** | - | 所有图标均为 PNG 格式 |

**注意**：所有 emoji 已替换为图片资源，不使用任何 emoji。

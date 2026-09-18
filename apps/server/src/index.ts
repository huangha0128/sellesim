import express from 'express';
import crypto from 'crypto';
import path from 'path';
import cors from 'cors';
import { prisma } from './db';
import countryRoutes from './routes/country';
import packageRoutes from './routes/package';
import orderRoutes from './routes/order';
import esimRoutes from './routes/esim';
import adminRoutes from './routes/admin';
import authRoutes from './routes/auth';
import alipayRoutes from './routes/alipay';
import externalRoutes from './routes/external';
import openRoutes from './routes/open';
import { refreshPackageCache, PACKAGE_REFRESH_INTERVAL_MS } from './tiger/view';
import { retryPendingWebhooks, retryPendingSubjectWebhooks } from './services/webhook';
import { genSalt, hashPassword } from './middleware/adminAuth';

const app = express();

app.use(cors());
// verify 回调把原始 body 存到 req.rawBody，供外部开放 API 的 HMAC 签名校验使用（仅 application/json 触发）
app.use(
  express.json({
    verify: (req: any, _res, buf: Buffer) => {
      req.rawBody = buf.toString('utf-8');
    },
  }),
);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes(prisma));
app.use('/api/countries', countryRoutes(prisma));
app.use('/api/packages', packageRoutes(prisma));
app.use('/api/orders', orderRoutes(prisma));
app.use('/api/esims', esimRoutes(prisma));
app.use('/api/admin', adminRoutes(prisma));
app.use('/api/alipay', alipayRoutes(prisma));
app.use('/api/external', externalRoutes(prisma));
app.use('/api/open/v1', openRoutes(prisma));

// 开放平台公开文档（免鉴权）：/open-api 浏览器直接访问
app.use('/open-api', express.static(path.join(__dirname, '..', 'public', 'open-api')));

// ---- 管理后台账号引导 ----
// 首次启动时若账号不存在则自动创建：
//   - 配了 ADMIN_PASSWORD 就用它（推荐，便于自动化部署）
//   - 没配则生成随机口令并**打印到启动日志一次**（用 docker logs 查看），
//     避免留下 admin123 这类众所周知的默认弱口令
async function bootstrapAdminUser() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const envPassword = process.env.ADMIN_PASSWORD || '';
  if (await prisma.adminUser.findUnique({ where: { username } })) return;

  const password = envPassword || crypto.randomBytes(9).toString('base64url');
  const salt = genSalt();
  await prisma.adminUser.create({
    data: { username, salt, passwordHash: hashPassword(password, salt), name: '管理员' },
  });

  if (envPassword) {
    console.log(`[admin] 已创建管理员账号 ${username}（口令来自 ADMIN_PASSWORD）`);
  } else {
    console.warn('='.repeat(64));
    console.warn(`[admin] 未配置 ADMIN_PASSWORD，已为账号 ${username} 生成随机初始口令：`);
    console.warn(`[admin]    ${password}`);
    console.warn('[admin] 请立即登录后修改，并在 .env 固化 ADMIN_USERNAME / ADMIN_PASSWORD。');
    console.warn('='.repeat(64));
  }
}

const PORT = process.env.PORT || 6660;

app.listen(PORT, () => {
  console.log(` YYeSim 服务器运行在 http://localhost:${PORT}`);
});

// 引导管理员账号（失败不影响服务启动，仅无法登录后台）
bootstrapAdminUser().catch((e) => {
  console.error('[admin] 管理员账号引导失败：', e.message);
});

// ---- 套餐缓存：启动预热 + 定时后台刷新 ----
// 启动后立即预热一次（异步，不阻塞启动）；此后每隔一段间隔后台刷新，
// 保证 Redis/内存中的套餐目录始终接近 Tiger 实时数据，前端请求永远读缓存。
refreshPackageCache().catch(() => {
  /* 预热失败由后台定时刷新兜底重试 */
});
setInterval(() => {
  refreshPackageCache();
}, PACKAGE_REFRESH_INTERVAL_MS);

// ---- 外部开放 API：webhook 失败重试定时器 ----
// 支付成功但回调外部项目失败（网络/非 2xx）的订单，按退避策略每分钟扫描重试。
// 双机部署时仅主服（main）承担重试，edge 后端设 ENABLE_WEBHOOK_RETRY=false 关闭，
// 避免两个后端对同一批订单重复投递回调。
if (process.env.ENABLE_WEBHOOK_RETRY !== 'false') {
  setInterval(() => {
    retryPendingWebhooks(prisma);
    retryPendingSubjectWebhooks(prisma);
  }, 60_000);
}

export { prisma };

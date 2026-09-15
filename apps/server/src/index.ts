import express from 'express';
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
import { refreshPackageCache, PACKAGE_REFRESH_INTERVAL_MS } from './tiger/view';
import { retryPendingWebhooks } from './services/webhook';

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

const PORT = process.env.PORT || 6660;

app.listen(PORT, () => {
  console.log(` YYeSim 服务器运行在 http://localhost:${PORT}`);
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
// 支付成功但回调外部项目失败（网络/非 2xx）的订单，按退避策略每分钟扫描重试
setInterval(() => {
  retryPendingWebhooks(prisma);
}, 60_000);

export { prisma };

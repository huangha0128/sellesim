import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import countryRoutes from './routes/country';
import packageRoutes from './routes/package';
import orderRoutes from './routes/order';
import esimRoutes from './routes/esim';
import adminRoutes from './routes/admin';
import authRoutes from './routes/auth';
import alipayRoutes from './routes/alipay';
import { refreshPackageCache, PACKAGE_REFRESH_INTERVAL_MS } from './tiger/view';

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

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

export { prisma };

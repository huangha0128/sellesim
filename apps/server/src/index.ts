import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import countryRoutes from './routes/country';
import packageRoutes from './routes/package';
import orderRoutes from './routes/order';
import esimRoutes from './routes/esim';
import adminRoutes from './routes/admin';
import authRoutes from './routes/auth';

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

const PORT = process.env.PORT || 6660;

app.listen(PORT, () => {
  console.log(` YYeSim 服务器运行在 http://localhost:${PORT}`);
});

export { prisma };

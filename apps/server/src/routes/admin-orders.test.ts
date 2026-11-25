import express from 'express';
import type { AddressInfo } from 'net';
import type { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import adminRoutes from './admin';

vi.mock('../middleware/adminAuth', () => ({
  adminAuth: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  signAdminToken: vi.fn(),
  genSalt: vi.fn(),
  hashPassword: vi.fn(),
  verifyPassword: vi.fn(),
}));

const rows = Array.from({ length: 25 }, (_, i) => ({ id: String(i), orderNo: `order-${i}` }));
const count = vi.fn(async () => rows.length);
const findMany = vi.fn(async (options: { skip?: number; take?: number }) =>
  rows.slice(options.skip ?? 0, options.take === undefined ? undefined : (options.skip ?? 0) + options.take),
);
const prisma = { order: { count, findMany } } as unknown as PrismaClient;
const app = express();
app.use('/api/admin', adminRoutes(prisma));
const server = app.listen(0, '127.0.0.1');
let baseUrl: string;

beforeAll(async () => {
  if (!server.listening) await new Promise<void>((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin/orders`;
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('管理端订单分页', () => {
  it('按页返回订单和总数', async () => {
    const response = await fetch(`${baseUrl}?page=2&pageSize=20`);
    const body = await response.json();
    expect(body).toMatchObject({ data: { total: 25, page: 2, pageSize: 20, orders: rows.slice(20) } });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 20 }));
  });

  it('未指定分页时保持原有返回行为', async () => {
    const body = await (await fetch(baseUrl)).json();
    expect(body).toEqual({ code: 0, data: { orders: rows } });
    expect(count).not.toHaveBeenCalled();
  });

  it('拒绝无效分页参数', async () => {
    const response = await fetch(`${baseUrl}?page=0&pageSize=101`);
    expect(response.status).toBe(400);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('组合筛选条件同时用于统计和分页查询', async () => {
    count.mockResolvedValueOnce(1);
    findMany.mockResolvedValueOnce([rows[5]]);
    const params = new URLSearchParams({ page: '1', pageSize: '10', orderNo: '  order-5 ', email: ' test@example.com ', status: 'paid' });
    const response = await fetch(`${baseUrl}?${params}`);
    expect(await response.json()).toMatchObject({ data: { total: 1, orders: [rows[5]] } });
    const where = {
      orderNo: { contains: 'order-5' },
      email: { contains: 'test@example.com' },
      status: 'paid',
      refundedAt: null,
      OR: [{ refundStatus: null }, { refundStatus: { notIn: ['requested', 'rejected', 'approved'] } }],
    };
    expect(count).toHaveBeenCalledWith({ where });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where, skip: 0, take: 10 }));
  });

  it.each([
    ['refund_requested', { refundStatus: 'requested' }],
    ['refund_rejected', { refundStatus: 'rejected' }],
    ['refunded', {
      AND: [
        { OR: [{ refundStatus: null }, { refundStatus: { notIn: ['requested', 'rejected'] } }] },
        { OR: [{ status: 'refunded' }, { refundedAt: { not: null } }, { refundStatus: 'approved' }] },
      ],
    }],
    ['delivered', {
      status: 'delivered',
      refundedAt: null,
      OR: [{ refundStatus: null }, { refundStatus: { notIn: ['requested', 'rejected', 'approved'] } }],
    }],
  ])('状态 %s 对应页面显示状态', async (status, where) => {
    const response = await fetch(`${baseUrl}?page=1&status=${status}`);
    expect(response.status).toBe(200);
    expect(count).toHaveBeenCalledWith({ where });
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
  });

  it('拒绝未知状态', async () => {
    const response = await fetch(`${baseUrl}?page=1&status=unknown`);
    expect(response.status).toBe(400);
    expect(count).not.toHaveBeenCalled();
    expect(findMany).not.toHaveBeenCalled();
  });
});

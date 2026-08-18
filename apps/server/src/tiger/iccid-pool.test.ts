import { describe, it, expect } from 'vitest';
import { cardPool, getAvailableIccid, iccidPoolCount } from './iccid-pool';

/** 构造一个轻量 prisma 桩（仅含本模块用到的查询） */
function makePrisma(cards: string[], usedIccids: string[]) {
  return {
    card: { findMany: async () => cards.map((iccid) => ({ iccid })) },
    esim: { findMany: async () => usedIccids.map((iccid) => ({ iccid })) },
  } as any;
}

describe('cardPool 卡片池合并', () => {
  it('合并环境变量与数据库卡片并去重', () => {
    expect(cardPool(['A', 'B'], ['B', 'C'])).toEqual(['A', 'B', 'C']);
  });

  it('环境变量为空时只返回数据库卡片', () => {
    expect(cardPool([], ['X', 'Y'])).toEqual(['X', 'Y']);
  });

  it('数据库为空时只返回环境变量卡片', () => {
    expect(cardPool(['X'], [])).toEqual(['X']);
  });

  it('两边都为空时返回空数组', () => {
    expect(cardPool([], [])).toEqual([]);
  });
});

describe('getAvailableIccid 取卡', () => {
  it('返回合并池中第一张未使用的卡片', async () => {
    const prisma = makePrisma(['A', 'B', 'C'], []);
    expect(await getAvailableIccid(prisma)).toBe('A');
  });

  it('跳过已在 esim 表中使用的卡片', async () => {
    const prisma = makePrisma(['A', 'B', 'C'], ['A', 'C']);
    expect(await getAvailableIccid(prisma)).toBe('B');
  });

  it('全部卡片已使用时返回 null', async () => {
    const prisma = makePrisma(['A', 'B'], ['A', 'B']);
    expect(await getAvailableIccid(prisma)).toBeNull();
  });

  it('池为空时返回 null', async () => {
    const prisma = makePrisma([], []);
    expect(await getAvailableIccid(prisma)).toBeNull();
  });
});

describe('iccidPoolCount 池统计', () => {
  it('统计合并去重后的卡片总数', async () => {
    const prisma = makePrisma(['A', 'B'], []);
    expect(await iccidPoolCount(prisma)).toBe(2);
  });
});

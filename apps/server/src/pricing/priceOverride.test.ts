import { describe, it, expect } from 'vitest';
import {
  applyWhitelistToItems,
  applyDisplayCurrencyToItems,
  type WhitelistMap,
  type DisplayConfig,
} from './priceOverride';

function makePkg(overrides: any = {}) {
  return {
    id: 'pkg-1',
    tigerPkgId: 1001,
    gb: 1,
    days: 7,
    price: 29.9,
    currency: 'CNY',
    ...overrides,
  };
}

const w = (price: number, onSale = true, currency = 'CNY') => ({ price, onSale, currency });

describe('applyWhitelistToItems 白名单过滤', () => {
  it('在白名单中且有价格时保留，价格用白名单自定价，onSale 生效', () => {
    const map: WhitelistMap = new Map([[1001, w(19.9)]]);
    const [out] = applyWhitelistToItems([makePkg()], map);
    expect(out).toBeDefined();
    expect(out.price).toBe(19.9);
    expect(out.onSale).toBe(true);
  });

  it('在白名单中但停售时仍保留，onSale=false（前端隐藏）', () => {
    const map: WhitelistMap = new Map([[1001, w(9.9, false)]]);
    const [out] = applyWhitelistToItems([makePkg()], map);
    expect(out).toBeDefined();
    expect(out.price).toBe(9.9);
    expect(out.onSale).toBe(false);
  });

  it('未添加（不在白名单）的套餐被剔除', () => {
    const list = applyWhitelistToItems([makePkg()], new Map());
    expect(list.length).toBe(0);
  });

  it('白名单只有部分套餐时，仅保留白名单内的', () => {
    const map: WhitelistMap = new Map([[1001, w(5)]]);
    const list = applyWhitelistToItems(
      [makePkg(), makePkg({ id: 'pkg-2', tigerPkgId: 2002 })],
      map,
    );
    expect(list.map((p) => p.tigerPkgId)).toEqual([1001]);
  });

  it('无 tigerPkgId 的本地套餐无法进入白名单（白名单仅支持 Tiger 关联套餐）', () => {
    const map: WhitelistMap = new Map([[9999, w(9.9)]]);
    const list = applyWhitelistToItems([makePkg({ tigerPkgId: undefined })], map);
    expect(list.length).toBe(0);
  });

  it('空列表 / 非数组返回空数组', () => {
    expect(applyWhitelistToItems([], new Map())).toEqual([]);
    expect(applyWhitelistToItems(null as any, new Map())).toEqual([]);
  });
});

describe('applyDisplayCurrencyToItems 展示货币换算', () => {
  const cfgCNY: DisplayConfig = { displayCurrency: 'CNY', usdCnyRate: 7 };
  const cfgUSD: DisplayConfig = { displayCurrency: 'USD', usdCnyRate: 7 };

  it('存储货币与展示货币相同（CNY→CNY）价格原样保留', () => {
    const [out] = applyDisplayCurrencyToItems([makePkg({ price: 17.5, currency: 'CNY' })], cfgCNY);
    expect(out.price).toBe(17.5);
    expect(out.currency).toBe('CNY');
  });

  it('存储货币与展示货币相同（USD→USD）价格原样保留', () => {
    const [out] = applyDisplayCurrencyToItems([makePkg({ price: 5, currency: 'USD' })], cfgUSD);
    expect(out.price).toBe(5);
    expect(out.currency).toBe('USD');
  });

  it('USD 存储价换算成 CNY（price × rate）并回填展示货币', () => {
    const [out] = applyDisplayCurrencyToItems([makePkg({ price: 5, currency: 'USD' })], cfgCNY);
    expect(out.price).toBe(35);
    expect(out.currency).toBe('CNY');
  });

  it('CNY 存储价换算成 USD（price ÷ rate）并保留两位小数', () => {
    const [out] = applyDisplayCurrencyToItems([makePkg({ price: 21, currency: 'CNY' })], cfgUSD);
    expect(out.price).toBe(3);
    expect(out.currency).toBe('USD');
  });

  it('缺省 currency 按 CNY 处理', () => {
    const pkg = makePkg({ price: 14, currency: undefined });
    const [out] = applyDisplayCurrencyToItems([pkg], cfgUSD);
    expect(out.price).toBe(2);
    expect(out.currency).toBe('USD');
  });

  it('非数组返回空数组', () => {
    expect(applyDisplayCurrencyToItems(null as any, cfgCNY)).toEqual([]);
  });
});
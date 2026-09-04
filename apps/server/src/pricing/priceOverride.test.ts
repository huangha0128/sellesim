import { describe, it, expect } from 'vitest';
import { applyWhitelistToItems, type WhitelistMap } from './priceOverride';

function makePkg(overrides: any = {}) {
  return {
    id: 'pkg-1',
    tigerPkgId: 1001,
    gb: 1,
    days: 7,
    price: 29.9,
    ...overrides,
  };
}

describe('applyWhitelistToItems 白名单过滤', () => {
  it('在白名单中且有价格时保留，价格用白名单自定价，onSale 生效', () => {
    const map: WhitelistMap = new Map([[1001, { price: 19.9, onSale: true }]]);
    const [out] = applyWhitelistToItems([makePkg()], map);
    expect(out).toBeDefined();
    expect(out.price).toBe(19.9);
    expect(out.onSale).toBe(true);
  });

  it('在白名单中但停售时仍保留，onSale=false（前端隐藏）', () => {
    const map: WhitelistMap = new Map([[1001, { price: 9.9, onSale: false }]]);
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
    const map: WhitelistMap = new Map([[1001, { price: 5, onSale: true }]]);
    const list = applyWhitelistToItems(
      [makePkg(), makePkg({ id: 'pkg-2', tigerPkgId: 2002 })],
      map,
    );
    expect(list.map((p) => p.tigerPkgId)).toEqual([1001]);
  });

  it('无 tigerPkgId 的本地套餐无法进入白名单（白名单仅支持 Tiger 关联套餐）', () => {
    const map: WhitelistMap = new Map([[9999, { price: 9.9, onSale: true }]]);
    const list = applyWhitelistToItems([makePkg({ tigerPkgId: undefined })], map);
    expect(list.length).toBe(0);
  });

  it('空列表 / 非数组返回空数组', () => {
    expect(applyWhitelistToItems([], new Map())).toEqual([]);
    expect(applyWhitelistToItems(null as any, new Map())).toEqual([]);
  });
});
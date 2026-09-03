import { describe, it, expect } from 'vitest';
import { applyOverridesToItems, type OverrideMap } from './priceOverride';

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

describe('applyOverridesToItems 定价覆盖合并', () => {
  it('存在覆盖时替换价格并保留原价为 originalPrice', () => {
    const map: OverrideMap = new Map([[1001, { price: 19.9, onSale: true }]]);
    const [out] = applyOverridesToItems([makePkg()], map);
    expect(out.price).toBe(19.9);
    expect(out.originalPrice).toBe(29.9);
    expect(out.onSale).toBe(true);
  });

  it('覆盖 price 为 null 时使用 Tiger 原价，但 onSale 仍生效', () => {
    const map: OverrideMap = new Map([[1001, { price: null, onSale: false }]]);
    const [out] = applyOverridesToItems([makePkg()], map);
    expect(out.price).toBe(29.9);
    expect(out.originalPrice).toBe(29.9);
    expect(out.onSale).toBe(false);
  });

  it('未覆盖的套餐价格不变、onSale 默认为 true', () => {
    const [out] = applyOverridesToItems([makePkg()], new Map());
    expect(out.price).toBe(29.9);
    expect(out.originalPrice).toBe(29.9);
    expect(out.onSale).toBe(true);
  });

  it('覆盖行存在但套餐不在列表中（key 不匹配）时不影响其他套餐', () => {
    const map: OverrideMap = new Map([[999, { price: 1, onSale: true }]]);
    const [out] = applyOverridesToItems([makePkg()], map);
    expect(out.price).toBe(29.9);
    expect(out.onSale).toBe(true);
  });

  it('无 tigerPkgId 的本地套餐不受覆盖影响（覆盖仅支持 Tiger 关联套餐）', () => {
    const map: OverrideMap = new Map([[9999, { price: 9.9, onSale: false }]]);
    const [out] = applyOverridesToItems([makePkg({ tigerPkgId: undefined })], map);
    expect(out.price).toBe(29.9);
    expect(out.originalPrice).toBe(29.9);
    expect(out.onSale).toBe(true);
  });

  it('空列表 / 非数组直接原样返回', () => {
    expect(applyOverridesToItems([], new Map())).toEqual([]);
    expect(applyOverridesToItems(null as any, new Map())).toBeNull();
  });
});
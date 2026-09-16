import { describe, it, expect, vi } from 'vitest';
import { resolvePriceFrom } from './subjectPricing';

function pkg(price = 100, overrides: any = {}) {
  return { tigerPkgId: 10, price, ...overrides };
}

describe('resolvePriceFrom 主体定价解析', () => {
  it('无覆盖、无默认加价时回落平台价', () => {
    const r = resolvePriceFrom(pkg(100), null, null);
    expect(r).toMatchObject({ visible: true, price: 100, markupPercent: null });
  });

  it('命中固定价时优先使用固定价（忽略默认加价）', () => {
    const r = resolvePriceFrom(pkg(100), { enabled: true, price: 150, markupPercent: 20 }, 10);
    expect(r).toMatchObject({ visible: true, price: 150, markupPercent: null });
  });

  it('命中加价比例时基于平台价加价', () => {
    const r = resolvePriceFrom(pkg(100), { enabled: true, price: null, markupPercent: 33 }, null);
    expect(r).toMatchObject({ visible: true, price: 133, markupPercent: 33 });
  });

  it('无套餐级覆盖时使用主体默认加价', () => {
    const r = resolvePriceFrom(pkg(200), null, 10);
    expect(r).toMatchObject({ visible: true, price: 220, markupPercent: 10 });
  });

  it('enabled=false 时对主体隐藏套餐', () => {
    const r = resolvePriceFrom(pkg(100), { enabled: false, price: null, markupPercent: null }, null);
    expect(r.visible).toBe(false);
  });
});
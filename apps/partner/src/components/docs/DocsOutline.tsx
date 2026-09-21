'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface OutlineNode {
  id: string;
  label: string;
  children?: { id: string; label: string; method?: 'GET' | 'POST' }[];
}

interface Props {
  items: OutlineNode[];
}

/** 方法色点 */
function MethodDot({ m }: { m?: 'GET' | 'POST' }) {
  if (!m) return null;
  const active = m === 'GET';
  return (
    <span
      className={cn(
        'hidden h-1.5 w-1.5 shrink-0 rounded-full',
        active ? 'bg-emerald-500' : 'bg-orange-500',
      )}
    />
  );
}

/**
 * 右侧粘性大纲：滚动 scrollspy 高亮当前章节 + 点击平滑跳转。
 * 子项标题使用人性化名称（接口功能名），附方法色点与描点数字。
 */
export function DocsOutline({ items }: Props) {
  const [active, setActive] = useState<string>(items[0]?.id ?? '');
  const [barTop, setBarTop] = useState<number>(0);

  const leafIds = useMemo(
    () => items.flatMap((n) => [n.id, ...(n.children?.map((c) => c.id) ?? [])]),
    [items],
  );
  const orderRef = useRef<string[]>([]);

  // 记录叶子锚点在导航树中的顺序，用于高亮游标定位
  useEffect(() => {
    orderRef.current = leafIds;
  }, [leafIds]);

  useEffect(() => {
    const compute = () => {
      const OFFSET = 150;
      let current = leafIds[0];
      let count = 0;
      for (const id of leafIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= OFFSET) {
          current = id;
          count++;
        }
      }
      setActive(current);
      const idx = orderRef.current.indexOf(current);
      if (idx >= 0) setBarTop(idx);
    };
    compute();
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leafIds.join(',')]);

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav className="w-56 text-[12.5px]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        本页目录
      </div>
      <div className="relative mt-3">
        <span
          className="absolute left-0 top-0 h-5 w-0.5 rounded-full bg-primary transition-transform duration-200"
          style={{ transform: `translateY(${barTop * 26}px)` }}
        />
        <ul className="space-y-0.5 border-l border-border/70 pl-4">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => go(n.id)}
                className={cn(
                  'block w-full rounded-md px-2 py-1 text-left transition-colors hover:bg-muted',
                  active === n.id
                    ? 'font-medium text-primary'
                    : 'text-muted-foreground hover:text-ink',
                )}
              >
                {n.label}
              </button>
              {n.children && (
                <ul className="mt-0.5 space-y-0.5 pl-2.5">
                  {n.children.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => go(c.id)}
                        className={cn(
                          'flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[12px] transition-colors hover:bg-muted',
                          active === c.id
                            ? 'font-medium text-primary'
                            : 'text-muted-foreground hover:text-ink',
                        )}
                      >
                        <MethodDot m={c.method} />
                        <span className="truncate">{c.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
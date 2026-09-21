'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

export interface OutlineNode {
  id: string;
  label: string;
  children?: { id: string; label: string }[];
}

interface Props {
  items: OutlineNode[];
}

/**
 * 右侧粘性大纲：监听滚动实时高亮当前阅读章节，点击可平滑跳转到对应锚点。
 * 通过 `scroll-mt` 保证锚点被 sticky 顶栏遮挡后仍能正确对齐。
 */
export function DocsOutline({ items }: Props) {
  const [active, setActive] = useState<string>(items[0]?.id ?? '');
  const [barTop, setBarTop] = useState<number>(0);

  // 扁平化所有叶子锚点 id，用于滚动高亮计算
  const leafIds = useMemo(
    () => items.flatMap((n) => [n.id, ...(n.children?.map((c) => c.id) ?? [])]),
    [items],
  );

  // 每个叶子锚点对应的大纲条目 Top 偏移，用于渲染高亮游标
  const leafRef = useRef<{ id: string; top: number }[]>([]);

  useEffect(() => {
    const compute = () => {
      const OFFSET = 140; // 与 scroll-mt 一致
      let current = leafIds[0];
      let count = 0;
      for (const id of leafIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= OFFSET) {
          current = id;
          count++;
        }
      }
      setActive(current);
      // 游标位置：取当前活跃叶子在导航树中的索引
      const idx = leafRef.current.findIndex((x) => x.id === current);
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

  // 记录叶子顺序，供滚动计算游标位置
  useEffect(() => {
    leafRef.current = leafIds.map((id) => ({ id, top: 0 }));
  }, [leafIds]);

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav className="w-56 text-[12.5px]">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        本页目录
      </div>
      <div className="relative mt-3">
        {/* 高亮游标 */}
        <span
          className="absolute left-0 top-0 h-5 w-0.5 rounded-full bg-primary transition-transform duration-200"
          style={{ transform: `translateY(${barTop * 24}px)` }}
        />
        <ul className="space-y-0.5 border-l border-border/70 pl-4">
          {items.map((n) => {
            const depthChildren = n.children;
            return (
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
                {depthChildren && (
                  <ul className="mt-0.5 space-y-0.5 pl-2.5">
                    {depthChildren.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => go(c.id)}
                          className={cn(
                            'flex w-full items-center gap-1.5 rounded-md px-2 py-1 font-mono text-[11.5px] transition-colors hover:bg-muted',
                            active === c.id
                              ? 'font-medium text-primary'
                              : 'text-muted-foreground hover:text-ink',
                          )}
                        >
                          <span className="mb-px inline-flex h-3.5 min-w-[26px] items-center justify-center rounded bg-secondary px-1 font-sans text-[9.5px] font-bold">
                            {c.label.split(' ')[0]}
                          </span>
                          <span className="truncate">{c.label.replace(/^(GET|POST)\s+/, '')}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
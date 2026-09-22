'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Package as PackageIcon,
  ReceiptText,
  BookOpen,
  UserRound,
  FileCode2,
  IdCard,
  LogOut,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { clearAuth, getSubject, LOGIN_PATH } from '@/lib/auth';
import { Button } from '@/components/ui/button';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: '总览', icon: LayoutDashboard },
  { href: '/packages', label: '套餐', icon: PackageIcon },
  { href: '/orders', label: '我的订单', icon: ReceiptText },
  { href: '/card', label: '卡状态查询', icon: IdCard },
  { href: '/ledger', label: '记账流水', icon: BookOpen },
  { href: '/profile', label: '个人中心', icon: UserRound },
  { href: '/docs', label: 'API 文档', icon: FileCode2 },
];

const TITLE_MAP: Record<string, string> = {
  '/dashboard': '总览',
  '/packages': '套餐',
  '/orders': '我的订单',
  '/card': '卡状态查询',
  '/ledger': '记账流水',
  '/profile': '个人中心',
  '/docs': 'API 文档',
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const current = TITLE_MAP[pathname] || '伙伴门户';
  // 登录态只在客户端可读，放 effect 里避免静态导出时的 hydration 不一致
  const [subjectName, setSubjectName] = useState('伙伴');

  useEffect(() => {
    const sub = getSubject();
    if (sub?.name) setSubjectName(sub.name);
  }, []);

  function handleLogout() {
    clearAuth();
    window.location.href = LOGIN_PATH;
  }

  return (
    <div className="app-canvas flex min-h-screen">
      {/* 侧边栏 */}
      <aside className="sidebar-canvas sticky top-0 flex h-screen w-60 shrink-0 flex-col">
        <div className="flex h-16 items-center gap-3 px-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#5a53e0] to-[#7c6ff0] shadow-sm">
            <Zap className="h-5 w-5 text-white" />
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-[0.02em] text-ink">YYeSim</div>
            <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">Partner</div>
          </div>
        </div>

        <nav className="mt-2 flex-1 space-y-1 overflow-y-auto px-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] transition-colors',
                  active
                    ? 'bg-accent font-medium text-accent-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-ink',
                )}
              >
                <Icon
                  className={cn(
                    'h-[18px] w-[18px] transition-colors',
                    active ? 'text-primary' : 'text-muted-foreground group-hover:text-ink',
                  )}
                />
                <span>{item.label}</span>
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border/70 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-[12px] font-semibold text-ink">
              伙
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[13px] font-medium text-ink">{subjectName}</div>
              <div className="text-[11px] text-muted-foreground">分销伙伴</div>
            </div>
          </div>
        </div>
      </aside>

      {/* 主区 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-background/85 px-8 backdrop-blur-md">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              YYeSim Partner
            </div>
            <div className="mt-0.5 text-[19px] font-bold leading-none tracking-tight text-ink">
              {current}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleLogout}
              title="退出登录"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-border/70 bg-card px-3 text-[12.5px] text-muted-foreground transition-colors hover:bg-muted hover:text-ink"
            >
              <LogOut className="h-4 w-4" />
              退出
            </button>
          </div>
        </header>

        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Globe,
  Package,
  ReceiptText,
  Smartphone,
  CreditCard,
  RefreshCw,
  Zap,
  Bell,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { href: '/countries', label: '国家管理', icon: Globe },
  { href: '/packages', label: '套餐管理', icon: Package },
  { href: '/orders', label: '订单管理', icon: ReceiptText },
  { href: '/esims', label: 'eSIM 管理', icon: Smartphone },
  { href: '/cards', label: '卡片管理', icon: CreditCard },
  { href: '/tiger-sync', label: 'Tiger 同步', icon: RefreshCw },
  { href: '/settings', label: '系统设置', icon: Settings },
];

const TITLE_MAP: Record<string, string> = {
  '/dashboard': '仪表盘',
  '/countries': '国家管理',
  '/packages': '套餐管理',
  '/orders': '订单管理',
  '/esims': 'eSIM 管理',
  '/cards': '卡片管理',
  '/tiger-sync': 'Tiger 同步',
  '/settings': '系统设置',
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const current = TITLE_MAP[pathname] || '管理后台';

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
            <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">Console</div>
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
              管
            </span>
            <div className="leading-tight">
              <div className="text-[13px] font-medium text-ink">管理员</div>
              <div className="text-[11px] text-muted-foreground">admin</div>
            </div>
          </div>
        </div>
      </aside>

      {/* 主区 */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/70 bg-background/85 px-8 backdrop-blur-md">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              YYeSim Console
            </div>
            <div className="mt-0.5 text-[19px] font-bold leading-none tracking-tight text-ink">
              {current}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground transition-colors hover:bg-muted">
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
            </button>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[12px] font-medium text-emerald-700">
              生产环境
            </span>
          </div>
        </header>

        <main className="flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
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
  UsersRound,
  MessagesSquare,
  BookOpenText,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { clearAuth, getAdmin, LOGIN_PATH } from '@/lib/auth';
import { adminApi, unwrap, type SupportNotification } from '@/api';

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
  { href: '/subjects', label: '开放平台主体', icon: UsersRound },
  { href: '/support', label: '在线客服', icon: MessagesSquare },
  { href: '/knowledge', label: '知识库管理', icon: BookOpenText },
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
  '/subjects': '开放平台主体',
  '/support': '在线客服',
  '/knowledge': '知识库管理',
  '/settings': '系统设置',
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = TITLE_MAP[pathname] || '管理后台';
  // 登录态只在客户端可读，放 effect 里避免静态导出时的 hydration 不一致
  const [username, setUsername] = useState('admin');

  useEffect(() => {
    const admin = getAdmin();
    if (admin?.username) setUsername(admin.username);
  }, []);

  // ---- 通知中心：待人工处理的会话（转人工事件 / 转人工后用户发来的新消息）----
  const [notifs, setNotifs] = useState<SupportNotification[]>([]);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [notifOpen, setNotifOpen] = useState(false);
  const seenRef = useRef<Set<string>>(new Set()); // 已提示过的通知指纹，避免重复弹桌面通知
  const primedRef = useRef(false); // 首轮只登记不提示，防止一进后台就狂弹

  function notifyDesktop(it: SupportNotification) {
    try {
      if (typeof window === 'undefined' || !('Notification' in window)) return;
      if (Notification.permission !== 'granted') return;
      const title = it.kind === 'transfer' ? '有用户请求转人工' : '人工会话有新消息';
      const n = new Notification(title, {
        body: `${it.nickname}：${(it.lastMessage || '').slice(0, 60)}`,
        tag: `${it.sessionId}:${it.unreadAdmin}`,
      });
      n.onclick = () => {
        window.focus();
        router.push(`/support/view?id=${it.sessionId}`);
      };
    } catch {
      // ignore
    }
  }

  const loadNotifs = useCallback(async () => {
    try {
      const res = await adminApi.getSupportNotifications();
      const body = unwrap<{ items: SupportNotification[]; unreadTotal: number; pendingHuman: number }>(res);
      const items = body.data.items || [];
      setNotifs(items);
      setUnreadTotal(body.data.unreadTotal || 0);

      const fp = (i: SupportNotification) => `${i.sessionId}:${i.unreadAdmin}:${i.updatedAt}`;
      if (primedRef.current) {
        for (const it of items) {
          if (!seenRef.current.has(fp(it))) notifyDesktop(it);
        }
      }
      seenRef.current = new Set(items.map(fp));
      primedRef.current = true;
    } catch {
      // 静默：通知拉取失败不影响后台其它功能
    }
  }, []);

  useEffect(() => {
    loadNotifs();
    const t = setInterval(loadNotifs, 10000);
    return () => clearInterval(t);
  }, [loadNotifs]);

  function toggleNotif() {
    setNotifOpen((v) => !v);
    // 首次点击铃铛时申请桌面通知权限（页面加载即申请易被浏览器直接拦截）
    try {
      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    } catch {
      // ignore
    }
  }

  function openSession(sessionId: string) {
    setNotifOpen(false);
    router.push(`/support/view?id=${sessionId}`);
  }

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
              <div className="text-[11px] text-muted-foreground">{username}</div>
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
            <div className="relative">
              <button
                onClick={toggleNotif}
                title="通知"
                className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-card text-muted-foreground transition-colors hover:bg-muted"
              >
                <Bell className="h-4 w-4" />
                {unreadTotal > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
                    {unreadTotal > 99 ? '99+' : unreadTotal}
                  </span>
                )}
              </button>

              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 top-11 z-50 w-[340px] overflow-hidden rounded-xl border border-border/70 bg-card shadow-lg">
                    <div className="flex items-center justify-between border-b border-border/70 px-4 py-2.5">
                      <span className="text-[13px] font-semibold text-ink">通知</span>
                      <span className="text-[11px] text-muted-foreground">
                        {notifs.length ? `待人工处理 ${notifs.length}` : '暂无待处理'}
                      </span>
                    </div>
                    <div className="max-h-[360px] overflow-y-auto">
                      {notifs.length === 0 ? (
                        <div className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">
                          暂无新通知
                          <div className="mt-1 text-[11.5px] text-muted-foreground/80">
                            用户转人工、或转人工后发消息时会在这里提醒
                          </div>
                        </div>
                      ) : (
                        notifs.map((it) => (
                          <button
                            key={it.sessionId}
                            onClick={() => openSession(it.sessionId)}
                            className="flex w-full items-start gap-2.5 border-b border-border/50 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted"
                          >
                            <span
                              className={cn(
                                'mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium',
                                it.kind === 'transfer'
                                  ? 'bg-red-50 text-red-600'
                                  : 'bg-amber-50 text-amber-600',
                              )}
                            >
                              {it.kind === 'transfer' ? '转人工' : '新消息'}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <span className="truncate text-[13px] font-medium text-ink">{it.nickname}</span>
                                {it.unreadAdmin > 0 && (
                                  <span className="shrink-0 rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
                                    {it.unreadAdmin}
                                  </span>
                                )}
                              </span>
                              <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                                {it.lastMessage || '（无内容）'}
                              </span>
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                    <button
                      onClick={() => { setNotifOpen(false); router.push('/support'); }}
                      className="w-full border-t border-border/70 px-4 py-2.5 text-center text-[12.5px] text-primary transition-colors hover:bg-muted"
                    >
                      查看全部会话
                    </button>
                  </div>
                </>
              )}
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[12px] font-medium text-emerald-700">
              生产环境
            </span>
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
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'YYeSim 管理后台',
  description: '全球 eSIM 上网卡商城管理后台',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={`min-h-screen font-sans`}>
        {children}
        <Toaster richColors closeButton position="top-center" />
      </body>
    </html>
  );
}
import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'YYeSim 伙伴门户',
  description: '全球 eSIM 上网卡开放平台分销伙伴门户',
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
import { router } from './router';

/**
 * 在 hash 路由下滚动到指定区块。
 * 区块 id 存在于首页各 Section（top/destinations/why/how/faq/buy）。
 * 若当前不在首页，先切回首页再滚动。
 */
export function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  if (router.currentRoute.value.path !== '/') {
    router.push('/');
    setTimeout(() => scrollToSection(id), 60);
  }
}
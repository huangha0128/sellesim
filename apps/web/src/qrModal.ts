import { ref } from 'vue';

/**
 * 全局「支付宝小程序码」弹窗开关。
 * 官网任意位置（导航、目录页、页脚…）都可调用 openQr() 弹出同一个小程序码。
 */
export const qrOpen = ref(false);

export function openQr() {
  qrOpen.value = true;
}

export function closeQr() {
  qrOpen.value = false;
}

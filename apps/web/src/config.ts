// 支付宝小程序入口（真实 appId，来自 apps/miniapp/src/manifest.json mp-alipay）
export const ALIPAY_APP_ID = '2021006186614108';

// 打开小程序主页的 alipays scheme（扫码后由支付宝唤起小程序并进入默认首页）
const MINI_PROGRAM_HOME = 'pages/index/index';

export function alipayMiniProgramUrl(): string {
  return `alipays://platformapi/startapp?appId=${ALIPAY_APP_ID}&page=${encodeURIComponent(MINI_PROGRAM_HOME)}`;
}
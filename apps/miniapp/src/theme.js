/* YYeSim 品牌色 JS 侧常量（与 uni.scss 保持一致）
   供 canvas 绘制、confirmColor、内联渐变等无法使用 SCSS 变量的场景使用 */

export const colors = {
  brand: '#4050C0', // 主色
  brandBright: '#5050D0', // 亮紫蓝（logo 提取）
  brandDeep: '#3030A0',
  brandRoyal: '#203090',
  brandDarker: '#102070',
  brandSky: '#6CD5FA', // 蓝青高光
  ink: '#1A1D3A', // 主文字
  danger: '#DE4B5B',
}

/* 套餐封面渐变（浅蓝在上 → 蓝紫在下，白字位于底部保持可读） */
export const COVER_GRADIENTS = [
  'linear-gradient(160deg, #6CD5FA 0%, #4050C0 60%, #3030A0 100%)',
  'linear-gradient(160deg, #B4C2FA 0%, #5050D0 55%, #3030A0 100%)',
  'linear-gradient(160deg, #6CD5FA 0%, #5050D0 50%, #102070 100%)',
  'linear-gradient(135deg, #FF9A76 0%, #FF7A59 100%)',
  'linear-gradient(160deg, #D6DEFF 0%, #4050C0 60%, #203090 100%)',
  'linear-gradient(160deg, #6CD5FA 15%, #3030A0 70%, #102070 100%)',
]

/* eSIM 详情页头部渐变（左上深蓝紫承托白字，右下渐入浅蓝） */
export const HEADER_GRADIENT = 'linear-gradient(135deg, #3030A0 0%, #4050C0 50%, #6CD5FA 100%)'

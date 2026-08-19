/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静态导出：产物为纯静态文件，可由现有 nginx 直接托管（部署路径为 /backend）
  output: 'export',
  // 与 vite 时代的 /backend/ 一致，路由前缀
  basePath: '/backend',
  // 目录式 URL，便于 nginx try_files 直接命中子路由 index.html
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
};

export default nextConfig;
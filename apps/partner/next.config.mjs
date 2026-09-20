/** @type {import('next').NextConfig} */
const nextConfig = {
  // 静态导出：产物为纯静态文件，伙伴门户部署路径为 /partner
  output: 'export',
  basePath: '/partner',
  // 目录式 URL，便于 nginx try_files 直接命中子路由 index.html
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
};

export default nextConfig;
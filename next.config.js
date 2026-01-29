/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // 跳过API路由，因为静态托管不支持
  skipTrailingSlashRedirect: true,
};

module.exports = nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 生产环境配置 - 支持API路由
  reactStrictMode: true,
  // 允许跨域API请求（如果需要）
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
  // 输出配置 - 移除静态导出，支持服务器端渲染和API路由
  output: 'standalone',
  // 忽略构建时的TypeScript错误（可选）
  typescript: {
    ignoreBuildErrors: true,
  },
  // 忽略ESLint错误（可选）
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;

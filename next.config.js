/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: 'export', // 已移除，Vercel会自动处理Next.js输出
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;

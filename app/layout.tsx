import type { Metadata } from 'next';
import './globals.css';
import { initializeServerModules } from '@/lib/server-init';

// 服务器端初始化
if (typeof window === 'undefined') {
  // 在服务器端执行初始化
  (async () => {
    try {
      console.log('Server-side initialization starting...');
      const result = await initializeServerModules();
      if (result.success) {
        console.log('Server-side initialization completed successfully');
      } else {
        console.warn('Server-side initialization completed with warnings:', result.error);
      }
    } catch (error) {
      console.error('Server-side initialization failed:', error);
    }
  })();
}

// 检测是否在Electron环境中
const isElectron = typeof window !== 'undefined' && (window as any).electronAPI;

export const metadata: Metadata = {
  title: `${process.env.NEXT_PUBLIC_APP_NAME || '合同风险审核系统'}`,
  description: 'AI驱动的智能合约风险审计系统',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-gray-50">
        {children}
        {isElectron && (
          <script>
            // 配置Electron环境下的API访问
            window.isElectron = true;
          </script>
        )}
      </body>
    </html>
  );
}
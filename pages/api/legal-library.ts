import { NextApiRequest, NextApiResponse } from 'next';
import { localLegalLibrary } from '@/lib/local-legal-library';

// 确保在处理请求前初始化法律文库
try {
  localLegalLibrary.ensureInitialized();
  console.log('Local legal library initialized successfully');
} catch (error) {
  console.error('Failed to initialize local legal library:', error);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // 确保法律文库已初始化
    await localLegalLibrary.ensureInitialized();
    
    const { action, params } = req.body;

    switch (action) {
      case 'search':
        // 关键词检索
        const { keywords, types } = params;
        const searchResult = await localLegalLibrary.search({ keywords, types });
        return res.status(200).json({
          success: true,
          data: searchResult.provisions,
          count: searchResult.total,
          duration: searchResult.duration
        });

      case 'getById':
        // 按ID查询
        const { id } = params;
        const document = localLegalLibrary.getById(id);
        return res.status(200).json({
          success: true,
          data: document
        });

      case 'getAll':
        // 获取所有法律条文
        const allProvisions = localLegalLibrary.getAllProvisions();
        return res.status(200).json({
          success: true,
          data: allProvisions,
          count: allProvisions.length
        });

      case 'getTotalCount':
        // 获取法律条文总数
        const totalCount = localLegalLibrary.getTotalCount();
        return res.status(200).json({
          success: true,
          data: { total: totalCount }
        });

      case 'getSystemStatus':
        // 获取系统状态
        const status = localLegalLibrary.getSystemStatus();
        return res.status(200).json({
          success: true,
          data: status
        });

      default:
        return res.status(400).json({ message: 'Invalid action' });
    }
  } catch (error) {
    console.error('Error processing legal library request:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: (error as Error).message
    });
  }
}
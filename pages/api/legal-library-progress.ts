import { NextApiRequest, NextApiResponse } from 'next';
import { optimizedLegalLibrary, LoadProgress } from '@/lib/optimized-legal-library';
import { getLoadProgress, reinitializeServerModules } from '@/lib/server-init';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { action, params } = req.body;

    switch (action) {
      case 'getLoadProgress':
        // 获取当前加载进度
        const progress = getLoadProgress();
        const status = optimizedLegalLibrary.getSystemStatus();
        
        // 如果还没有进度，返回当前状态
        if (!progress) {
          return res.status(200).json({
            success: true,
            data: {
              stage: status.initialized ? 'completed' : 'initializing',
              progress: status.initialized ? 100 : 0,
              loadedCount: status.total_provisions,
              totalCount: status.total_provisions,
              message: status.initialized ? '加载完成' : '正在初始化...',
              initialized: status.initialized
            }
          });
        }
        
        return res.status(200).json({
          success: true,
          data: progress
        });

      case 'getSystemStatus':
        // 获取系统状态
        const systemStatus = optimizedLegalLibrary.getSystemStatus();
        return res.status(200).json({
          success: true,
          data: systemStatus
        });

      case 'search':
        // 关键词检索
        const { keywords, types, category } = params;
        const searchResult = await optimizedLegalLibrary.search({ keywords, types, category });
        return res.status(200).json({
          success: true,
          data: searchResult.provisions,
          count: searchResult.total,
          duration: searchResult.duration
        });

      case 'getById':
        // 按ID查询
        const { id } = params;
        const document = optimizedLegalLibrary.getById(id);
        return res.status(200).json({
          success: true,
          data: document
        });

      case 'getAll':
        // 获取所有法律条文
        const allProvisions = optimizedLegalLibrary.getAllProvisions();
        return res.status(200).json({
          success: true,
          data: allProvisions,
          count: allProvisions.length
        });

      case 'getTotalCount':
        // 获取法律条文总数
        const totalCount = optimizedLegalLibrary.getTotalCount();
        return res.status(200).json({
          success: true,
          data: { total: totalCount }
        });

      case 'reinitialize':
        // 重新初始化
        const reinitResult = await reinitializeServerModules();
        return res.status(200).json({
          success: reinitResult.success,
          data: {
            message: reinitResult.success ? '重新初始化成功' : '重新初始化失败',
            duration: reinitResult.duration,
            error: reinitResult.error?.message
          }
        });

      case 'checkReady':
        // 检查是否就绪
        const isReady = optimizedLegalLibrary.getInitialized();
        const currentStatus = optimizedLegalLibrary.getSystemStatus();
        return res.status(200).json({
          success: true,
          data: {
            ready: isReady,
            totalProvisions: currentStatus.total_provisions,
            lastUpdate: currentStatus.last_update
          }
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
import { NextApiRequest, NextApiResponse } from 'next';
import { optimizedLegalLibrary } from '@/lib/optimized-legal-library';
import { databaseService } from '@/lib/database';

// 性能指标收集
let performanceHistory: {
  timestamp: number;
  memory: { used: number; total: number; percentage: number };
  cpu: { usage: number };
  database: { provisionsCount: number; uptime: number };
  api: { averageResponseTime: number; requestsPerSecond: number; errorRate: number };
  system: { loadTime: number; activeConnections: number };
}[] = [];

let apiStats = {
  totalRequests: 0,
  totalErrors: 0,
  totalResponseTime: 0,
  lastRequestTime: Date.now(),
  requestsThisSecond: 0,
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { action } = req.body;

    switch (action) {
      case 'getMetrics':
        // 更新 API 统计
        updateApiStats();
        
        // 获取当前指标
        const metrics = collectMetrics();
        
        // 添加到历史记录
        performanceHistory.push(metrics);
        if (performanceHistory.length > 100) {
          performanceHistory.shift();
        }

        return res.status(200).json({
          success: true,
          data: metrics
        });

      case 'getHistory':
        // 获取历史记录
        return res.status(200).json({
          success: true,
          data: performanceHistory
        });

      case 'getStats':
        // 获取 API 统计
        updateApiStats();
        return res.status(200).json({
          success: true,
          data: {
            ...apiStats,
            errorRate: apiStats.totalRequests > 0 
              ? (apiStats.totalErrors / apiStats.totalRequests) * 100 
              : 0,
            averageResponseTime: apiStats.totalRequests > 0 
              ? apiStats.totalResponseTime / apiStats.totalRequests 
              : 0
          }
        });

      case 'recordRequest':
        // 记录请求
        const { responseTime, hasError } = req.body;
        recordApiRequest(responseTime, hasError);
        return res.status(200).json({ success: true });

      case 'healthCheck':
        // 健康检查
        const status = optimizedLegalLibrary.getSystemStatus();
        return res.status(200).json({
          success: true,
          data: {
            healthy: status.initialized,
            provisionsCount: status.total_provisions,
            lastUpdate: status.last_update
          }
        });

      default:
        return res.status(400).json({ message: 'Invalid action' });
    }
  } catch (error) {
    console.error('Error processing performance request:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: (error as Error).message
    });
  }
}

// 收集性能指标
function collectMetrics() {
  // 获取内存使用情况
  const memoryUsage = process.memoryUsage();
  const totalMemory = 2 * 1024 * 1024 * 1024; // 假设 2GB 堆限制
  const usedMemory = memoryUsage.heapUsed;
  const memoryPercentage = (usedMemory / totalMemory) * 100;

  // 获取数据库统计
  const dbStats = databaseService.getStats();

  // 计算 API 统计
  updateApiStats();
  const requestsPerSecond = apiStats.requestsThisSecond;
  const errorRate = apiStats.totalRequests > 0 
    ? (apiStats.totalErrors / apiStats.totalRequests) * 100 
    : 0;
  const averageResponseTime = apiStats.totalRequests > 0 
    ? apiStats.totalResponseTime / apiStats.totalRequests 
    : 0;

  return {
    timestamp: Date.now(),
    memory: {
      used: usedMemory,
      total: totalMemory,
      percentage: memoryPercentage,
    },
    cpu: {
      usage: 0, // Node.js 不直接提供 CPU 使用率
    },
    database: {
      provisionsCount: dbStats.provisionsCount,
      uptime: dbStats.uptime,
    },
    api: {
      averageResponseTime,
      requestsPerSecond,
      errorRate,
    },
    system: {
      loadTime: 0,
      activeConnections: 1,
    },
  };
}

// 更新 API 统计
function updateApiStats() {
  const now = Date.now();
  const elapsed = now - apiStats.lastRequestTime;
  
  // 每秒重置请求计数
  if (elapsed >= 1000) {
    apiStats.requestsThisSecond = 0;
    apiStats.lastRequestTime = now;
  }
}

// 记录 API 请求
function recordApiRequest(responseTime: number, hasError: boolean) {
  apiStats.totalRequests++;
  apiStats.totalResponseTime += responseTime;
  apiStats.requestsThisSecond++;
  
  if (hasError) {
    apiStats.totalErrors++;
  }
}
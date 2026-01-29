// 服务器启动初始化文件
// 负责在服务器启动时初始化法律文库模块

import { optimizedLegalLibrary, LoadProgress } from './optimized-legal-library';
import { performance } from 'perf_hooks';

// 初始化状态
let initializationStatus = {
  initialized: false,
  loading: false,
  error: null as Error | null,
  startTime: 0,
  endTime: 0,
  duration: 0,
  progress: null as LoadProgress | null,
};

// 初始化锁，防止并发初始化
let initializationPromise: Promise<boolean> | null = null;

/**
 * 初始化法律文库（优化版，支持进度报告）
 */
export async function initializeServerModules(): Promise<{
  success: boolean;
  error?: Error;
  duration: number;
}> {
  // 如果已经初始化完成，直接返回
  if (initializationStatus.initialized) {
    return {
      success: true,
      duration: initializationStatus.duration,
    };
  }

  // 如果正在初始化，返回现有Promise
  if (initializationPromise) {
    try {
      const success = await initializationPromise;
      return {
        success,
        duration: initializationStatus.duration,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        duration: initializationStatus.duration,
      };
    }
  }

  // 开始初始化
  initializationStatus = {
    ...initializationStatus,
    loading: true,
    startTime: performance.now(),
  };

  // 设置进度回调
  optimizedLegalLibrary.setProgressCallback((progress: LoadProgress) => {
    initializationStatus.progress = progress;
    
    // 在控制台显示进度
    if (progress.stage === 'error') {
      console.error(`[LOAD ERROR] ${progress.message}: ${progress.error}`);
    } else {
      console.log(`[LOAD PROGRESS] ${progress.stage}: ${progress.progress}% - ${progress.message}`);
    }
  });

  // 创建初始化Promise
  initializationPromise = (async () => {
    try {
      console.log('开始初始化服务器模块（优化版）...');
      
      // 初始化优化后的法律文库
      console.log('初始化法律文库（增量加载模式）...');
      await optimizedLegalLibrary.initialize(true);
      
      // 验证初始化结果
      const isInitialized = optimizedLegalLibrary.getInitialized();
      if (!isInitialized) {
        throw new Error('法律文库初始化失败：初始化状态为false');
      }
      
      // 初始化完成
      initializationStatus = {
        initialized: true,
        loading: false,
        error: null,
        startTime: initializationStatus.startTime,
        endTime: performance.now(),
        duration: performance.now() - initializationStatus.startTime,
        progress: {
          stage: 'completed',
          progress: 100,
          loadedCount: optimizedLegalLibrary.getTotalCount(),
          totalCount: optimizedLegalLibrary.getTotalCount(),
          message: '初始化完成'
        }
      };
      
      const status = optimizedLegalLibrary.getSystemStatus();
      console.log(`服务器模块初始化成功！`);
      console.log(`  - 法律条文总数: ${status.total_provisions}`);
      console.log(`  - 关键词索引: ${status.index_size.keyword_index}`);
      console.log(`  - 条款索引: ${status.index_size.clause_index}`);
      console.log(`  - 初始化耗时: ${initializationStatus.duration.toFixed(2)}ms`);
      
      return true;
    } catch (error) {
      console.error('服务器模块初始化失败:', error);
      
      initializationStatus = {
        initialized: false,
        loading: false,
        error: error as Error,
        startTime: initializationStatus.startTime,
        endTime: performance.now(),
        duration: performance.now() - initializationStatus.startTime,
        progress: {
          stage: 'error',
          progress: 0,
          loadedCount: 0,
          totalCount: 0,
          message: '初始化失败',
          error: (error as Error).message
        }
      };
      
      return false;
    } finally {
      // 释放初始化锁
      initializationPromise = null;
    }
  })();

  try {
    const success = await initializationPromise;
    return {
      success,
      error: initializationStatus.error ?? undefined,
      duration: initializationStatus.duration,
    };
  } catch (error) {
    return {
      success: false,
      error: error as Error,
      duration: initializationStatus.duration,
    };
  }
}

/**
 * 获取初始化状态
 */
export function getInitializationStatus() {
  return { ...initializationStatus };
}

/**
 * 获取当前加载进度
 */
export function getLoadProgress(): LoadProgress | null {
  return initializationStatus.progress;
}

/**
 * 检查是否已初始化
 */
export function isServerInitialized() {
  return initializationStatus.initialized;
}

/**
 * 强制重新初始化
 */
export async function reinitializeServerModules() {
  initializationStatus = {
    initialized: false,
    loading: false,
    error: null,
    startTime: 0,
    endTime: 0,
    duration: 0,
    progress: null,
  };
  initializationPromise = null;
  
  return initializeServerModules();
}

// 导出默认初始化函数
export default initializeServerModules;
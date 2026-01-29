'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, CheckCircle, AlertCircle, RefreshCw, BookOpen } from 'lucide-react';

interface LoadProgress {
  stage: 'initializing' | 'checking_database' | 'loading_files' | 'building_index' | 'completed' | 'error';
  progress: number;
  currentFile?: string;
  loadedCount: number;
  totalCount: number;
  message: string;
  error?: string;
}

interface LegalLibraryLoaderProps {
  onLoadComplete?: () => void;
  onLoadError?: (error: string) => void;
  autoStart?: boolean;
  showDetails?: boolean;
}

const LegalLibraryLoader: React.FC<LegalLibraryLoaderProps> = ({
  onLoadComplete,
  onLoadError,
  autoStart = true,
  showDetails = true,
}) => {
  const [progress, setProgress] = useState<LoadProgress | null>(null);
  const [isLoading, setIsLoading] = useState(autoStart);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);

  // 阶段显示映射
  const stageLabels: Record<LoadProgress['stage'], string> = {
    initializing: '系统初始化',
    checking_database: '检查数据库',
    loading_files: '加载法律条文',
    building_index: '构建索引',
    completed: '加载完成',
    error: '加载失败',
  };

  // 阶段描述
  const stageDescriptions: Record<LoadProgress['stage'], string> = {
    initializing: '正在准备系统环境...',
    checking_database: '正在检查已缓存的法律条文...',
    loading_files: '正在从文件加载法律条文...',
    building_index: '正在构建搜索索引...',
    completed: '所有法律条文已就绪',
    error: '加载过程中遇到问题',
  };

  // 获取进度
  useEffect(() => {
    if (!isLoading) return;

    setStartTime(Date.now());
    const timer = setInterval(async () => {
      try {
        const response = await fetch('/api/legal-library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getLoadProgress' }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            const loadProgress = data.data;
            setProgress(loadProgress);

            // 更新经过时间
            if (startTime) {
              setElapsedTime(Date.now() - startTime);
            }

            // 检查加载状态
            if (loadProgress.stage === 'completed') {
              setIsLoading(false);
              onLoadComplete?.();
            } else if (loadProgress.stage === 'error') {
              setIsLoading(false);
              setError(loadProgress.error || '加载失败');
              onLoadError?.(loadProgress.error || '加载失败');
            }
          }
        }
      } catch (err) {
        console.error('获取加载进度失败:', err);
      }
    }, 500); // 每500ms更新一次

    return () => {
      clearInterval(timer);
    };
  }, [isLoading, onLoadComplete, onLoadError, startTime]);

  // 手动开始加载
  const handleStartLoading = async () => {
    setError(null);
    setIsLoading(true);
    setProgress(null);
    setElapsedTime(0);
  };

  // 重试加载
  const handleRetry = async () => {
    try {
      const response = await fetch('/api/legal-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reinitialize' }),
      });

      if (response.ok) {
        handleStartLoading();
      }
    } catch (err) {
      setError('重试失败，请刷新页面重试');
    }
  };

  // 格式化时间
  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}分钟`;
  };

  // 获取进度颜色
  const getProgressColor = () => {
    if (!progress) return 'bg-primary-600';
    if (progress.stage === 'error') return 'bg-red-600';
    if (progress.stage === 'completed') return 'bg-green-600';
    return 'bg-primary-600';
  };

  // 渲染进度条
  const renderProgressBar = () => {
    const currentProgress = progress?.progress || 0;
    
    return (
      <div className="w-full">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">
            {progress ? stageLabels[progress.stage] : '准备中...'}
          </span>
          <span className="text-sm font-medium text-gray-700">
            {currentProgress}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ease-out ${getProgressColor()}`}
            style={{ width: `${currentProgress}%` }}
          />
        </div>
      </div>
    );
  };

  // 渲染加载中状态
  const renderLoading = () => (
    <div className="flex flex-col items-center justify-center p-8 space-y-6">
      {/* 图标和进度 */}
      <div className="flex items-center space-x-4">
        <div className="relative">
          <Loader2 className="w-12 h-12 text-primary-600 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
        </div>
        <div className="text-2xl font-bold text-gray-800">
          正在加载法律文库
        </div>
      </div>

      {/* 进度条 */}
      <div className="w-full max-w-md">
        {renderProgressBar()}
      </div>

      {/* 状态信息 */}
      {progress && (
        <div className="w-full max-w-md space-y-3">
          {/* 消息 */}
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>{progress.message}</span>
          </div>

          {/* 详细信息 */}
          {showDetails && (
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">当前阶段</span>
                <span className="font-medium">{stageDescriptions[progress.stage]}</span>
              </div>
              
              {progress.currentFile && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">处理文件</span>
                  <span className="font-medium truncate max-w-xs">
                    {progress.currentFile}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">已加载</span>
                <span className="font-medium">
                  {progress.loadedCount} / {progress.totalCount > 0 ? progress.totalCount : '...'}
                </span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">经过时间</span>
                <span className="font-medium">{formatTime(elapsedTime)}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 取消按钮 */}
      <button
        onClick={() => setIsLoading(false)}
        className="text-sm text-gray-500 hover:text-gray-700 underline"
      >
        取消加载
      </button>
    </div>
  );

  // 渲染完成状态
  const renderCompleted = () => (
    <div className="flex flex-col items-center justify-center p-8 space-y-6">
      <div className="flex items-center space-x-4">
        <CheckCircle className="w-16 h-16 text-green-500" />
        <div className="text-2xl font-bold text-gray-800">
          法律文库加载完成
        </div>
      </div>

      {progress && (
        <div className="w-full max-w-md bg-green-50 rounded-lg p-6 space-y-3">
          <div className="flex justify-between text-lg">
            <span className="text-gray-600">法律条文总数</span>
            <span className="font-bold text-green-700">
              {progress.totalCount.toLocaleString()} 条
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">加载时间</span>
            <span className="font-medium">{formatTime(elapsedTime)}</span>
          </div>
        </div>
      )}

      <button
        onClick={handleStartLoading}
        className="flex items-center space-x-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        <span>刷新数据</span>
      </button>
    </div>
  );

  // 渲染错误状态
  const renderError = () => (
    <div className="flex flex-col items-center justify-center p-8 space-y-6">
      <div className="flex items-center space-x-4">
        <AlertCircle className="w-16 h-16 text-red-500" />
        <div className="text-2xl font-bold text-gray-800">
          法律文库加载失败
        </div>
      </div>

      <div className="w-full max-w-md bg-red-50 rounded-lg p-6 space-y-4">
        <div className="flex items-start space-x-3">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
          <div>
            <p className="font-medium text-red-800">加载过程中出现错误</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
          </div>
        </div>

        {progress && progress.error && (
          <div className="text-sm text-gray-600">
            <span className="font-medium">错误详情：</span>
            {progress.error}
          </div>
        )}
      </div>

      <div className="flex space-x-4">
        <button
          onClick={handleRetry}
          className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>重试加载</span>
        </button>

        <button
          onClick={handleStartLoading}
          className="flex items-center space-x-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          <span>重新初始化</span>
        </button>
      </div>
    </div>
  );

  // 主渲染
  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* 头部 */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-4">
        <div className="flex items-center space-x-3">
          <BookOpen className="w-8 h-8 text-white" />
          <div>
            <h2 className="text-xl font-bold text-white">法律文库系统</h2>
            <p className="text-sm text-primary-100">智能法律条文检索系统</p>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="p-6">
        {!isLoading && !progress?.stage && !error && (
          <div className="flex flex-col items-center justify-center p-8 space-y-6">
            <div className="flex items-center space-x-4">
              <BookOpen className="w-16 h-16 text-gray-400" />
              <div className="text-xl font-bold text-gray-600">
                法律文库
              </div>
            </div>

            <button
              onClick={handleStartLoading}
              className="flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors shadow-md"
            >
              <Loader2 className="w-5 h-5" />
              <span>开始加载法律条文</span>
            </button>
          </div>
        )}

        {isLoading && renderLoading()}
        
        {!isLoading && progress?.stage === 'completed' && renderCompleted()}
        
        {(!isLoading || progress?.stage === 'error') && error && renderError()}
      </div>

      {/* 底部信息 */}
      {progress && progress.stage === 'completed' && (
        <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>系统就绪，可以开始合同审核</span>
            <span>版本 2.0.0</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LegalLibraryLoader;
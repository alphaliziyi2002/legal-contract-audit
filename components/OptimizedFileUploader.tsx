'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Upload, FileText, X, CheckCircle, AlertCircle, Clock, Zap, RefreshCw } from 'lucide-react';

interface FileUploadProgress {
  fileName: string;
  fileSize: number;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'completed' | 'error';
  speed?: number;
  elapsedTime?: number;
  remainingTime?: number;
  error?: string;
  result?: {
    text: string;
    charCount: number;
    lineCount: number;
    extractionTime: number;
  };
}

interface OptimizedFileUploaderProps {
  onUploadComplete?: (result: { text: string; fileName: string }) => void;
  onUploadError?: (error: string) => void;
  maxFileSize?: number;
  acceptedTypes?: string[];
  showPerformanceStats?: boolean;
}

const OptimizedFileUploader: React.FC<OptimizedFileUploaderProps> = ({
  onUploadComplete,
  onUploadError,
  maxFileSize = 10 * 1024 * 1024,
  acceptedTypes = ['.pdf', '.docx', '.txt'],
  showPerformanceStats = true,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<FileUploadProgress[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [stats, setStats] = useState({
    totalUploads: 0,
    successfulUploads: 0,
    failedUploads: 0,
    totalProcessingTime: 0,
    averageProcessingTime: 0,
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadStartTime = useRef<number>(0);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}分钟`;
  };

  const addToQueue = (file: File): FileUploadProgress => {
    const uploadItem: FileUploadProgress = {
      fileName: file.name,
      fileSize: file.size,
      progress: 0,
      status: 'pending',
    };

    setUploadQueue(prev => [...prev, uploadItem]);
    return uploadItem;
  };

  const updateQueueItem = (fileName: string, updates: Partial<FileUploadProgress> | ((prev: FileUploadProgress) => Partial<FileUploadProgress>)) => {
    setUploadQueue(prev => prev.map(item => 
      item.fileName === fileName ? { ...item, ...(typeof updates === 'function' ? updates(item) : updates) } : item
    ));
  };

  const processFile = async (file: File) => {
    const startTime = Date.now();
    const uploadItem = addToQueue(file);
    const queueIndex = uploadQueue.findIndex(item => item.fileName === file.name);

    try {
      updateQueueItem(file.name, { status: 'uploading', progress: 10 });

      const progressTimer = setInterval(() => {
        updateQueueItem(file.name, (prev) => {
          const newProgress = Math.min(prev.progress + 10, 90);
          const elapsed = Date.now() - startTime;
          const speed = elapsed > 0 ? (file.size * (newProgress / 100)) / (elapsed / 1000) : 0;
          const remaining = speed > 0 ? ((file.size - file.size * (newProgress / 100)) / speed) * 1000 : 0;
          
          return {
            ...prev,
            progress: newProgress,
            speed,
            elapsedTime: elapsed,
            remainingTime: remaining,
          };
        });
      }, 200);

      const formData = new FormData();
      formData.append('file', file);

      updateQueueItem(file.name, { status: 'processing', progress: 30 });

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressTimer);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || '文件上传失败');
      }

      const data = await response.json();

      const processingTime = Date.now() - startTime;
      updateQueueItem(file.name, {
        status: 'completed',
        progress: 100,
        result: {
          text: data.text,
          charCount: data.charCount,
          lineCount: data.lineCount,
          extractionTime: data.extractionTime,
        },
        elapsedTime: processingTime,
      });

      setStats(prev => ({
        totalUploads: prev.totalUploads + 1,
        successfulUploads: prev.successfulUploads + 1,
        failedUploads: prev.failedUploads,
        totalProcessingTime: prev.totalProcessingTime + processingTime,
        averageProcessingTime: (prev.totalProcessingTime + processingTime) / (prev.totalUploads + 1),
      }));

      onUploadComplete?.({ text: data.text, fileName: file.name });

    } catch (error) {
      const errorMessage = (error as Error).message;
      
      updateQueueItem(file.name, {
        status: 'error',
        error: errorMessage,
        elapsedTime: Date.now() - startTime,
      });

      setStats(prev => ({
        ...prev,
        totalUploads: prev.totalUploads + 1,
        failedUploads: prev.failedUploads + 1,
        averageProcessingTime: prev.totalUploads > 0 
          ? prev.totalProcessingTime / prev.totalUploads 
          : 0,
      }));

      onUploadError?.(errorMessage);
    }
  };

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    uploadStartTime.current = Date.now();

    for (const file of Array.from(files)) {
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!acceptedTypes.includes(fileExt)) {
        onUploadError?.(`不支持的文件类型: ${fileExt}`);
        continue;
      }

      if (file.size > maxFileSize) {
        onUploadError?.(`文件大小超过限制: ${formatFileSize(file.size)} / ${formatFileSize(maxFileSize)}`);
        continue;
      }

      await processFile(file);
    }

    setIsUploading(false);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [acceptedTypes, maxFileSize, onUploadComplete, onUploadError]);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragOver(false);

    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);

    for (const file of Array.from(files)) {
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
      if (!acceptedTypes.includes(fileExt)) {
        onUploadError?.(`不支持的文件类型: ${fileExt}`);
        continue;
      }

      if (file.size > maxFileSize) {
        onUploadError?.(`文件大小超过限制`);
        continue;
      }

      await processFile(file);
    }

    setIsUploading(false);
  }, [acceptedTypes, maxFileSize, onUploadComplete, onUploadError]);

  const removeFromQueue = (fileName: string) => {
    setUploadQueue(prev => prev.filter(item => item.fileName !== fileName));
  };

  const clearQueue = () => {
    setUploadQueue([]);
  };

  const getStatusIcon = (status: FileUploadProgress['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      case'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-400" />;
    }
  };

  const getStatusText = (item: FileUploadProgress) => {
    switch (item.status) {
      case 'uploading':
        return `上传中 ${item.progress}%`;
      case 'processing':
        return '处理中...';
      case 'completed':
        return `完成 (${formatTime(item.elapsedTime || 0)})`;
      case 'error':
        return item.error || '上传失败';
      default:
        return '等待中';
    }
  };

  const getProgressColor = (status: FileUploadProgress['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'processing':
        return 'bg-blue-500';
      default:
        return 'bg-primary-500';
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4">
        <div className="flex items-center space-x-3">
          <Upload className="w-8 h-8 text-white" />
          <div>
            <h2 className="text-xl font-bold text-white">合同文件上传</h2>
            <p className="text-sm text-blue-100">支持 PDF、DOCX、TXT 格式</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
            isDragOver
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-blue-400'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={acceptedTypes.join(',')}
            multiple
            onChange={handleFileSelect}
            disabled={isUploading}
            className="hidden"
            id="file-upload"
          />
          
          <label htmlFor="file-upload" className="cursor-pointer">
            <div className="flex flex-col items-center space-y-4">
              {isUploading ? (
                <RefreshCw className="w-16 h-16 text-blue-500 animate-spin" />
              ) : (
                <Upload className="w-16 h-16 text-gray-400" />
              )}
              
              <div>
                <p className="text-lg font-medium text-gray-700">
                  {isUploading ? '正在处理文件...' : '拖放文件到此处或点击上传'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  最大文件大小: {formatFileSize(maxFileSize)}
                </p>
              </div>
            </div>
          </label>
        </div>

        {uploadQueue.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-700">
                上传队列 ({uploadQueue.length})
              </h3>
              <button
                onClick={clearQueue}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                清空队列
              </button>
            </div>

            <div className="space-y-3">
              {uploadQueue.map((item, index) => (
                <div
                  key={index}
                  className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(item.status)}
                      <div>
                        <p className="font-medium text-gray-800">{item.fileName}</p>
                        <p className="text-sm text-gray-500">
                          {formatFileSize(item.fileSize)} • {getStatusText(item)}
                        </p>
                      </div>
                    </div>
                    
                    {item.status === 'completed' || item.status === 'error' ? (
                      <button
                        onClick={() => removeFromQueue(item.fileName)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    ) : null}
                  </div>

                  {item.status !== 'pending' && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${getProgressColor(item.status)}`}
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}

                  {item.status === 'completed' && item.result && (
                    <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">字符数</span>
                        <p className="font-medium">{item.result.charCount.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">行数</span>
                        <p className="font-medium">{item.result.lineCount}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">处理时间</span>
                        <p className="font-medium">{formatTime(item.result.extractionTime)}</p>
                      </div>
                    </div>
                  )}

                  {item.status === 'error' && item.error && (
                    <p className="mt-2 text-sm text-red-600">{item.error}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {showPerformanceStats && stats.totalUploads > 0 && (
          <div className="mt-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-3">
              <Zap className="w-5 h-5 text-yellow-500" />
              <h3 className="font-medium text-gray-700">性能统计</h3>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.totalUploads}</p>
                <p className="text-sm text-gray-500">总上传数</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{stats.successfulUploads}</p>
                <p className="text-sm text-gray-500">成功</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{stats.failedUploads}</p>
                <p className="text-sm text-gray-500">失败</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">
                  {formatTime(stats.averageProcessingTime)}
                </p>
                <p className="text-sm text-gray-500">平均处理时间</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>支持 {acceptedTypes.join(', ')} 格式</span>
          <span>最大 {formatFileSize(maxFileSize)}</span>
        </div>
      </div>
    </div>
  );
};

export default OptimizedFileUploader;

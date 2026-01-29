'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Server, Database, Clock, Zap, AlertTriangle, CheckCircle } from 'lucide-react';

interface PerformanceMetrics {
  timestamp: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
  };
  database: {
    provisionsCount: number;
    uptime: number;
  };
  api: {
    averageResponseTime: number;
    requestsPerSecond: number;
    errorRate: number;
  };
  system: {
    loadTime: number;
    activeConnections: number;
  };
}

interface PerformanceMonitorProps {
  refreshInterval?: number; // 刷新间隔（毫秒）
  showDetails?: boolean;
  onPerformanceAlert?: (metric: string, value: number, threshold: number) => void;
}

const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  refreshInterval = 5000,
  showDetails = true,
  onPerformanceAlert,
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [history, setHistory] = useState<PerformanceMetrics[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [alerts, setAlerts] = useState<{ type: string; message: string; time: Date }[]>([]);

  // 获取性能指标
  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch('/api/performance');
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setMetrics(data.data);
          
          // 更新历史记录
          setHistory(prev => {
            const newHistory = [...prev, data.data];
            return newHistory.slice(-20); // 保留最近20条记录
          });

          // 检查性能告警
          checkPerformanceAlerts(data.data);
        }
      }
    } catch (error) {
      console.error('获取性能指标失败:', error);
    }
  }, []);

  // 检查性能告警
  const checkPerformanceAlerts = (data: PerformanceMetrics) => {
    const newAlerts: { type: string; message: string; time: Date }[] = [];

    // 内存使用率告警
    if (data.memory.percentage > 80) {
      const alert = {
        type: 'memory',
        message: `内存使用率过高: ${data.memory.percentage.toFixed(1)}%`,
        time: new Date(),
      };
      newAlerts.push(alert);
      onPerformanceAlert?.('memory', data.memory.percentage, 80);
    }

    // API 响应时间告警
    if (data.api.averageResponseTime > 5000) {
      const alert = {
        type: 'api',
        message: `API响应时间过长: ${(data.api.averageResponseTime / 1000).toFixed(1)}s`,
        time: new Date(),
      };
      newAlerts.push(alert);
      onPerformanceAlert?.('apiResponseTime', data.api.averageResponseTime, 5000);
    }

    // 错误率告警
    if (data.api.errorRate > 5) {
      const alert = {
        type: 'error',
        message: `API错误率过高: ${data.api.errorRate.toFixed(1)}%`,
        time: new Date(),
      };
      newAlerts.push(alert);
      onPerformanceAlert?.('errorRate', data.api.errorRate, 5);
    }

    if (newAlerts.length > 0) {
      setAlerts(prev => [...newAlerts, ...prev].slice(0, 10));
    }
  };

  // 定期获取指标
  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchMetrics, refreshInterval]);

  // 格式化字节
  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // 格式化时间
  const formatUptime = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  // 获取健康状态颜色
  const getHealthColor = (value: number, thresholds: { warning: number; critical: number }): string => {
    if (value >= thresholds.critical) return 'text-red-600';
    if (value >= thresholds.warning) return 'text-yellow-600';
    return 'text-green-600';
  };

  // 获取健康状态背景色
  const getHealthBgColor = (value: number, thresholds: { warning: number; critical: number }): string => {
    if (value >= thresholds.critical) return 'bg-red-100';
    if (value >= thresholds.warning) return 'bg-yellow-100';
    return 'bg-green-100';
  };

  // 渲染单个指标卡片
  const renderMetricCard = (
    title: string,
    value: string | number,
    icon: React.ReactNode,
    subtext?: string,
    colorClass: string = 'bg-blue-100 text-blue-600'
  ) => (
    <div className={`${colorClass} rounded-lg p-4`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {icon}
          <div>
            <p className="text-sm opacity-75">{title}</p>
            <p className="text-xl font-bold">{value}</p>
            {subtext && <p className="text-xs opacity-75">{subtext}</p>}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      {/* 头部 */}
      <div 
        className="bg-gradient-to-r from-gray-800 to-gray-900 px-6 py-4 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Activity className="w-8 h-8 text-white" />
            <div>
              <h2 className="text-xl font-bold text-white">系统性能监控</h2>
              <p className="text-sm text-gray-300">实时性能指标和健康状态</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {alerts.length > 0 && (
              <div className="flex items-center space-x-1 text-red-400">
                <AlertTriangle className="w-5 h-5" />
                <span className="text-sm">{alerts.length}</span>
              </div>
            )}
            <span className={`text-sm ${isExpanded ? 'transform rotate-180' : ''}`}>
              ▼
            </span>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      {isExpanded && (
        <div className="p-6 space-y-6">
          {/* 实时指标 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {renderMetricCard(
              '内存使用',
              metrics ? `${metrics.memory.percentage.toFixed(1)}%` : '加载中...',
              <Server className="w-6 h-6" />,
              metrics ? formatBytes(metrics.memory.used) : undefined,
              getHealthBgColor(metrics?.memory.percentage || 0, { warning: 70, critical: 85 })
            )}
            
            {renderMetricCard(
              'CPU 使用',
              metrics ? `${metrics.cpu.usage.toFixed(1)}%` : '加载中...',
              <Activity className="w-6 h-6" />,
              undefined,
              getHealthBgColor(metrics?.cpu.usage || 0, { warning: 70, critical: 85 })
            )}
            
            {renderMetricCard(
              '数据库条文',
              metrics?.database.provisionsCount.toLocaleString() || '加载中...',
              <Database className="w-6 h-6" />,
              metrics ? `运行时间: ${formatUptime(metrics.database.uptime)}` : undefined,
              'bg-purple-100 text-purple-600'
            )}
            
            {renderMetricCard(
              '平均响应时间',
              metrics ? `${(metrics.api.averageResponseTime / 1000).toFixed(2)}s` : '加载中...',
              <Clock className="w-6 h-6" />,
              undefined,
              getHealthBgColor(metrics?.api.averageResponseTime || 0, { warning: 3000, critical: 5000 })
            )}
          </div>

          {/* 性能趋势图 */}
          {history.length > 1 && showDetails && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-4">性能趋势</h3>
              <div className="h-32 flex items-end space-x-1">
                {history.map((m, i) => (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center space-y-1"
                  >
                    <div
                      className="w-full bg-blue-400 rounded-t"
                      style={{ height: `${Math.min(m.memory.percentage, 100)}%` }}
                      title={`内存: ${m.memory.percentage.toFixed(1)}%`}
                    />
                    <div
                      className="w-full bg-green-400 rounded-b"
                      style={{ height: `${Math.min(m.cpu.usage, 100)}%` }}
                      title={`CPU: ${m.cpu.usage.toFixed(1)}%`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center space-x-6 mt-2 text-xs text-gray-500">
                <span className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-blue-400 rounded"></div>
                  <span>内存使用</span>
                </span>
                <span className="flex items-center space-x-1">
                  <div className="w-3 h-3 bg-green-400 rounded"></div>
                  <span>CPU 使用</span>
                </span>
              </div>
            </div>
          )}

          {/* API 统计 */}
          {metrics && showDetails && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-4">API 统计</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {metrics.api.requestsPerSecond.toFixed(1)}
                  </p>
                  <p className="text-sm text-gray-500">请求/秒</p>
                </div>
                <div className="text-center">
                  <p className={`text-2xl font-bold ${getHealthColor(metrics.api.errorRate, { warning: 2, critical: 5 })}`}>
                    {metrics.api.errorRate.toFixed(2)}%
                  </p>
                  <p className="text-sm text-gray-500">错误率</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">
                    {metrics.system.activeConnections}
                  </p>
                  <p className="text-sm text-gray-500">活跃连接</p>
                </div>
              </div>
            </div>
          )}

          {/* 告警列表 */}
          {alerts.length > 0 && (
            <div className="bg-red-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-red-800 mb-3 flex items-center">
                <AlertTriangle className="w-4 h-4 mr-2" />
                性能告警 ({alerts.length})
              </h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {alerts.slice(0, 5).map((alert, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <span className="text-red-700">{alert.message}</span>
                    <span className="text-red-500">
                      {alert.time.toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 刷新按钮 */}
          <div className="flex justify-center">
            <button
              onClick={fetchMetrics}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Zap className="w-4 h-4" />
              <span>刷新指标</span>
            </button>
          </div>
        </div>
      )}

      {/* 底部状态 */}
      <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span>系统正常运行</span>
            </span>
          </div>
          <span className="text-gray-500">
            最后更新: {metrics ? new Date(metrics.timestamp).toLocaleTimeString() : '等待中...'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PerformanceMonitor;
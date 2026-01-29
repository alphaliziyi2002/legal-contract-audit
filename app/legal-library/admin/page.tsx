'use client';
import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import { 
  RefreshCw, Database, Search, Cpu, MemoryStick, BarChart3, Clock, 
  AlertTriangle, CheckCircle, Trash2, Edit, PlusCircle, Eye, 
  Shield, LogOut, ArrowLeft, ChevronDown, ChevronUp, X
} from 'lucide-react';

interface SystemStatus {
  data_directory: string;
  total_provisions: number;
  index_size: {
    keyword_index: number;
    clause_index: number;
    provision_map: number;
  };
  last_update: string;
  cache_stats: {
    size: number;
    max_size: number;
    hit_count: number;
    miss_count: number;
    items: any[];
  };
  uptime: number;
  database_initialized: boolean;
}

interface LegalProvision {
  id: string;
  law_name: string;
  issuing_authority: string;
  release_date: string;
  effective_date: string;
  content: string;
  clause_number: string;
  chapter?: string;
  section?: string;
  article?: string;
  paragraph?: string;
  item?: string;
  status: 'active' | 'amended' | 'repealed';
  keywords: string[];
  category: string;
  file_path: string;
  last_updated: string;
}

interface AuditLog {
  id?: number;
  user_id: string;
  action: 'create' | 'update' | 'delete' | 'load_backdoor';
  provision_id?: string;
  timestamp: string;
  details?: string;
}

const LegalLibraryAdminPage: React.FC = () => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [updateType, setUpdateType] = useState<'full' | 'incremental'>('full');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [lastUpdateResult, setLastUpdateResult] = useState<{ success: boolean; message: string } | null>(null);
  
  // 新增状态管理
  const [activeTab, setActiveTab] = useState<'status' | 'provisions' | 'audit' | 'backdoor' | 'upload'>('status');
  const [provisions, setProvisions] = useState<LegalProvision[]>([]);
  const [isLoadingProvisions, setIsLoadingProvisions] = useState<boolean>(false);
  const [selectedProvision, setSelectedProvision] = useState<LegalProvision | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState<boolean>(false);
  const [backdoorContent, setBackdoorContent] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [username] = useState<string>('我'); // 当前授权用户
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  // 获取系统状态
  const fetchSystemStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/legal-reference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'getSystemStatus',
          params: {},
        }),
      });

      const data = await response.json();
      if (data.code === 200) {
        setSystemStatus(data.data);
      } else {
        console.error('Failed to fetch system status:', data.message);
      }
    } catch (error) {
      console.error('Error fetching system status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 获取所有法律条文
  const fetchProvisions = async () => {
    setIsLoadingProvisions(true);
    try {
      // 这里需要实现获取所有法律条文的API调用
      // 暂时使用模拟数据
      const response = await fetch('/api/legal-reference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'search',
          params: {},
        }),
      });

      const data = await response.json();
      if (data.code === 200) {
        // 暂时只显示前20条，实际应该获取所有
        setProvisions(data.data.provisions);
      } else {
        console.error('Failed to fetch provisions:', data.message);
      }
    } catch (error) {
      console.error('Error fetching provisions:', error);
    } finally {
      setIsLoadingProvisions(false);
    }
  };

  // 获取审计日志
  const fetchAuditLogs = async () => {
    setIsLoadingAuditLogs(true);
    try {
      const response = await fetch('/api/legal-reference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'getAuditLogs',
          params: {
            username,
            limit: 100,
            offset: 0,
          },
        }),
      });

      const data = await response.json();
      if (data.code === 200) {
        setAuditLogs(data.data);
      } else {
        console.error('Failed to fetch audit logs:', data.message);
      }
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setIsLoadingAuditLogs(false);
    }
  };

  // 创建法律条文处理函数
  const handleCreateProvision = async (provisionData: Omit<LegalProvision, 'id' | 'last_updated'>) => {
    try {
      const provision: LegalProvision = {
        ...provisionData,
        id: `${provisionData.law_name}_${Date.now()}`,
        last_updated: new Date().toISOString()
      };

      const response = await fetch('/api/legal-reference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'createProvision',
          params: {
            provision,
            username
          },
        }),
      });

      const data = await response.json();
      if (data.code === 200) {
        setLastUpdateResult({ success: true, message: '法律条文创建成功' });
        fetchProvisions();
        setIsCreating(false);
        // 重置创建表单
        setNewProvision({
          law_name: '',
          issuing_authority: '',
          release_date: '',
          effective_date: '',
          content: '',
          clause_number: '',
          status: 'active',
          keywords: [],
          category: '',
          file_path: ''
        });
      } else {
        setLastUpdateResult({ success: false, message: data.message });
      }
    } catch (error) {
      console.error('Error creating provision:', error);
      setLastUpdateResult({ success: false, message: '创建失败，请检查服务器日志' });
    }
  };

  // 新增状态：创建表单数据
  const [newProvision, setNewProvision] = useState<Omit<LegalProvision, 'id' | 'last_updated'>>({
    law_name: '',
    issuing_authority: '',
    release_date: '',
    effective_date: '',
    content: '',
    clause_number: '',
    status: 'active',
    keywords: [],
    category: '',
    file_path: ''
  });

  // 关键词输入状态
  const [keywordInput, setKeywordInput] = useState('');

  // 更新法律文库
  const handleUpdate = async () => {
    setIsUpdating(true);
    setLastUpdateResult(null);
    try {
      const response = await fetch('/api/legal-reference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'update',
          params: { type: updateType },
        }),
      });

      const data = await response.json();
      if (data.code === 200) {
        setLastUpdateResult({ success: true, message: data.message });
        // 更新系统状态
        fetchSystemStatus();
        // 如果当前在条文管理页面，刷新数据
        if (activeTab === 'provisions') {
          fetchProvisions();
        }
      } else {
        setLastUpdateResult({ success: false, message: data.message });
      }
    } catch (error) {
      setLastUpdateResult({ success: false, message: '更新失败，请检查服务器日志' });
      console.error('Error updating legal library:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // 删除法律条文
  const handleDeleteProvision = async (id: string) => {
    try {
      const response = await fetch('/api/legal-reference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'deleteProvision',
          params: {
            id,
            username,
          },
        }),
      });

      const data = await response.json();
      if (data.code === 200) {
        // 刷新数据
        fetchProvisions();
        fetchSystemStatus();
        setShowDeleteConfirm(null);
        setLastUpdateResult({ success: true, message: '法律条文删除成功' });
      } else {
        setLastUpdateResult({ success: false, message: data.message });
      }
    } catch (error) {
      console.error('Error deleting provision:', error);
      setLastUpdateResult({ success: false, message: '删除失败，请检查服务器日志' });
    }
  };

  // 后门加载内容
  const handleBackdoorLoad = async () => {
    try {
      // 解析JSON内容
      const content = JSON.parse(backdoorContent);
      
      const response = await fetch('/api/legal-reference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'loadBackdoor',
          params: {
            content,
            username,
          },
        }),
      });

      const data = await response.json();
      if (data.code === 200) {
        setLastUpdateResult({ success: true, message: data.message });
        // 刷新数据
        fetchSystemStatus();
        if (activeTab === 'provisions') {
          fetchProvisions();
        }
        setBackdoorContent('');
      } else {
        setLastUpdateResult({ success: false, message: data.message });
      }
    } catch (error) {
      console.error('Error loading backdoor content:', error);
      setLastUpdateResult({ success: false, message: '加载失败，请检查JSON格式' });
    }
  };

  // 格式化系统时间
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}天${hours}小时${minutes}分钟`;
  };

  // 格式化日期
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 格式化审计日志操作类型
  const formatAction = (action: string): string => {
    const actionMap: Record<string, string> = {
      'create': '创建',
      'update': '更新',
      'delete': '删除',
      'load_backdoor': '后门加载'
    };
    return actionMap[action] || action;
  };

  // 组件挂载时获取系统状态
  useEffect(() => {
    fetchSystemStatus();
  }, []);

  // 切换标签时获取对应数据
  useEffect(() => {
    if (activeTab === 'provisions') {
      fetchProvisions();
    } else if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab]);

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        selectedTemplate="default"
        onTemplateChange={() => {}}
      />

      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="max-w-7xl mx-auto">
          {/* 返回按钮 */}
          <div className="mb-6">
            <button
              onClick={() => window.history.back()}
              className="flex items-center space-x-1 text-sm px-3 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
            >
              <ArrowLeft size={16} />
              <span>返回</span>
            </button>
          </div>

          {/* 页面标题 */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">法律文库管理</h1>
              <div className="flex items-center space-x-2 bg-yellow-50 px-3 py-1 rounded-full text-sm">
                <Shield size={16} className="text-yellow-600" />
                <span className="text-yellow-800">管理员模式</span>
                <span className="text-yellow-600">{username}</span>
              </div>
            </div>
            <p className="text-gray-600">
              监控和管理本地法律文库系统
            </p>
          </div>

          {/* 操作提示 */}
          {lastUpdateResult && (
            <div className={`p-4 rounded-md mb-6 flex items-center space-x-2 ${lastUpdateResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {lastUpdateResult.success ? (
                <CheckCircle size={20} />
              ) : (
                <AlertTriangle size={20} />
              )}
              <span>{lastUpdateResult.message}</span>
              <button
                onClick={() => setLastUpdateResult(null)}
                className="ml-auto text-gray-500 hover:text-gray-700"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* 标签导航 */}
          <div className="mb-6 border-b border-gray-200">
            <nav className="flex space-x-8">
              {[
                { id: 'status' as const, label: '系统状态', icon: <Cpu size={18} /> },
                { id: 'provisions' as const, label: '法律条文管理', icon: <Database size={18} /> },
                { id: 'audit' as const, label: '审计日志', icon: <BarChart3 size={18} /> },
                { id: 'upload' as const, label: '上传法律条文', icon: <PlusCircle size={18} /> },
                { id: 'backdoor' as const, label: '安全后门', icon: <Shield size={18} /> }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-1 py-3 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === tab.id 
                    ? 'border-primary-600 text-primary-600' 
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* 系统状态标签 */}
          {activeTab === 'status' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              {/* 左侧：系统概览 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-medium text-gray-900 flex items-center">
                    <Cpu className="mr-2 h-5 w-5 text-primary-600" />
                    系统概览
                  </h2>
                  <button
                    onClick={fetchSystemStatus}
                    disabled={isLoading}
                    className="flex items-center space-x-1 text-sm px-3 py-1 rounded-md bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    <span>{isLoading ? '加载中...' : '刷新'}</span>
                  </button>
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="animate-spin">
                      <RefreshCw size={40} className="text-primary-500 opacity-70" />
                    </div>
                  </div>
                ) : systemStatus ? (
                  <div className="space-y-6">
                    {/* 基本信息 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-1">
                          <Database size={16} className="text-gray-500" />
                          <span className="text-sm text-gray-600">数据目录</span>
                        </div>
                        <p className="text-sm font-medium text-gray-900 truncate">{systemStatus.data_directory}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-1">
                          <Search size={16} className="text-gray-500" />
                          <span className="text-sm text-gray-600">法律条文总数</span>
                        </div>
                        <p className="text-2xl font-bold text-primary-600">{systemStatus.total_provisions}</p>
                      </div>
                    </div>

                    {/* 索引信息 */}
                    <div>
                      <div className="flex items-center space-x-2 mb-3">
                        <BarChart3 size={16} className="text-gray-500" />
                        <span className="text-sm text-gray-600">索引大小</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-xs text-gray-500 mb-1">关键词索引</p>
                          <p className="text-lg font-medium text-gray-900">{systemStatus.index_size.keyword_index}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-xs text-gray-500 mb-1">条款索引</p>
                          <p className="text-lg font-medium text-gray-900">{systemStatus.index_size.clause_index}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-xs text-gray-500 mb-1">条文映射</p>
                          <p className="text-lg font-medium text-gray-900">{systemStatus.index_size.provision_map}</p>
                        </div>
                      </div>
                    </div>

                    {/* 缓存信息 */}
                    <div>
                      <div className="flex items-center space-x-2 mb-3">
                        <MemoryStick size={16} className="text-gray-500" />
                        <span className="text-sm text-gray-600">缓存状态</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-xs text-gray-500 mb-1">缓存大小</p>
                          <p className="text-lg font-medium text-gray-900">{systemStatus.cache_stats.size} / {systemStatus.cache_stats.max_size}</p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-xs text-gray-500 mb-1">缓存命中率</p>
                          <p className="text-lg font-medium text-gray-900">
                            {systemStatus.cache_stats.hit_count + systemStatus.cache_stats.miss_count > 0 ?
                              ((systemStatus.cache_stats.hit_count / (systemStatus.cache_stats.hit_count + systemStatus.cache_stats.miss_count)) * 100).toFixed(1) + '%'
                              : '0.0%'
                            }
                          </p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-xs text-gray-500 mb-1">总命中次数</p>
                          <p className="text-lg font-medium text-gray-900">{systemStatus.cache_stats.hit_count}</p>
                        </div>
                      </div>
                    </div>

                    {/* 系统信息 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-1">
                          <Clock size={16} className="text-gray-500" />
                          <span className="text-sm text-gray-600">最后更新时间</span>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{formatDate(systemStatus.last_update)}</p>
                      </div>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-1">
                          <Clock size={16} className="text-gray-500" />
                          <span className="text-sm text-gray-600">系统运行时间</span>
                        </div>
                        <p className="text-sm font-medium text-gray-900">{formatUptime(systemStatus.uptime)}</p>
                      </div>
                    </div>

                    {/* 数据库状态 */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2 mb-1">
                        <Database size={16} className="text-gray-500" />
                        <span className="text-sm text-gray-600">数据库状态</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        {systemStatus.database_initialized ? (
                          <>
                            <CheckCircle size={16} className="text-green-600" />
                            <span className="text-sm font-medium text-green-800">已初始化</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={16} className="text-yellow-600" />
                            <span className="text-sm font-medium text-yellow-800">未初始化</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <AlertTriangle size={40} className="mx-auto mb-3 text-gray-400" />
                      <p className="text-gray-500">无法加载系统状态</p>
                    </div>
                  </div>
                )}
              </div>

              {/* 右侧：数据更新 */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-medium text-gray-900 mb-6 flex items-center">
                  <RefreshCw className="mr-2 h-5 w-5 text-primary-600" />
                  数据更新
                </h2>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="update-type" className="block text-sm font-medium text-gray-700 mb-2">
                      更新类型
                    </label>
                    <div className="flex space-x-4">
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="update-type"
                          value="full"
                          checked={updateType === 'full'}
                          onChange={() => setUpdateType('full')}
                          className="form-radio h-4 w-4 text-primary-600"
                        />
                        <span className="ml-2 text-sm text-gray-700">全量更新</span>
                      </label>
                      <label className="inline-flex items-center">
                        <input
                          type="radio"
                          name="update-type"
                          value="incremental"
                          checked={updateType === 'incremental'}
                          onChange={() => setUpdateType('incremental')}
                          className="form-radio h-4 w-4 text-primary-600"
                        />
                        <span className="ml-2 text-sm text-gray-700">增量更新</span>
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      {updateType === 'full' ? '重新加载所有法律条文文件并重建索引' : '仅加载新增或修改的文件'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      数据目录
                    </label>
                    <div className="bg-gray-50 p-3 rounded-md">
                      <p className="text-sm text-gray-900 truncate">{systemStatus?.data_directory || '加载中...'}</p>
                    </div>
                  </div>

                  <button
                    onClick={handleUpdate}
                    disabled={isUpdating}
                    className={`w-full py-3 px-4 rounded-md font-medium flex items-center justify-center space-x-2 transition-colors ${isUpdating ? 'bg-gray-500 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 text-white'}`}
                  >
                    {isUpdating ? (
                      <>
                        <div className="animate-spin">
                          <RefreshCw size={18} />
                        </div>
                        <span>更新中...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw size={18} />
                        <span>{updateType === 'full' ? '执行全量更新' : '执行增量更新'}</span>
                      </>
                    )}
                  </button>

                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                    <div className="flex">
                      <AlertTriangle className="flex-shrink-0 h-5 w-5 text-yellow-400" />
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-yellow-800">更新提示</h3>
                        <div className="mt-2 text-sm text-yellow-700">
                          <ul className="list-disc pl-5 space-y-1">
                            <li>全量更新可能需要较长时间，取决于数据量大小</li>
                            <li>更新过程中系统可能会短暂不可用</li>
                            <li>建议在系统负载较低时执行更新</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 法律条文管理标签 */}
          {activeTab === 'provisions' && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-medium text-gray-900 flex items-center">
                  <Database className="mr-2 h-5 w-5 text-primary-600" />
                  法律条文管理
                </h2>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setIsCreating(true)}
                    className="flex items-center space-x-1 text-sm px-3 py-1 rounded-md bg-green-100 text-green-700 hover:bg-green-200 transition-colors"
                  >
                    <PlusCircle size={16} />
                    <span>创建</span>
                  </button>
                  <button
                    onClick={fetchProvisions}
                    className="flex items-center space-x-1 text-sm px-3 py-1 rounded-md bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors"
                  >
                    <RefreshCw size={16} />
                    <span>刷新</span>
                  </button>
                </div>
              </div>

              {/* 创建法律条文表单 */}
              {isCreating && (
                <div className="border border-gray-200 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">创建新法律条文</h3>
                    <button
                      onClick={() => setIsCreating(false)}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">法律名称</label>
                      <input
                        type="text"
                        value={newProvision.law_name}
                        onChange={(e) => setNewProvision({...newProvision, law_name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        placeholder="例如：中华人民共和国民法典"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">发布机关</label>
                      <input
                        type="text"
                        value={newProvision.issuing_authority}
                        onChange={(e) => setNewProvision({...newProvision, issuing_authority: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        placeholder="例如：全国人民代表大会常务委员会"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">发布日期</label>
                      <input
                        type="date"
                        value={newProvision.release_date}
                        onChange={(e) => setNewProvision({...newProvision, release_date: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">生效日期</label>
                      <input
                        type="date"
                        value={newProvision.effective_date}
                        onChange={(e) => setNewProvision({...newProvision, effective_date: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">条款编号</label>
                      <input
                        type="text"
                        value={newProvision.clause_number}
                        onChange={(e) => setNewProvision({...newProvision, clause_number: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        placeholder="例如：第1条"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">分类</label>
                      <input
                        type="text"
                        value={newProvision.category}
                        onChange={(e) => setNewProvision({...newProvision, category: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        placeholder="例如：民法"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">状态</label>
                      <select
                        value={newProvision.status}
                        onChange={(e) => setNewProvision({...newProvision, status: e.target.value as 'active' | 'amended' | 'repealed'})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value="active">生效</option>
                        <option value="amended">已修订</option>
                        <option value="repealed">已废止</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">关键词</label>
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={keywordInput}
                          onChange={(e) => setKeywordInput(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && keywordInput.trim()) {
                              setNewProvision({...newProvision, keywords: [...newProvision.keywords, keywordInput.trim()]});
                              setKeywordInput('');
                            }
                          }}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                          placeholder="输入关键词，按Enter添加"
                        />
                        <button
                          onClick={() => {
                            if (keywordInput.trim()) {
                              setNewProvision({...newProvision, keywords: [...newProvision.keywords, keywordInput.trim()]});
                              setKeywordInput('');
                            }
                          }}
                          className="px-3 py-2 bg-primary-100 text-primary-700 rounded-md hover:bg-primary-200 transition-colors"
                        >
                          添加
                        </button>
                      </div>
                      {newProvision.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {newProvision.keywords.map((keyword, index) => (
                            <span key={index} className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                              {keyword}
                              <button
                                onClick={() => setNewProvision({...newProvision, keywords: newProvision.keywords.filter((_, i) => i !== index)})}
                                className="ml-1 text-gray-500 hover:text-gray-700"
                              >
                                <X size={14} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">条文内容</label>
                      <textarea
                        value={newProvision.content}
                        onChange={(e) => setNewProvision({...newProvision, content: e.target.value})}
                        rows={5}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        placeholder="输入法律条文内容"
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 mt-4">
                    <button
                      onClick={() => handleCreateProvision(newProvision)}
                      className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 transition-colors"
                    >
                      创建
                    </button>
                    <button
                      onClick={() => setIsCreating(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                    >
                      取消
                    </button>
                  </div>
                </div>
              )}

              {/* 法律条文列表 */}
              <div className="space-y-4">
                {isLoadingProvisions ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="animate-spin">
                      <RefreshCw size={40} className="text-primary-500 opacity-70" />
                    </div>
                  </div>
                ) : provisions.length === 0 ? (
                  <div className="text-center py-12">
                    <Database size={48} className="mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500">暂无法律条文</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {provisions.map((provision) => (
                      <div key={provision.id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="p-4 bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="font-medium text-gray-900">{provision.law_name}</h3>
                              <div className="flex items-center space-x-2 text-sm text-gray-500 mt-1">
                                <span>{provision.clause_number}</span>
                                <span>•</span>
                                <span>{provision.category}</span>
                                <span>•</span>
                                <span>{formatDate(provision.last_updated)}</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-1">
                              <button
                                onClick={() => setSelectedProvision(provision)}
                                className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded"
                                title="查看详情"
                              >
                                <Eye size={18} />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedProvision(provision);
                                  setIsEditing(true);
                                }}
                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded"
                                title="编辑"
                              >
                                <Edit size={18} />
                              </button>
                              <button
                                onClick={() => setShowDeleteConfirm(provision.id)}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                                title="删除"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
                        
                        {/* 删除确认对话框 */}
                        {showDeleteConfirm === provision.id && (
                          <div className="bg-red-50 border-t border-red-200 p-4">
                            <div className="flex items-start space-x-3">
                              <AlertTriangle size={20} className="text-red-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <h4 className="text-sm font-medium text-red-800">确认删除</h4>
                                <p className="text-sm text-red-700 mt-1">
                                  确定要删除法律条文 <span className="font-medium">{provision.law_name} {provision.clause_number}</span> 吗？
                                  此操作无法撤销。
                                </p>
                                <div className="flex items-center space-x-2 mt-3">
                                  <button
                                    onClick={() => handleDeleteProvision(provision.id)}
                                    className="text-xs px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                                  >
                                    确认删除
                                  </button>
                                  <button
                                    onClick={() => setShowDeleteConfirm(null)}
                                    className="text-xs px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                                  >
                                    取消
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 分页控制 */}
              {provisions.length > 0 && (
                <div className="mt-6 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    显示 {provisions.length} 条，共 {systemStatus?.total_provisions} 条
                  </p>
                  <div className="flex items-center space-x-2">
                    <button
                      disabled
                      className="px-3 py-1 text-sm rounded border border-gray-300 bg-gray-100 text-gray-500 cursor-not-allowed"
                    >
                      上一页
                    </button>
                    <button
                      disabled
                      className="px-3 py-1 text-sm rounded border border-gray-300 bg-gray-100 text-gray-500 cursor-not-allowed"
                    >
                      下一页
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 审计日志标签 */}
          {activeTab === 'audit' && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-medium text-gray-900 flex items-center">
                  <BarChart3 className="mr-2 h-5 w-5 text-primary-600" />
                  审计日志
                </h2>
                <button
                  onClick={fetchAuditLogs}
                  className="flex items-center space-x-1 text-sm px-3 py-1 rounded-md bg-primary-100 text-primary-700 hover:bg-primary-200 transition-colors"
                >
                  <RefreshCw size={16} />
                  <span>刷新</span>
                </button>
              </div>

              {/* 审计日志列表 */}
              <div className="space-y-4">
                {isLoadingAuditLogs ? (
                  <div className="flex items-center justify-center h-40">
                    <div className="animate-spin">
                      <RefreshCw size={40} className="text-primary-500 opacity-70" />
                    </div>
                  </div>
                ) : auditLogs.length === 0 ? (
                  <div className="text-center py-12">
                    <BarChart3 size={48} className="mx-auto mb-4 text-gray-400" />
                    <p className="text-gray-500">暂无审计日志</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            时间
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            用户
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            操作
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            法律条文
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            详情
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {auditLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {formatDate(log.timestamp)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {log.user_id}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${log.action === 'delete' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                {formatAction(log.action)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {log.provision_id}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500">
                              {log.details || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 安全后门标签 */}
          {activeTab === 'backdoor' && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-xl font-medium text-gray-900 mb-6 flex items-center">
                <Shield className="mr-2 h-5 w-5 text-primary-600" />
                安全后门
              </h2>

              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <div className="flex">
                    <AlertTriangle className="flex-shrink-0 h-5 w-5 text-yellow-400" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-yellow-800">安全警告</h3>
                      <div className="mt-2 text-sm text-yellow-700">
                        <p>
                          此功能仅允许授权管理员使用。后门加载将直接向数据库中添加法律条文，
                          请确保提供的JSON格式正确。
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 安全后门详细说明 */}
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <div className="flex">
                    <Shield className="flex-shrink-0 h-5 w-5 text-blue-400" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-blue-800">功能说明</h3>
                      <div className="mt-2 text-sm text-blue-700 space-y-2">
                        <h4 className="font-medium">设计目的</h4>
                        <p>安全后门功能允许授权管理员通过JSON格式直接向法律条文库中添加或更新法律条文，无需通过常规的文件上传流程。此功能设计用于紧急情况下快速更新法律条文，或批量导入已整理好的法律数据。</p>
                        
                        <h4 className="font-medium">使用场景</h4>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>紧急更新：当需要立即添加或修改重要法律条文时</li>
                          <li>批量导入：从其他系统导出的法律数据需要导入到本系统时</li>
                          <li>测试验证：开发或测试阶段需要快速创建测试数据时</li>
                          <li>数据恢复：系统数据丢失时，可通过备份的JSON数据快速恢复</li>
                        </ul>
                        
                        <h4 className="font-medium">操作方法</h4>
                        <ol className="list-decimal pl-5 space-y-1">
                          <li>在下方文本框中输入符合格式要求的JSON数据</li>
                          <li>JSON数据应为法律条文对象的数组，每个对象包含完整的法律条文字段</li>
                          <li>点击"加载内容"按钮，系统将验证并导入JSON数据</li>
                          <li>导入成功后，系统会显示成功消息，并自动更新法律条文库</li>
                        </ol>
                        
                        <h4 className="font-medium">JSON格式要求</h4>
                        <p>每个法律条文对象应包含以下字段：</p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li><code>id</code>：唯一标识符（建议格式：法律名称_日期）</li>
                          <li><code>law_name</code>：法律名称</li>
                          <li><code>issuing_authority</code>：发布机关</li>
                          <li><code>release_date</code>：发布日期（YYYY-MM-DD格式）</li>
                          <li><code>effective_date</code>：生效日期（YYYY-MM-DD格式）</li>
                          <li><code>content</code>：条文内容</li>
                          <li><code>clause_number</code>：条款编号</li>
                          <li><code>status</code>：状态（active/amended/repealed）</li>
                          <li><code>keywords</code>：关键词数组</li>
                          <li><code>category</code>：分类</li>
                          <li><code>file_path</code>：文件路径（可选）</li>
                          <li><code>last_updated</code>：最后更新时间（ISO格式）</li>
                        </ul>
                        
                        <h4 className="font-medium">安全注意事项</h4>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>仅授权管理员（用户名："我"）可以使用此功能</li>
                          <li>请确保JSON数据来源可靠，避免导入恶意或错误数据</li>
                          <li>导入前请仔细检查JSON格式，确保所有必填字段完整且格式正确</li>
                          <li>系统会记录所有后门操作的审计日志，便于追溯</li>
                          <li>建议在使用此功能前备份数据库，以防数据损坏</li>
                          <li>不要在生产环境中频繁使用此功能，应优先使用常规的文件上传流程</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    JSON内容
                  </label>
                  <textarea
                    value={backdoorContent}
                    onChange={(e) => setBackdoorContent(e.target.value)}
                    placeholder='[
  {
    "id": "example_20240101",
    "law_name": "示例法律",
    "issuing_authority": "示例机关",
    "release_date": "2024-01-01",
    "effective_date": "2024-01-01",
    "content": "示例内容",
    "clause_number": "第1条",
    "status": "active",
    "keywords": ["示例"],
    "category": "其他",
    "file_path": "",
    "last_updated": "2024-01-01T00:00:00.000Z"
  }
]'
                    className="w-full h-60 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleBackdoorLoad}
                    className="flex items-center space-x-1 px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    <PlusCircle size={18} />
                    <span>加载内容</span>
                  </button>
                  <button
                    onClick={() => setBackdoorContent('')}
                    className="flex items-center space-x-1 px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                  >
                    <X size={18} />
                    <span>清空</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 文件上传标签 */}
          {activeTab === 'upload' && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-8">
              <h2 className="text-xl font-medium text-gray-900 mb-6 flex items-center">
                <PlusCircle className="mr-2 h-5 w-5 text-primary-600" />
                上传法律条文
              </h2>

              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <div className="flex">
                    <Database className="flex-shrink-0 h-5 w-5 text-blue-400" />
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-blue-800">上传说明</h3>
                      <div className="mt-2 text-sm text-blue-700">
                        <ul className="list-disc pl-5 space-y-1">
                          <li>支持上传 DOCX、PDF 和 TXT 格式的法律条文文件</li>
                          <li>文件名格式：法律名称_YYYYMMDD.扩展名（如：中华人民共和国民法典_20210101.docx）</li>
                          <li>文件将被保存在本地并自动解析到法律条文库中</li>
                          <li>上传后系统将自动更新法律条文库</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    选择文件
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="file"
                      accept=".docx,.pdf,.txt"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        setSelectedFile(file);
                      }}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary-100 file:text-primary-700 hover:file:bg-primary-200"
                    />
                    {selectedFile && (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-700">{selectedFile.name}</span>
                        <button
                          onClick={() => setSelectedFile(null)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <button
                  onClick={async () => {
                    if (!selectedFile) {
                      setLastUpdateResult({ success: false, message: '请选择要上传的文件' });
                      return;
                    }

                    setIsUploading(true);
                    setLastUpdateResult(null);

                    try {
                      // 读取文件内容为Base64（使用Promise包装FileReader）
                      const base64Content = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                          const result = e.target?.result as string;
                          resolve(result);
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(selectedFile);
                      });
                      
                      const fileContent = base64Content.split(',')[1]; // 移除文件类型前缀

                      // 发送请求到API
                      const response = await fetch('/api/upload-legal-provision', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          username,
                          fileContent,
                          fileName: selectedFile.name,
                        }),
                      });

                      const data = await response.json();
                      if (data.code === 200) {
                        setLastUpdateResult({ success: true, message: data.message });
                        // 刷新系统状态
                        fetchSystemStatus();
                        // 无论当前在哪个标签页，都刷新条文列表
                        fetchProvisions();
                        setSelectedFile(null);
                      } else {
                        setLastUpdateResult({ success: false, message: data.message });
                      }
                    } catch (error) {
                      console.error('Error uploading file:', error);
                      setLastUpdateResult({ success: false, message: '文件上传失败，请检查服务器日志' });
                    } finally {
                      setIsUploading(false);
                    }
                  }}
                    disabled={!selectedFile || isUploading}
                    className={`w-full py-3 px-4 rounded-md font-medium flex items-center justify-center space-x-2 transition-colors ${isUploading ? 'bg-gray-500 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700 text-white'}`}
                  >
                    {isUploading ? (
                      <>
                        <div className="animate-spin">
                          <RefreshCw size={18} />
                        </div>
                        <span>上传中...</span>
                      </>
                    ) : (
                      <>
                        <PlusCircle size={18} />
                        <span>上传文件</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default LegalLibraryAdminPage;
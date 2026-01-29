'use client';
import React, { useState } from 'react';
import Header from '@/components/Header';
import { FileText, Upload, ChevronDown, ChevronUp, Shield, AlertTriangle } from 'lucide-react';

interface RiskItem {
  original_text: string;
  risk_level: 'high' | 'medium' | 'low';
  issue: string;
  suggestion: string;
}

interface ValidationSource {
  id: string;
  type: 'local' | 'online';
  content: string;
  relevance: number;
}

interface ValidationIssue {
  type: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
}

interface ConfidenceScore {
  score: number;
  level: 'high' | 'medium' | 'low';
  explanation: string;
}

interface ValidationResult {
  confidence: ConfidenceScore;
  sources: ValidationSource[];
  issues: ValidationIssue[];
  needs_review: boolean;
}

interface TraceabilityInfo {
  ai_model: string;
  legal_references: string[];
  generated_at: string;
  request_id: string;
}

interface ContractAnalysisResult {
  score: number;
  summary: string;
  risks: RiskItem[];
  validation?: ValidationResult;
  traceability?: TraceabilityInfo;
}

const Page: React.FC = () => {
  const [selectedTemplate, setSelectedTemplate] = useState<string>('default');
  const [contractText, setContractText] = useState<string>('');
  const [analysisResult, setAnalysisResult] = useState<ContractAnalysisResult>({
    score: 0,
    summary: '',
    risks: [],
  });
  const [highlightedClause, setHighlightedClause] = useState<number | null>(null);
  const [temporaryHighlight, setTemporaryHighlight] = useState<number | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  
  // 展开状态管理
  const [expandedRisks, setExpandedRisks] = useState<Record<number, boolean>>({});
  const [expandedSources, setExpandedSources] = useState<boolean>(false);
  
  // 操作反馈状态管理
  const [apiStatus, setApiStatus] = useState<'unknown' | 'online' | 'offline' | 'rate-limited'>('unknown');
  const [auditProgress, setAuditProgress] = useState<number>(0);
  const [auditStatus, setAuditStatus] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('connected');

  // 日志控制配置
  const LOG_LEVEL = 'info'; // 'debug' | 'info' | 'warn' | 'error'
  
  const log = (level: string, ...args: any[]) => {
    if (['debug', 'info', 'warn', 'error'].indexOf(level) >= ['debug', 'info', 'warn', 'error'].indexOf(LOG_LEVEL)) {
      (console as any)[level](...args);
    }
  };

  const processFile = async (file: File) => {
    log('info', '开始处理文件:', file.name);
    
    // 重置状态
    setIsLoading(true);
    setError('');
    setAuditProgress(0);
    setAuditStatus('开始处理文件...');
    setConnectionStatus('connected');
    
    // 清空之前的分析结果，确保状态同步
    setAnalysisResult({
      score: 0,
      summary: '',
      risks: [],
    });

    try {
      // 上传文件并提取文本
      setAuditStatus('正在上传文件...');
      setAuditProgress(10);
      
      const uploadResponse = await fetch('/api/upload', { 
        method: 'POST',
        body: file,
        headers: {
          'Content-Type': file.type,
        },
      });

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json();
        throw new Error(errorData.message || '文件上传失败');
      }

      setAuditStatus('正在提取文本...');
      setAuditProgress(30);
      
      const uploadData = await uploadResponse.json();
      const extractedText = uploadData.text;
      
      // 更新合同原文状态
      setContractText(extractedText);

      // 调用AI分析
      setAuditStatus('正在连接AI服务...');
      setAuditProgress(50);
      
      const analyzeResponse = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contractText: extractedText,
          template: selectedTemplate,
        }),
      });

      if (!analyzeResponse.ok) {
        const errorData = await analyzeResponse.json();
        throw new Error(errorData.message || 'AI分析失败');
      }

      setAuditStatus('正在分析合同...');
      setAuditProgress(70);
      
      const analyzeData = await analyzeResponse.json();
      
      // 更新API状态
      setApiStatus(analyzeData.traceability?.ai_status || 'unknown');
      
      setAuditStatus('正在生成报告...');
      setAuditProgress(90);
      
      // 更新分析结果状态
      setAnalysisResult({
        score: analyzeData.score || 0,
        summary: analyzeData.summary || '',
        risks: analyzeData.risks || [],
        validation: analyzeData.validation || {},
        traceability: analyzeData.traceability || {}
      });
      
      setAuditStatus('分析完成');
      setAuditProgress(100);
    } catch (err) {
      const errorMessage = (err as Error).message;
      log('error', '文件处理错误:', errorMessage);
      setError(errorMessage);
      setAuditStatus('分析失败');
      setApiStatus('offline');
      setConnectionStatus('disconnected');
    } finally {
      setIsLoading(false);
      // 3秒后清除审核状态
      setTimeout(() => {
        setAuditStatus('');
        setAuditProgress(0);
      }, 3000);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  };

  const handleClauseClick = (index: number) => {
    setHighlightedClause(index === highlightedClause ? null : index);
    setTemporaryHighlight(null);
  };

  const handleRiskCardClick = (risk: RiskItem) => {
    log('info', '开始匹配风险原文:', risk.original_text.substring(0, 50) + '...');
    
    if (!contractText || !risk.original_text) {
      log('warn', '合同文本或风险原文为空');
      alert('合同文本或风险原文为空，无法进行匹配');
      return;
    }
    
    const paragraphs = contractText.split('\n').filter(p => p.trim().length > 0);
    
    if (paragraphs.length === 0) {
      log('warn', '合同文本无有效段落');
      alert('合同文本无有效段落，无法进行匹配');
      return;
    }
    
    let matchedIndex = -1;
    let bestMatchScore = 0;
    let bestMatchParagraphIndex = -1;
    
    // 1. 精确匹配
    matchedIndex = paragraphs.findIndex(paragraph => 
      paragraph.includes(risk.original_text)
    );
    
    // 2. 如果精确匹配失败，尝试模糊匹配
    if (matchedIndex === -1) {
      log('info', '精确匹配失败，尝试模糊匹配');
      
      // 移除空白字符和标点符号进行比较
      const cleanRiskText = risk.original_text.replace(/[\s\p{Punctuation}]/gu, '').toLowerCase();
      
      if (cleanRiskText.length === 0) {
        log('warn', '风险原文清理后为空');
        alert('风险原文内容过少，无法进行匹配');
        return;
      }
      
      // 遍历所有段落，计算匹配分数
      paragraphs.forEach((paragraph, index) => {
        const cleanParagraph = paragraph.replace(/[\s\p{Punctuation}]/gu, '').toLowerCase();
        
        // 方法1: 检查是否包含完整风险文本
        if (cleanParagraph.includes(cleanRiskText)) {
          matchedIndex = index;
          return;
        }
        
        // 方法2: 检查是否包含大部分风险文本
        const partialMatchLength = Math.floor(cleanRiskText.length * 0.8);
        if (partialMatchLength > 5 && cleanParagraph.includes(cleanRiskText.substring(0, partialMatchLength))) {
          matchedIndex = index;
          return;
        }
        
        // 方法3: 计算相似度分数
        const matchScore = calculateSimilarity(cleanParagraph, cleanRiskText);
        if (matchScore > bestMatchScore) {
          bestMatchScore = matchScore;
          bestMatchParagraphIndex = index;
        }
      });
      
      // 如果找到相似度较高的段落
      if (matchedIndex === -1 && bestMatchScore > 0.6) {
        log('info', '使用相似度匹配，分数:', bestMatchScore);
        matchedIndex = bestMatchParagraphIndex;
      }
      
      // 方法4: 尝试关键词匹配
      if (matchedIndex === -1) {
        log('info', '相似度匹配失败，尝试关键词匹配');
        const keywords = risk.original_text.split(/\s+/).filter(word => word.length > 2).slice(0, 3);
        
        if (keywords.length > 0) {
          matchedIndex = paragraphs.findIndex(paragraph => 
            keywords.some(keyword => paragraph.toLowerCase().includes(keyword.toLowerCase()))
          );
        }
      }
    }

    if (matchedIndex !== -1) {
      log('info', '匹配成功，段落索引:', matchedIndex);
      // 自动滚动到匹配的段落
      const element = document.getElementById(`clause-${matchedIndex}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      // 添加临时高亮
      setTemporaryHighlight(matchedIndex);
      
      // 3秒后移除高亮
      setTimeout(() => {
        setTemporaryHighlight(null);
      }, 3000);
    } else {
      log('warn', '匹配失败，未找到对应段落');
      // 匹配失败时的提示
      alert('未找到对应原文段落，请手动查找\n\n提示：尝试查看合同原文的相关章节');
    }
  };

  // 计算文本相似度
  const calculateSimilarity = (text1: string, text2: string): number => {
    if (!text1 || !text2) return 0;
    
    const longer = text1.length > text2.length ? text1 : text2;
    const shorter = text1.length > text2.length ? text2 : text1;
    
    if (longer.length === 0) return 1.0;
    
    let matchCount = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) {
        matchCount++;
      }
    }
    
    return matchCount / longer.length;
  };

  // 切换风险卡片展开状态
  const toggleRiskExpand = (index: number, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止事件冒泡，避免触发handleRiskCardClick
    setExpandedRisks(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // 切换验证来源展开状态
  const toggleSourcesExpand = () => {
    setExpandedSources(prev => !prev);
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        selectedTemplate={selectedTemplate}
        onTemplateChange={setSelectedTemplate}
      />

      <main className="flex-1 container mx-auto px-4 py-6">
        {/* 操作反馈区域 */}
        <div className="mb-6 space-y-3">
          {/* 错误提示 */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md flex items-center space-x-2">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
          )}
          
          {/* 文件处理进度 */}
          {auditStatus && (
            <div className="bg-white border border-gray-200 rounded-md p-4 shadow-sm">
              <div className="flex items-center mb-2">
                <div className={`w-3 h-3 rounded-full ${auditStatus.includes('失败') ? 'bg-red-500 animate-pulse' : auditStatus.includes('完成') ? 'bg-green-500' : 'bg-blue-500 animate-pulse'}`}></div>
                <span className="text-sm font-medium text-gray-900 ml-2">{auditStatus}</span>
              </div>
              {/* 进度条 */}
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div 
                  className="bg-primary-600 h-2.5 rounded-full transition-all duration-300 ease-out" 
                  style={{ width: `${auditProgress}%` }}
                ></div>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-gray-500">处理进度</span>
                <span className="text-xs font-medium text-gray-700">{auditProgress}%</span>
              </div>
            </div>
          )}
        </div>

        {/* 文件上传区域 */}
        <div className="mb-6 bg-white rounded-lg shadow-md p-6">
          <div
            className={`border-2 border-dashed ${isLoading ? 'border-gray-300 cursor-not-allowed' : 'border-gray-300 hover:border-primary-500 cursor-pointer'} rounded-lg p-8 text-center transition-colors`}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".pdf,.txt,.docx"
              className="hidden"
              id="file-upload"
              onChange={handleFileUpload}
              disabled={isLoading}
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="flex flex-col items-center justify-center space-y-3">
                {isLoading ? (
                  <div className="animate-spin">
                    <svg className="h-12 w-12 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                ) : (
                  <Upload className="h-12 w-12 text-gray-400" />
                )}
                <div>
                  <p className="text-lg font-medium text-gray-900">
                    {isLoading ? '正在处理文件...' : '拖放文件到此处或点击上传'}
                  </p>
                  <p className="text-sm text-gray-500">支持 PDF、DOCX 和 TXT 格式文件</p>
                </div>
                <button
                  type="button"
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${isLoading ? 'bg-gray-500 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'} focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500`}
                  disabled={isLoading}
                  onClick={(e) => {
                    e.preventDefault();
                    const fileInput = document.getElementById('file-upload') as HTMLInputElement;
                    if (fileInput && !isLoading) {
                      fileInput.click();
                    }
                  }}
                >
                  {isLoading ? '处理中...' : '选择文件'}
                </button>
              </div>
            </label>
          </div>
        </div>

        {/* 双栏视图 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 左侧：合同原文 */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-primary-600 text-white px-4 py-3 flex items-center justify-between">
              <h2 className="text-lg font-medium">合同原文</h2>
              <div className="text-sm opacity-90">
                {contractText ? `${contractText.split('\n').length} 段` : '等待上传'}
              </div>
            </div>
            <div className="p-4 h-[600px] overflow-y-auto border-t border-gray-200">
              {contractText ? (
                <div className="space-y-4">
                  {contractText.split('\n').map((paragraph, index) => (
                    <div
                      key={index}
                      id={`clause-${index}`}
                      className={`p-4 border rounded-md cursor-pointer transition-all duration-300 ${highlightedClause === index ? 'bg-primary-50 border-primary-300' : temporaryHighlight === index ? 'bg-yellow-100 border-yellow-300 shadow-sm' : 'hover:bg-gray-50'}`}
                      onClick={() => handleClauseClick(index)}
                    >
                      <div className="flex items-start space-x-3">
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-gray-200 text-xs font-medium text-gray-800 flex-shrink-0">
                          {index + 1}
                        </span>
                        <p className="text-gray-900 leading-relaxed">{paragraph}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>上传合同文件后，此处将显示合同原文</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 右侧：AI 审计结果 */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="bg-primary-600 text-white px-4 py-3 flex items-center justify-between">
              <h2 className="text-lg font-medium">AI 审计结果</h2>
              <div className="text-sm opacity-90">
                {analysisResult.risks.length} 个风险点
              </div>
            </div>
            <div className="p-4 h-[600px] overflow-y-auto border-t border-gray-200">
              {analysisResult.risks.length > 0 ? (
                <div className="space-y-6">
                  {/* 合同评分和总结 */}
                  <div className="bg-gradient-to-r from-primary-50 to-blue-50 p-4 rounded-lg border border-primary-200">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
                      <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-1">合同安全评分</h3>
                        <div className="flex items-center space-x-2">
                          <span className="text-3xl font-bold text-primary-600">{analysisResult.score}</span>
                          <span className="text-sm text-gray-500">/ 100</span>
                        </div>
                      </div>
                      <div className="flex-1 md:ml-6">
                        <h3 className="text-sm font-medium text-gray-700 mb-1">风险总结</h3>
                        <p className="text-sm text-gray-800 leading-relaxed">{analysisResult.summary}</p>
                      </div>
                    </div>
                  </div>

                  {/* 验证信息 */}
                  {analysisResult.validation && (
                    <div className="bg-white p-4 rounded-lg border border-primary-200 shadow-sm">
                      <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                        <Shield className="w-4 h-4 mr-2 text-primary-600" />
                        AI 输出验证
                      </h3>
                      
                      <div className="space-y-3">
                        {/* 置信度评分 */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-500">置信度</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <span 
                                className={`inline-flex items-center justify-center px-3 py-1 rounded-full text-sm font-medium ${analysisResult.validation.confidence.level === 'high' ? 'bg-green-100 text-green-800' : analysisResult.validation.confidence.level === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}
                              >
                                {analysisResult.validation.confidence.level === 'high' ? '高置信度' : analysisResult.validation.confidence.level === 'medium' ? '中等置信度' : '低置信度'}
                              </span>
                              <span className="text-sm font-medium text-gray-700">{analysisResult.validation.confidence.score}%</span>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">{analysisResult.validation.confidence.explanation}</p>
                          </div>
                          
                          {/* 人工审核提示 */}
                          {analysisResult.validation.needs_review && (
                            <div className="flex items-center space-x-1 text-yellow-800 bg-yellow-50 px-3 py-1 rounded-full text-xs font-medium">
                              <AlertTriangle className="w-3 h-3" />
                              <span>需要人工审核</span>
                            </div>
                          )}
                        </div>
                        
                        {/* 支持来源 */}
                        {analysisResult.validation.sources.length > 0 && (
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs text-gray-500">支持来源 ({analysisResult.validation.sources.length})</p>
                              {analysisResult.validation.sources.length > 3 && (
                                <button
                                  onClick={toggleSourcesExpand}
                                  className="text-xs text-primary-600 hover:text-primary-800 flex items-center space-x-1"
                                >
                                  {expandedSources ? (
                                    <>
                                      <span>收起</span>
                                      <ChevronUp className="w-3 h-3" />
                                    </>
                                  ) : (
                                    <>
                                      <span>展开全部</span>
                                      <ChevronDown className="w-3 h-3" />
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                            <div className="space-y-2 max-h-64 overflow-y-auto">
                              {analysisResult.validation.sources.slice(0, expandedSources ? analysisResult.validation.sources.length : 3).map((source, index) => (
                                <div key={index} className="p-2 bg-gray-50 rounded border border-gray-200 text-xs">
                                  <div className="flex items-start justify-between">
                                    <p className={`text-gray-800 ${expandedSources ? '' : 'line-clamp-2'}`}>{source.content}</p>
                                    <span className={`text-xs px-1.5 py-0.5 rounded ml-2 ${source.relevance >= 80 ? 'bg-green-100 text-green-800' : source.relevance >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                      {source.relevance}%
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* 验证问题 */}
                        {analysisResult.validation.issues.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-500 mb-2">验证问题</p>
                            <div className="space-y-1">
                              {analysisResult.validation.issues.map((issue, index) => (
                                <div key={index} className="flex items-center space-x-2 text-xs">
                                  <span 
                                    className={`inline-flex items-center justify-center w-2 h-2 rounded-full ${issue.severity === 'high' ? 'bg-red-500' : issue.severity === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`}
                                  ></span>
                                  <span className="text-gray-700">{issue.message}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 风险点列表 */}
                  <div className="space-y-4">
                    {analysisResult.risks.map((risk, index) => {
                      const isExpanded = expandedRisks[index] || false;
                      return (
                        <div
                          key={index}
                          className={`p-4 rounded-md border-l-4 cursor-pointer hover:shadow-sm transition-all duration-300 ${risk.risk_level === 'high' ? 'border-risk-high bg-red-50 hover:bg-red-100' : risk.risk_level === 'medium' ? 'border-risk-medium bg-yellow-50 hover:bg-yellow-100' : 'border-risk-low bg-green-50 hover:bg-green-100'}`}
                          onClick={() => handleRiskCardClick(risk)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-xs font-medium ${risk.risk_level === 'high' ? 'bg-red-100 text-red-800' : risk.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'}`}
                              >
                                {risk.risk_level === 'high' ? '高风险' : risk.risk_level === 'medium' ? '中风险' : '低风险'}
                              </span>
                            </div>
                            <button
                              onClick={(e) => toggleRiskExpand(index, e)}
                              className="text-gray-500 hover:text-gray-700 transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          <div className="mt-3">
                            <h3 className="font-medium text-gray-900 mb-1">问题：{risk.issue}</h3>
                            <p className={`text-sm text-gray-700 mb-3 ${isExpanded ? '' : 'line-clamp-2'}`}>{risk.suggestion}</p>
                            <div className="mt-3 p-3 bg-white rounded-md border border-gray-200">
                              <p className="text-xs text-gray-600 mb-1">相关原文：</p>
                              <p className={`text-sm text-gray-800 italic ${isExpanded ? '' : 'line-clamp-2'}`}>{risk.original_text}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <Shield className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>上传合同文件后，AI 将自动审计并显示风险点</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Page;
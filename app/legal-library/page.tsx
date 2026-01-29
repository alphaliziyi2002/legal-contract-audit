'use client';
import React, { useState } from 'react';
import Header from '@/components/Header';
import TextExpandable from '@/components/TextExpandable';
import { Search, Book, Scale, Briefcase, FileText, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface LegalDocument {
  id: string;
  law_name: string;
  issuing_authority: string;
  release_date: string;
  effective_date: string;
  content: string;
  clause_number: string;
  status: 'active' | 'amended' | 'repealed';
  keywords: string[];
  category: string;
  file_path: string;
  last_updated: string;
}

const LegalLibraryPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [results, setResults] = useState<LegalDocument[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [selectedDocument, setSelectedDocument] = useState<LegalDocument | null>(null);

  const categories = [
    { value: '', label: '全部分类' },
    { value: '民法', label: '民法' },
    { value: '刑法', label: '刑法' },
    { value: '合同法', label: '合同法' },
    { value: '劳动法', label: '劳动法' },
    { value: '公司法', label: '公司法' },
    { value: '知识产权法', label: '知识产权法' },
    { value: '行政法', label: '行政法' },
    { value: '行政法规', label: '行政法规' },
    { value: '司法解释', label: '司法解释' },
    { value: '决定', label: '决定' },
    { value: '其他', label: '其他' },
  ];

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    try {
      const response = await fetch('/api/legal-reference', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'search',
          params: {
            keywords: searchQuery.split(/\s+/),
            category: selectedCategory || undefined,
          },
        }),
      });

      const data = await response.json();
      
      // 处理不同的响应状态
      if (data.code === 200) {
        // 搜索成功，有结果
        setResults(data.data.provisions);
        setSelectedDocument(null);
      } else if (data.code === 404) {
        // 搜索结果为空
        setResults([]);
        setSelectedDocument(null);
      } else {
        // 其他错误
        console.error('Search failed with code:', data.code, 'message:', data.message);
        setResults([]);
        setSelectedDocument(null);
      }
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
      setSelectedDocument(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleDocumentClick = (doc: LegalDocument) => {
    setSelectedDocument(doc);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const getCategoryLabel = (category: string) => {
    const categoryInfo = categories.find(c => c.value === category);
    return categoryInfo?.label || category;
  };

  // 高亮关键词函数
  const highlightKeywords = (text: string, keywords: string[]): React.ReactNode => {
    if (!keywords || keywords.length === 0) {
      return text;
    }

    const regex = new RegExp(`(${keywords.map(keyword => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (regex.test(part)) {
        return (
          <span key={index} className="bg-yellow-200 font-medium">
            {part}
          </span>
        );
      }
      return part;
    });
  };

  // 生成文档摘要，只显示与关键词相关的片段
  const generateSummary = (content: string, keywords: string[]): string => {
    if (!keywords || keywords.length === 0) {
      return content.slice(0, 200) + (content.length > 200 ? '...' : '');
    }

    const sentences = content.split(/[。！？；；]/);
    const regex = new RegExp(keywords.map(keyword => keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi');
    const relevantSentences = sentences.filter(sentence => regex.test(sentence));

    if (relevantSentences.length === 0) {
      return content.slice(0, 200) + (content.length > 200 ? '...' : '');
    }

    // 取前3个相关句子
    const summary = relevantSentences.slice(0, 3).join('。') + '。';
    return summary;
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        selectedTemplate="default"
        onTemplateChange={() => {}}
      />

      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8 flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">法律文库系统</h1>
              <p className="text-gray-600">
                提供法律条文、司法解释、典型案例、法律术语的检索和查询服务
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回主页
            </Link>
          </div>

          {/* 搜索区域 */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="输入关键词进行搜索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div className="w-full md:w-64">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full pl-4 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  {categories.map((category) => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-full md:w-32">
                <button
                  onClick={handleSearch}
                  disabled={isSearching}
                  className={`w-full py-2 px-4 bg-primary-600 text-white rounded-lg font-medium transition-colors ${isSearching ? 'bg-gray-500 cursor-not-allowed' : 'hover:bg-primary-700'}`}
                >
                  {isSearching ? '搜索中...' : '搜索'}
                </button>
              </div>
            </div>
          </div>

          {/* 结果展示区域 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 左侧结果列表 */}
            <div className="lg:col-span-1 bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-primary-600 text-white px-4 py-3">
                <h2 className="text-lg font-medium">搜索结果</h2>
                <p className="text-sm opacity-90">共 {results.length} 条记录</p>
              </div>
              <div className="h-[600px] overflow-y-auto">
                {results.length > 0 ? (
                  <div className="divide-y divide-gray-200">
                    {results.map((doc) => (
                      <div
                        key={doc.id}
                        className={`p-4 cursor-pointer transition-colors ${selectedDocument?.id === doc.id ? 'bg-primary-50 border-l-4 border-primary-500' : 'hover:bg-gray-50'}`}
                        onClick={() => handleDocumentClick(doc)}
                      >
                        <div className="flex justify-between items-start">
                          <h3 className="font-medium text-gray-900 line-clamp-1">
                            {highlightKeywords(doc.law_name, searchQuery.split(/\s+/))}
                          </h3>
                          <div className="flex items-center space-x-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${doc.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {doc.status === 'active' ? '有效' : '已废止'}
                            </span>
                            <span className="text-xs text-gray-500">{doc.clause_number}</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 mt-1 text-sm text-gray-500">
                          <span>{getCategoryLabel(doc.category)}</span>
                          <span>•</span>
                          <span>{doc.effective_date}</span>
                        </div>
                        <div className="mt-2 text-sm text-gray-600 line-clamp-3">
                          {highlightKeywords(generateSummary(doc.content, searchQuery.split(/\s+/)), searchQuery.split(/\s+/))}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {doc.keywords.slice(0, 3).map((keyword, index) => (
                            <span
                              key={index}
                              className="bg-primary-100 text-primary-800 text-xs px-2 py-1 rounded-full hover:bg-primary-200 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSearchQuery(keyword);
                                handleSearch();
                              }}
                            >
                              {keyword}
                            </span>
                          ))}
                          {doc.keywords.length > 3 && (
                            <span className="text-xs text-gray-500">+{doc.keywords.length - 3}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : searchQuery ? (
                  // 搜索结果为空时的友好提示
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center p-6">
                      <Search className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">未找到相关法律条文</h3>
                      <p className="mb-4">没有找到与 "{searchQuery}" 相关的法律条文</p>
                      <div className="text-sm space-y-2">
                        <p className="text-gray-600">建议：</p>
                        <ul className="text-left list-disc pl-5 text-gray-600 space-y-1">
                          <li>检查关键词是否正确</li>
                          <li>尝试使用更广泛的关键词</li>
                          <li>调整搜索类别</li>
                          <li>尝试使用同义词或相关词</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  // 未输入搜索词时的提示
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <Search className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>输入关键词进行搜索</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 右侧文档详情 */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow-md overflow-hidden">
              {selectedDocument ? (
                <>
                  <div className="bg-primary-600 text-white px-4 py-3 flex justify-between items-center">
                    <h2 className="text-lg font-medium">文档详情</h2>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs bg-white/20 px-2 py-1 rounded-full">
                        {selectedDocument.id}
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="mb-6">
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">
                        {highlightKeywords(selectedDocument.law_name, searchQuery.split(/\s+/))}
                      </h3>
                      <div className="flex flex-wrap gap-2 text-sm mb-3">
                        <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                          {getCategoryLabel(selectedDocument.category)}
                        </span>
                        <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                          {selectedDocument.clause_number}
                        </span>
                        <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded">
                          {selectedDocument.effective_date}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-xs ${selectedDocument.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {selectedDocument.status === 'active' ? '有效' : '已废止'}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                        <div>
                          <span className="font-medium">发布机关：</span>{selectedDocument.issuing_authority}
                        </div>
                        <div>
                          <span className="font-medium">发布日期：</span>{selectedDocument.release_date}
                        </div>
                        <div>
                          <span className="font-medium">生效日期：</span>{selectedDocument.effective_date}
                        </div>
                        <div>
                          <span className="font-medium">最后更新：</span>{selectedDocument.last_updated}
                        </div>
                      </div>
                    </div>

                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">关键词</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedDocument.keywords.map((keyword, index) => (
                          <span
                            key={index}
                            className="bg-primary-100 text-primary-800 px-2 py-0.5 rounded text-xs cursor-pointer hover:bg-primary-200 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSearchQuery(keyword);
                              handleSearch();
                            }}
                          >
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">内容</h4>
                      <div className="bg-gray-50 p-6 rounded-lg border border-gray-200 shadow-sm">
                        <TextExpandable
                          maxLength={300}
                          expandText="展开全文"
                          collapseText="收起"
                          transitionDuration={400}
                          contentClassName="text-gray-800 leading-relaxed"
                        >
                          {highlightKeywords(selectedDocument.content, searchQuery.split(/\s+/))}
                        </TextExpandable>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {/* 相关文档按钮 */}
                      <button className="inline-flex items-center px-4 py-2 border border-primary-600 text-primary-600 rounded-md hover:bg-primary-50 transition-colors">
                        <Search className="h-4 w-4 mr-2" />
                        查看相关文档
                      </button>
                      
                      {/* 复制链接按钮 */}
                      <button className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition-colors">
                        <FileText className="h-4 w-4 mr-2" />
                        复制链接
                      </button>
                      
                      {/* 回到顶部按钮 */}
                      <button className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-800 rounded-md hover:bg-gray-200 transition-colors">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        返回列表
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-[600px] text-gray-500">
                  <div className="text-center">
                    <Book className="h-16 w-16 mx-auto mb-4 opacity-50" />
                    <p>请从左侧选择一个文档查看详情</p>
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

export default LegalLibraryPage;
// 法律文库数据模型定义

export interface LegalDocument {
  id: string;
  title: string;
  type: 'law' | 'interpretation' | 'case' | 'terminology';
  content: string;
  keywords: string[];
  effective_date: string;
  status: 'active' | 'amended' | 'repealed';
  source: string;
  related_documents?: string[];
  category?: string;
}

// 法律条文模型
export interface LawProvision extends LegalDocument {
  article_num: string;
  chapter?: string;
  section?: string;
}

// 司法解释模型
export interface JudicialInterpretation extends LegalDocument {
  issuing_authority: string;
  law_reference: string;
}

// 典型案例模型
export interface TypicalCase extends LegalDocument {
  case_number: string;
  court: string;
  judgment_date: string;
  legal_basis: string[];
}

// 法律术语模型
export interface LegalTerm extends LegalDocument {
  definition: string;
  examples?: string[];
}

// 法律文库存储（简化版，实际项目中应使用数据库）
class LegalLibrary {
  private documents: LegalDocument[] = [];

  // 添加文档
  addDocument(doc: LegalDocument): void {
    this.documents.push(doc);
  }

  // 批量添加文档
  addDocuments(docs: LegalDocument[]): void {
    this.documents.push(...docs);
  }

  // 按ID查询
  getDocumentById(id: string): LegalDocument | undefined {
    return this.documents.find(doc => doc.id === id);
  }

  // 关键词检索
  searchByKeywords(keywords: string[], types?: string[]): LegalDocument[] {
    return this.documents.filter(doc => {
      const matchesType = !types || types.includes(doc.type);
      const matchesKeywords = keywords.some(keyword => 
        doc.title.includes(keyword) || 
        doc.content.includes(keyword) ||
        doc.keywords.some(k => k.includes(keyword))
      );
      return matchesType && matchesKeywords;
    });
  }

  // 按类型查询
  getDocumentsByType(type: LegalDocument['type']): LegalDocument[] {
    return this.documents.filter(doc => doc.type === type);
  }

  // 条款关联查询
  getRelatedDocuments(docId: string): LegalDocument[] {
    const doc = this.getDocumentById(docId);
    if (!doc || !doc.related_documents) return [];
    
    return doc.related_documents
      .map(id => this.getDocumentById(id))
      .filter((doc): doc is LegalDocument => doc !== undefined);
  }

  // 时效性筛选
  getDocumentsByDateRange(startDate: string, endDate: string): LegalDocument[] {
    return this.documents.filter(doc => {
      const docDate = new Date(doc.effective_date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      return docDate >= start && docDate <= end;
    });
  }

  // 获取有效文档
  getActiveDocuments(): LegalDocument[] {
    return this.documents.filter(doc => doc.status === 'active');
  }

  // 搜索相似内容
  searchSimilarContent(content: string, types?: string[]): LegalDocument[] {
    return this.documents.filter(doc => {
      const matchesType = !types || types.includes(doc.type);
      // 简单的相似度匹配，实际项目中可使用更复杂的算法
      const similarity = this.calculateSimilarity(content, doc.content);
      return matchesType && similarity > 0.3;
    });
  }

  // 简单的相似度计算（实际项目中可使用更复杂的算法）
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    const uniqueWords = new Set([...words1, ...words2]);
    const commonWords = new Set(words1.filter(word => words2.includes(word)));
    return commonWords.size / uniqueWords.size;
  }
}

// 导出单例实例
export const legalLibrary = new LegalLibrary();

// 初始化示例数据
export const initializeLegalLibrary = () => {
  // 添加一些示例法律条文
  const exampleLaws: LawProvision[] = [
    {
      id: 'law-001',
      title: '中华人民共和国民法典',
      type: 'law',
      content: '第四百六十四条 合同是民事主体之间设立、变更、终止民事法律关系的协议。',
      keywords: ['合同', '民法典', '民事法律关系'],
      effective_date: '2021-01-01',
      status: 'active',
      source: '全国人民代表大会',
      article_num: '第四百六十四条',
      chapter: '第一编 总则',
      section: '第三章 民事权利'
    },
    {
      id: 'law-002',
      title: '中华人民共和国民法典',
      type: 'law',
      content: '第五百零二条 依法成立的合同，自成立时生效，但是法律另有规定或者当事人另有约定的除外。',
      keywords: ['合同生效', '民法典', '依法成立'],
      effective_date: '2021-01-01',
      status: 'active',
      source: '全国人民代表大会',
      article_num: '第五百零二条',
      chapter: '第三编 合同',
      section: '第一分编 通则'
    }
  ];

  // 添加示例司法解释
  const exampleInterpretations: JudicialInterpretation[] = [
    {
      id: 'interpretation-001',
      title: '最高人民法院关于审理合同纠纷案件适用法律问题的解释',
      type: 'interpretation',
      content: '第一条 当事人对合同是否成立存在争议，人民法院能够确定当事人名称或者姓名、标的和数量的，一般应当认定合同成立。但法律另有规定或者当事人另有约定的除外。',
      keywords: ['合同成立', '司法解释'],
      effective_date: '2020-12-31',
      status: 'active',
      source: '最高人民法院',
      issuing_authority: '最高人民法院',
      law_reference: '中华人民共和国民法典'
    }
  ];

  // 添加示例法律术语
  const exampleTerms: LegalTerm[] = [
    {
      id: 'term-001',
      title: '霸王条款',
      type: 'terminology',
      content: '霸王条款是指一些经营者单方面制定的逃避法定义务、减免自身责任的不平等格式合同、通知、声明和店堂告示或者行业惯例等。',
      keywords: ['霸王条款', '格式合同', '不平等条款'],
      effective_date: '2021-01-01',
      status: 'active',
      source: '法律术语词典',
      definition: '霸王条款是指一些经营者单方面制定的逃避法定义务、减免自身责任的不平等格式合同、通知、声明和店堂告示或者行业惯例等。',
      examples: ['本公司拥有最终解释权', '单方面解除合同无需承担责任']
    }
  ];

  // 将示例数据添加到法律文库
  legalLibrary.addDocuments([...exampleLaws, ...exampleInterpretations, ...exampleTerms]);
};
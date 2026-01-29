// AI内容验证服务

import { LegalProvision } from './local-legal-library';
import { localLegalLibrary } from './local-legal-library';
import { legalLibrary } from './legal-library';

// 置信度等级
interface ConfidenceScore {
  score: number; // 0-100
  level: 'high' | 'medium' | 'low';
  explanation: string;
}

// 验证结果
interface ValidationResult {
  is_valid: boolean;
  confidence: ConfidenceScore;
  sources: Array<{
    id: string;
    type: 'local' | 'online';
    content: string;
    relevance: number; // 0-100
  }>;
  issues: Array<{
    type: string;
    message: string;
    severity: 'high' | 'medium' | 'low';
  }>;
}

// 幻觉案例记录
interface HallucinationCase {
  id: string;
  timestamp: Date;
  ai_output: any;
  validation_result: ValidationResult;
  context: {
    contract_text: string;
    legal_references: string;
    template: string;
  };
  resolved: boolean;
  resolution?: string;
}

// 事实核查数据库
class FactCheckingDatabase {
  private static instance: FactCheckingDatabase;
  private static initializationPromise: Promise<void> | null = null;
  private facts: Map<string, any> = new Map();
  private hallucination_cases: HallucinationCase[] = [];
  private isInitialized: boolean = false;

  private constructor() {
    // 构造函数不再调用init，改为在getInstance中调用
  }

  // 获取单例实例（异步）
  public static async getInstance(): Promise<FactCheckingDatabase> {
    if (!FactCheckingDatabase.instance) {
      FactCheckingDatabase.instance = new FactCheckingDatabase();
      FactCheckingDatabase.initializationPromise = FactCheckingDatabase.instance.init();
      await FactCheckingDatabase.initializationPromise;
    } else if (FactCheckingDatabase.initializationPromise) {
      // 如果实例已存在但初始化未完成，等待初始化完成
      await FactCheckingDatabase.initializationPromise;
    }
    return FactCheckingDatabase.instance;
  }

  // 同步获取实例（不等待初始化完成）
  public static getInstanceSync(): FactCheckingDatabase {
    if (!FactCheckingDatabase.instance) {
      FactCheckingDatabase.instance = new FactCheckingDatabase();
      // 启动初始化但不等待
      FactCheckingDatabase.initializationPromise = FactCheckingDatabase.instance.init();
    }
    return FactCheckingDatabase.instance;
  }

  private async init(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    // 初始化事实数据库，从法律文库加载数据
    await this.loadLegalProvisions();
    this.isInitialized = true;
  }

  // 确保初始化完成
  public async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.init();
    }
  }

  // 检查初始化状态
  public getInitialized(): boolean {
    return this.isInitialized;
  }

  private async loadLegalProvisions(): Promise<void> {
    // 确保法律条文库初始化完成
    await localLegalLibrary.ensureInitialized();
    
    // 从本地法律文库加载数据
    const provisions = localLegalLibrary.getAllProvisions();
    for (const provision of provisions) {
      // 为每个法律条文创建索引
      this.facts.set(`${provision.law_name}_${provision.clause_number}`, provision);
      
      // 为关键词创建索引
      for (const keyword of provision.keywords) {
        const keywordKey = `keyword_${keyword.toLowerCase()}`;
        if (!this.facts.has(keywordKey)) {
          this.facts.set(keywordKey, []);
        }
        (this.facts.get(keywordKey) as any[]).push(provision);
      }
    }
  }

  // 搜索相关事实
  public async searchFacts(query: string, keywords: string[]): Promise<any[]> {
    await this.ensureInitialized();
    const results: any[] = [];
    const seen = new Set<string>();

    // 关键词搜索
    for (const keyword of keywords) {
      const keywordKey = `keyword_${keyword.toLowerCase()}`;
      const facts = this.facts.get(keywordKey) as any[] || [];
      for (const fact of facts) {
        if (!seen.has(fact.id)) {
          seen.add(fact.id);
          results.push(fact);
        }
      }
    }

    return results;
  }

  // 记录幻觉案例
  public recordHallucinationCase(caseData: Omit<HallucinationCase, 'id' | 'timestamp' | 'resolved'>): void {
    const hallucinationCase: HallucinationCase = {
      id: `hallucination_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      ...caseData,
      resolved: false
    };
    this.hallucination_cases.push(hallucinationCase);
    
    // 保存到文件（简化实现）
    this.saveHallucinationCases();
  }

  // 保存幻觉案例到文件
  private saveHallucinationCases(): void {
    try {
      const data = JSON.stringify(this.hallucination_cases, null, 2);
      // 实际项目中应保存到数据库
      console.log('Saved hallucination cases:', this.hallucination_cases.length);
    } catch (error) {
      console.error('Error saving hallucination cases:', error);
    }
  }

  // 获取所有幻觉案例
  public getHallucinationCases(): HallucinationCase[] {
    return this.hallucination_cases;
  }
}

// AI内容验证服务
class AIValidationService {
  private factCheckingDBPromise: Promise<FactCheckingDatabase>;

  constructor() {
    // 保存初始化Promise，而不是直接等待
    this.factCheckingDBPromise = FactCheckingDatabase.getInstance();
  }
  
  // 获取事实核查数据库实例
  private async getFactCheckingDB(): Promise<FactCheckingDatabase> {
    return await this.factCheckingDBPromise;
  }

  // 验证AI生成的内容
  public async validateAIOutput(ai_output: any, context: {
    contract_text: string;
    legal_references: string;
    template: string;
  }): Promise<ValidationResult> {
    const result: ValidationResult = {
      is_valid: true,
      confidence: {
        score: 100,
        level: 'high',
        explanation: 'AI输出内容经过多源验证，符合法律规定'
      },
      sources: [],
      issues: []
    };

    // 提取AI输出中的关键信息
    const key_info = this.extractKeyInfo(ai_output);
    
    // 多源信息交叉验证
    const validation_results = await this.crossValidate(key_info);
    
    // 计算置信度
    result.confidence = this.calculateConfidence(validation_results);
    
    // 收集验证来源
    result.sources = validation_results.sources;
    
    // 收集问题
    result.issues = validation_results.issues;
    
    // 确定是否有效
    result.is_valid = result.confidence.score >= 60 && result.issues.filter(issue => issue.severity === 'high').length === 0;
    
    // 记录幻觉案例（如果有高风险问题）
    if (result.confidence.level === 'low' || result.issues.filter(issue => issue.severity === 'high').length > 0) {
      const factCheckingDB = await this.getFactCheckingDB();
      factCheckingDB.recordHallucinationCase({
        ai_output,
        validation_result: result,
        context
      });
    }

    return result;
  }

  // 提取AI输出中的关键信息
  private extractKeyInfo(ai_output: any): {
    legal_claims: string[];
    risk_points: Array<{
      original_text: string;
      issue: string;
      suggestion: string;
    }>;
  } {
    const legal_claims: string[] = [];
    const risk_points: Array<{
      original_text: string;
      issue: string;
      suggestion: string;
    }> = [];

    // 从风险点提取法律主张
    if (ai_output.risks && Array.isArray(ai_output.risks)) {
      for (const risk of ai_output.risks) {
        risk_points.push({
          original_text: risk.original_text || '',
          issue: risk.issue || '',
          suggestion: risk.suggestion || ''
        });

        // 提取法律主张
        const claims = this.extractLegalClaims(risk.issue || '');
        legal_claims.push(...claims);
      }
    }

    return {
      legal_claims,
      risk_points
    };
  }

  // 从文本中提取法律主张
  private extractLegalClaims(text: string): string[] {
    // 简单实现，实际项目中应使用NLP模型
    const claims: string[] = [];
    const legal_terms = [
      '民法典', '合同法', '劳动法', '公司法', '知识产权法',
      '霸王条款', '无效', '可撤销', '违约责任', '解除合同',
      '试用期', '竞业限制', '著作权', '源代码所有权'
    ];

    for (const term of legal_terms) {
      if (text.includes(term)) {
        claims.push(term);
      }
    }

    return claims;
  }

  // 多源信息交叉验证
  private async crossValidate(key_info: {
    legal_claims: string[];
    risk_points: Array<{
      original_text: string;
      issue: string;
      suggestion: string;
    }>;
  }): Promise<{
    sources: ValidationResult['sources'];
    issues: ValidationResult['issues'];
  }> {
    const sources: ValidationResult['sources'] = [];
    const issues: ValidationResult['issues'] = [];

    // 从本地法律文库验证
    const local_sources = await this.validateFromLocalLibrary(key_info);
    sources.push(...local_sources);

    // 从在线法律文库验证
    const online_sources = await this.validateFromOnlineLibrary(key_info);
    sources.push(...online_sources);

    // 检查是否有足够的来源支持
    if (sources.length === 0) {
      issues.push({
        type: 'no_sources',
        message: '无法找到支持AI输出的法律依据',
        severity: 'high'
      });
    }

    // 检查来源相关性
    const low_relevance_sources = sources.filter(source => source.relevance < 50);
    if (low_relevance_sources.length > 0) {
      issues.push({
        type: 'low_relevance',
        message: `找到 ${low_relevance_sources.length} 个相关性较低的来源`,
        severity: 'medium'
      });
    }

    return { sources, issues };
  }

  // 从本地法律文库验证
  private async validateFromLocalLibrary(key_info: {
    legal_claims: string[];
    risk_points: Array<{
      original_text: string;
      issue: string;
      suggestion: string;
    }>;
  }): Promise<ValidationResult['sources']> {
    const sources: ValidationResult['sources'] = [];

    // 合并所有关键词
    const all_keywords = [...new Set(key_info.legal_claims)];
    
    if (all_keywords.length > 0) {
      // 从本地法律文库搜索相关法律条文
      const search_result = await localLegalLibrary.search({ keywords: all_keywords });
      
      for (const provision of search_result.provisions) {
        // 计算相关性
        const relevance = this.calculateRelevance(provision, key_info);
        
        if (relevance > 30) { // 只添加相关性大于30%的来源
          sources.push({
            id: provision.id,
            type: 'local',
            content: `${provision.law_name} ${provision.clause_number}: ${provision.content}`,
            relevance
          });
        }
      }
    }

    return sources;
  }

  // 从在线法律文库验证
  private async validateFromOnlineLibrary(key_info: {
    legal_claims: string[];
    risk_points: Array<{
      original_text: string;
      issue: string;
      suggestion: string;
    }>;
  }): Promise<ValidationResult['sources']> {
    const sources: ValidationResult['sources'] = [];

    // 合并所有关键词
    const all_keywords = [...new Set(key_info.legal_claims)];
    
    if (all_keywords.length > 0) {
      try {
        // 从在线法律文库搜索相关法律条文
        const online_results = legalLibrary.searchByKeywords(all_keywords, ['law', 'interpretation']);
        
        for (const result of online_results) {
          // 计算相关性
          const relevance = this.calculateRelevanceOnline(result, key_info);
          
          if (relevance > 30) { // 只添加相关性大于30%的来源
            sources.push({
              id: result.id || `online_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              type: 'online',
              content: `${result.title}: ${result.content}`,
              relevance
            });
          }
        }
      } catch (error) {
        console.error('Error validating from online library:', error);
      }
    }

    return sources;
  }

  // 计算本地法律条文的相关性
  private calculateRelevance(provision: LegalProvision, key_info: {
    legal_claims: string[];
    risk_points: Array<{
      original_text: string;
      issue: string;
      suggestion: string;
    }>;
  }): number {
    let relevance = 0;
    const text = `${provision.law_name} ${provision.content} ${provision.keywords.join(' ')}`;
    
    // 关键词匹配
    for (const claim of key_info.legal_claims) {
      if (text.includes(claim)) {
        relevance += 10;
      }
    }
    
    // 风险点匹配
    for (const risk of key_info.risk_points) {
      if (text.includes(risk.issue)) {
        relevance += 15;
      }
      if (text.includes(risk.suggestion)) {
        relevance += 5;
      }
    }
    
    // 生效状态加成
    if (provision.status === 'active') {
      relevance += 10;
    }
    
    // 法律等级加成
    const lawLevel = this.getLawLevel(provision.law_name);
    relevance += lawLevel * 2;
    
    return Math.min(relevance, 100);
  }

  // 计算在线法律条文的相关性
  private calculateRelevanceOnline(result: any, key_info: {
    legal_claims: string[];
    risk_points: Array<{
      original_text: string;
      issue: string;
      suggestion: string;
    }>;
  }): number {
    let relevance = 0;
    const text = `${result.title} ${result.content}`;
    
    // 关键词匹配
    for (const claim of key_info.legal_claims) {
      if (text.includes(claim)) {
        relevance += 10;
      }
    }
    
    // 风险点匹配
    for (const risk of key_info.risk_points) {
      if (text.includes(risk.issue)) {
        relevance += 15;
      }
      if (text.includes(risk.suggestion)) {
        relevance += 5;
      }
    }
    
    return Math.min(relevance, 100);
  }

  // 获取法律等级
  private getLawLevel(lawName: string): number {
    const lawLevelMap = new Map([
      ['宪法', 10],
      ['民法典', 9],
      ['刑法', 9],
      ['基本法', 8],
      ['单行法', 7],
      ['行政法规', 6],
      ['司法解释', 5],
      ['地方性法规', 4],
      ['部门规章', 3],
      ['其他', 2]
    ]);
    
    for (const [levelKey, levelScore] of lawLevelMap) {
      if (lawName.includes(levelKey)) {
        return levelScore;
      }
    }
    return lawLevelMap.get('其他')!;
  }

  // 计算置信度
  private calculateConfidence(validation_results: {
    sources: ValidationResult['sources'];
    issues: ValidationResult['issues'];
  }): ConfidenceScore {
    let score = 100;
    let explanation = '';
    let level: 'high' | 'medium' | 'low' = 'high';
    
    // 来源数量影响
    if (validation_results.sources.length === 0) {
      score -= 60;
      explanation += '没有找到支持的法律依据；';
    } else if (validation_results.sources.length < 3) {
      score -= 20;
      explanation += `找到 ${validation_results.sources.length} 个支持的法律依据，数量较少；`;
    } else {
      explanation += `找到 ${validation_results.sources.length} 个支持的法律依据；`;
    }
    
    // 来源质量影响
    const avg_relevance = validation_results.sources.reduce((sum, source) => sum + source.relevance, 0) / Math.max(validation_results.sources.length, 1);
    if (avg_relevance < 50) {
      score -= 30;
      explanation += `来源平均相关性较低（${avg_relevance.toFixed(0)}%）；`;
    } else if (avg_relevance < 75) {
      score -= 10;
      explanation += `来源平均相关性一般（${avg_relevance.toFixed(0)}%）；`;
    } else {
      explanation += `来源平均相关性较高（${avg_relevance.toFixed(0)}%）；`;
    }
    
    // 问题影响
    const high_issues = validation_results.issues.filter(issue => issue.severity === 'high').length;
    const medium_issues = validation_results.issues.filter(issue => issue.severity === 'medium').length;
    
    if (high_issues > 0) {
      score -= high_issues * 30;
      explanation += `${high_issues} 个高风险问题；`;
    }
    if (medium_issues > 0) {
      score -= medium_issues * 15;
      explanation += `${medium_issues} 个中风险问题；`;
    }
    
    // 确保分数在0-100范围内
    score = Math.max(0, Math.min(100, score));
    
    // 确定置信度等级
    if (score >= 80) {
      level = 'high';
    } else if (score >= 50) {
      level = 'medium';
    } else {
      level = 'low';
    }
    
    return {
      score,
      level,
      explanation: explanation.trim().replace(/；$/, '.')
    };
  }

  // 判断是否需要人工审核
  public needsHumanReview(validation_result: ValidationResult, ai_output: any): boolean {
    // 置信度低需要人工审核
    if (validation_result.confidence.level === 'low') {
      return true;
    }
    
    // 有高风险问题需要人工审核
    if (validation_result.issues.some(issue => issue.severity === 'high')) {
      return true;
    }
    
    // 高风险模板需要人工审核
    // 这里可以根据模板类型判断
    
    // 分数低于60需要人工审核
    if (validation_result.confidence.score < 60) {
      return true;
    }
    
    return false;
  }
}

export const aiValidationService = new AIValidationService;
export type { ValidationResult, ConfidenceScore, HallucinationCase };
export { FactCheckingDatabase };

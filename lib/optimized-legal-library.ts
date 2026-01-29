// 优化后的本地法律文库系统 - 支持增量加载和进度报告

import fs from 'fs';
import path from 'path';
import { performance } from 'perf_hooks';
import { LRUCache } from 'lru-cache';
import { databaseService } from './database';

// 法律条文数据模型
export interface LegalProvision {
  id: string;
  law_name: string;
  issuing_authority?: string;
  release_date?: string;
  effective_date?: string;
  content: string;
  clause_number?: string;
  chapter?: string;
  section?: string;
  article?: string;
  paragraph?: string;
  item?: string;
  status: 'active' | 'amended' | 'repealed';
  keywords: string[];
  category: string;
  file_path?: string;
  last_updated: string;
}

// 检索条件接口
export interface SearchCriteria {
  keywords?: string[];
  clause_number?: string;
  law_name?: string;
  issuing_authority?: string;
  effective_date_from?: string;
  effective_date_to?: string;
  status?: LegalProvision['status'];
  category?: string;
  types?: string[];
}

// 检索结果接口
export interface SearchResult {
  provisions: LegalProvision[];
  total: number;
  duration: number;
  search_criteria: SearchCriteria;
}

// 加载进度接口
export interface LoadProgress {
  stage: 'initializing' | 'checking_database' | 'loading_files' | 'building_index' | 'completed' | 'error';
  progress: number; // 0-100
  currentFile?: string;
  loadedCount: number;
  totalCount: number;
  message: string;
  error?: string;
}

// 进度回调类型
export type ProgressCallback = (progress: LoadProgress) => void;

// 核心法律分类（优先加载）
const CORE_CATEGORIES = ['民法', '刑法', '合同法', '公司法', '劳动法'];

// 本地法律文库类 - 优化版
class OptimizedLocalLegalLibrary {
  private dataDirectory: string;
  private provisions: LegalProvision[] = [];
  private provisionMap: Map<string, LegalProvision> = new Map();
  private keywordIndex: Map<string, Set<string>> = new Map();
  private clauseIndex: Map<string, LegalProvision> = new Map();
  private lruCache: LRUCache<string, SearchResult>;
  private lastUpdateTime: string = '';
  private isDatabaseInitialized: boolean = false;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private progressCallback: ProgressCallback | null = null;
  private loadingStartTime: number = 0;
  private lawLevelMap: Map<string, number> = new Map([
    ['民法典', 10], ['刑法', 9], ['宪法', 10], ['基本法', 9],
    ['单行法', 8], ['行政法规', 7], ['司法解释', 6],
    ['地方性法规', 5], ['部门规章', 4], ['其他', 3]
  ]);

  constructor(dataDirectory: string) {
    this.dataDirectory = dataDirectory;
    this.lruCache = new LRUCache({
      max: 1000,
      ttl: 60 * 60 * 1000,
      allowStale: false,
    });
  }

  // 设置进度回调
  public setProgressCallback(callback: ProgressCallback): void {
    this.progressCallback = callback;
  }

  // 报告进度
  private reportProgress(progress: LoadProgress): void {
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
    console.log(`[LOAD PROGRESS] ${progress.stage}: ${progress.progress}% - ${progress.message}`);
  }

  // 优化的初始化方法 - 支持增量加载
  public async initialize(useIncremental: boolean = true): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.optimizedInit(useIncremental);
    await this.initializationPromise;
    return;
  }

  // 优化的初始化实现
  private async optimizedInit(useIncremental: boolean): Promise<void> {
    this.loadingStartTime = performance.now();
    console.log('Starting optimized legal library initialization...');

    try {
      // 阶段1：初始化
      this.reportProgress({
        stage: 'initializing',
        progress: 0,
        loadedCount: 0,
        totalCount: 0,
        message: '正在初始化系统...'
      });

      // 初始化数据库
      await databaseService.initialize();
      this.isDatabaseInitialized = true;
      this.reportProgress({
        stage: 'initializing',
        progress: 5,
        loadedCount: 0,
        totalCount: 0,
        message: '数据库初始化完成'
      });

      // 阶段2：检查数据库
      this.reportProgress({
        stage: 'checking_database',
        progress: 10,
        loadedCount: 0,
        totalCount: 0,
        message: '正在检查数据库...'
      });

      // 从数据库加载
      await this.loadFromDatabase();

      // 如果数据库中有数据，直接完成初始化
      if (this.provisions.length > 0) {
        console.log(`Found ${this.provisions.length} provisions in database, using cached data`);
        this.buildIndexes();
        this.lastUpdateTime = new Date().toISOString();
        this.isInitialized = true;
        
        const duration = performance.now() - this.loadingStartTime;
        this.reportProgress({
          stage: 'completed',
          progress: 100,
          loadedCount: this.provisions.length,
          totalCount: this.provisions.length,
          message: `加载完成！从数据库加载了 ${this.provisions.length} 条法律条文（${(duration / 1000).toFixed(2)}秒）`
        });
        
        console.log(`Legal library initialized from cache. Loaded ${this.provisions.length} provisions in ${duration}ms`);
        return;
      }

      // 如果数据库为空，使用增量加载
      if (useIncremental) {
        await this.incrementalLoad();
      } else {
        await this.loadAllProvisions();
      }

      // 构建索引
      this.buildIndexes();

      // 保存到数据库
      if (this.isDatabaseInitialized) {
        await this.saveAllToDatabase();
      }

      this.lastUpdateTime = new Date().toISOString();
      this.isInitialized = true;

      const duration = performance.now() - this.loadingStartTime;
      console.log(`Legal library initialized successfully. Loaded ${this.provisions.length} provisions in ${duration}ms`);
      
      this.reportProgress({
        stage: 'completed',
        progress: 100,
        loadedCount: this.provisions.length,
        totalCount: this.provisions.length,
        message: `加载完成！共加载 ${this.provisions.length} 条法律条文（${(duration / 1000).toFixed(2)}秒）`
      });

    } catch (error) {
      console.error('Error initializing legal library:', error);
      this.reportProgress({
        stage: 'error',
        progress: 0,
        loadedCount: 0,
        totalCount: 0,
        message: '加载失败',
        error: (error as Error).message
      });
      this.isInitialized = false;
    }
  }

  // 增量加载 - 先加载核心类别
  private async incrementalLoad(): Promise<void> {
    console.log('Starting incremental load...');
    const startTime = performance.now();

    // 阶段3：加载核心法律条文
    this.reportProgress({
      stage: 'loading_files',
      progress: 15,
      loadedCount: 0,
      totalCount: 0,
      message: '正在加载核心法律条文...'
    });

    // 先加载核心类别的文件
    const coreFiles = this.getFilesByCategories(CORE_CATEGORIES);
    console.log(`Found ${coreFiles.length} core category files`);

    let loadedCount = 0;
    const totalToLoad = coreFiles.length;

    for (let i = 0; i < coreFiles.length; i++) {
      try {
        const provisions = await this.parseFile(coreFiles[i]);
        this.provisions.push(...provisions);
        loadedCount++;
        
        // 报告进度 (15% - 50%)
        const progress = 15 + (loadedCount / totalToLoad) * 35;
        this.reportProgress({
          stage: 'loading_files',
          progress: Math.round(progress),
          currentFile: path.basename(coreFiles[i]),
          loadedCount,
          totalCount: totalToLoad,
          message: `加载核心法律 (${loadedCount}/${totalToLoad})`
        });
      } catch (error) {
        console.error(`Error loading core file ${coreFiles[i]}:`, error);
      }
    }

    // 阶段4：异步加载其他文件
    this.reportProgress({
      stage: 'loading_files',
      progress: 50,
      loadedCount,
      totalCount: totalToLoad,
      message: '正在加载其他法律条文（后台）...'
    });

    // 获取非核心类别的文件
    const otherFiles = this.getFilesByCategories(CORE_CATEGORIES, true);
    console.log(`Found ${otherFiles.length} non-core category files`);

    // 异步加载其他文件，不阻塞主流程
    if (otherFiles.length > 0) {
      this.loadFilesAsync(otherFiles).catch(error => {
        console.error('Error in async loading:', error);
      });
    }

    console.log(`Incremental load completed. Core: ${this.provisions.length} provisions`);
  }

  // 获取指定类别的文件
  private getFilesByCategories(categories: string[], exclude: boolean = false): string[] {
    const files: string[] = [];
    
    const traverseDirectory = (dirPath: string) => {
      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          
          if (entry.isDirectory()) {
            traverseDirectory(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(fullPath).toLowerCase();
            if (['.docx', '.pdf', '.txt'].includes(ext)) {
              const fileName = path.basename(fullPath);
              const isCoreCategory = categories.some(cat => fileName.includes(cat));
              
              if (exclude && !isCoreCategory) {
                files.push(fullPath);
              } else if (!exclude && isCoreCategory) {
                files.push(fullPath);
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error);
      }
    };

    traverseDirectory(this.dataDirectory);
    return files;
  }

  // 异步加载文件
  private async loadFilesAsync(files: string[]): Promise<void> {
    const startProgress = 50;
    const endProgress = 90;
    const totalFiles = files.length;

    console.log(`Starting async loading of ${totalFiles} files...`);

    for (let i = 0; i < files.length; i++) {
      try {
        const provisions = await this.parseFile(files[i]);
        
        // 批量添加到数组，减少重绘
        if (provisions.length > 0) {
          this.provisions.push(...provisions);
        }

        // 报告进度 (50% - 90%)
        const progress = startProgress + ((i + 1) / totalFiles) * (endProgress - startProgress);
        this.reportProgress({
          stage: 'loading_files',
          progress: Math.round(progress),
          currentFile: path.basename(files[i]),
          loadedCount: i + 1,
          totalCount: totalFiles,
          message: `后台加载中 (${i + 1}/${totalFiles})`
        });
      } catch (error) {
        console.error(`Error async loading file ${files[i]}:`, error);
      }
    }

    console.log(`Async loading completed. Total provisions: ${this.provisions.length}`);
  }

  // 从数据库加载所有法律条文
  private async loadFromDatabase(): Promise<void> {
    try {
      const dbProvisions = await databaseService.getAllProvisions();
      this.provisions = dbProvisions;
      console.log(`Loaded ${dbProvisions.length} provisions from database`);
    } catch (error) {
      console.error('Error loading provisions from database:', error);
      this.provisions = [];
    }
  }

  // 批量保存所有法律条文到数据库
  private async saveAllToDatabase(): Promise<void> {
    if (!this.isDatabaseInitialized || this.provisions.length === 0) return;

    try {
      console.log(`Saving ${this.provisions.length} provisions to database...`);
      
      // 批量插入，提高性能
      await databaseService.batchCreateProvisions(this.provisions);
      
      console.log(`Saved ${this.provisions.length} provisions to database`);
    } catch (error) {
      console.error('Error saving provisions to database:', error);
    }
  }

  // 从文件读取所有法律条文（完整加载）
  private async loadAllProvisions(): Promise<void> {
    const loadResult = {
      totalFiles: 0,
      processedFiles: 0,
      successFiles: 0,
      failedFiles: 0,
      totalProvisions: 0,
      errors: [] as { filePath: string; error: string }[]
    };

    const files = this.getAllFiles();
    loadResult.totalFiles = files.length;

    console.log(`Starting to load legal provisions from ${files.length} files...`);

    const processingPromises = files.map(async (filePath, index) => {
      try {
        const provisions = await this.parseFile(filePath);
        
        if (provisions.length > 0) {
          this.provisions.push(...provisions);
          loadResult.successFiles++;
          loadResult.totalProvisions += provisions.length;
        }

        loadResult.processedFiles++;
        
        // 报告进度
        const progress = (loadResult.processedFiles / files.length) * 90;
        this.reportProgress({
          stage: 'loading_files',
          progress: Math.round(progress),
          currentFile: path.basename(filePath),
          loadedCount: loadResult.processedFiles,
          totalCount: files.length,
          message: `加载中 (${loadResult.processedFiles}/${files.length})`
        });
        
      } catch (error) {
        loadResult.failedFiles++;
        loadResult.errors.push({
          filePath,
          error: (error as Error).message
        });
      }
    });

    await Promise.all(processingPromises);

    console.log('\n--- Legal Provisions Loading Results ---');
    console.log(`Total files found: ${loadResult.totalFiles}`);
    console.log(`Files processed: ${loadResult.processedFiles}`);
    console.log(`Files succeeded: ${loadResult.successFiles}`);
    console.log(`Files failed: ${loadResult.failedFiles}`);
    console.log(`Total provisions loaded: ${loadResult.totalProvisions}`);
  }

  // 获取所有文件
  private getAllFiles(): string[] {
    const files: string[] = [];
    
    const traverseDirectory = (dirPath: string) => {
      try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          
          if (entry.isDirectory()) {
            traverseDirectory(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(fullPath).toLowerCase();
            if (['.docx', '.pdf', '.txt'].includes(ext)) {
              files.push(fullPath);
            }
          }
        }
      } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error);
      }
    };

    traverseDirectory(this.dataDirectory);
    return files;
  }

  // 解析文件
  private async parseFile(filePath: string): Promise<LegalProvision[]> {
    const fileName = path.basename(filePath);
    const fileExtension = path.extname(filePath).toLowerCase();
    
    let lawName = '';
    let releaseDate = '';
    
    const match = fileName.match(/(.+)_(\d{8})\.(docx|pdf|txt)$/);
    if (match) {
      lawName = match[1];
      releaseDate = match[2];
    } else {
      lawName = path.basename(fileName, fileExtension);
      releaseDate = new Date().toISOString().slice(0, 8).replace(/-/g, '');
    }

    const formattedDate = `${releaseDate.slice(0, 4)}-${releaseDate.slice(4, 6)}-${releaseDate.slice(6, 8)}`;
    const category = this.extractCategory(lawName);
    
    let content = '';
    
    try {
      switch (fileExtension) {
        case '.docx':
          const mammoth = await import('mammoth');
          const docxResult = await mammoth.extractRawText({ path: filePath });
          content = docxResult.value;
          break;
          
        case '.pdf':
          const pdfParse = await import('pdf-parse');
          const dataBuffer = fs.readFileSync(filePath);
          const pdfResult = await pdfParse.default(dataBuffer);
          content = pdfResult.text;
          break;
          
        case '.txt':
          content = fs.readFileSync(filePath, 'utf8');
          break;
      }
    } catch (error) {
      console.error(`Error parsing file ${filePath}:`, error);
      throw error;
    }

    // 清理内容
    const cleanedContent = content
      .replace(/\s+/g, ' ')
      .replace(/\n\s+/g, '\n')
      .replace(/\s+\n/g, '\n')
      .trim();

    // 提取条款
    const articleRegex = /(第[一二三四五六七八九十百千万]+条 第\d+条)/g;
    const articles = cleanedContent.split(articleRegex);

    const provisions: LegalProvision[] = [];

    if (articles.length > 1) {
      for (let i = 1; i < articles.length; i += 2) {
        const clauseNumber = articles[i];
        const articleContent = articles[i + 1]?.trim() || '';
        
        if (articleContent) {
          provisions.push({
            id: `${lawName}_${clauseNumber}_${Date.now()}_${i}`,
            law_name: lawName,
            issuing_authority: this.extractIssuingAuthority(lawName),
            release_date: formattedDate,
            effective_date: formattedDate,
            content: articleContent,
            clause_number: clauseNumber,
            chapter: this.extractChapter(articleContent),
            section: this.extractSection(articleContent),
            status: 'active',
            keywords: [lawName, clauseNumber, ...this.extractKeywordsFromContent(articleContent)],
            category,
            file_path: filePath,
            last_updated: new Date().toISOString()
          });
        }
      }
    } else {
      const firstClause = this.extractFirstClauseNumber(cleanedContent);
      provisions.push({
        id: `${lawName}_${releaseDate}_${Date.now()}`,
        law_name: lawName,
        issuing_authority: this.extractIssuingAuthority(lawName),
        release_date: formattedDate,
        effective_date: formattedDate,
        content: cleanedContent,
        clause_number: firstClause || '第1条',
        chapter: this.extractChapter(cleanedContent),
        section: this.extractSection(cleanedContent),
        status: 'active',
        keywords: [lawName, ...this.extractKeywordsFromContent(cleanedContent)],
        category,
        file_path: filePath,
        last_updated: new Date().toISOString()
      });
    }

    return provisions;
  }

  // 从法律名称提取分类
  private extractCategory(lawName: string): string {
    if (lawName.includes('民法典')) return '民法';
    if (lawName.includes('刑法')) return '刑法';
    if (lawName.includes('合同法') || lawName.includes('合同')) return '合同法';
    if (lawName.includes('劳动法') || lawName.includes('劳动合同')) return '劳动法';
    if (lawName.includes('公司法')) return '公司法';
    if (lawName.includes('知识产权')) return '知识产权法';
    if (lawName.includes('行政')) return '行政法';
    if (lawName.includes('条例')) return '行政法规';
    if (lawName.includes('司法解释')) return '司法解释';
    if (lawName.includes('决定')) return '决定';
    return '其他';
  }

  // 从法律名称提取发布机关
  private extractIssuingAuthority(lawName: string): string {
    if (lawName.includes('中华人民共和国')) return '全国人民代表大会常务委员会';
    if (lawName.includes('条例')) return '国务院';
    return '未知';
  }

  // 从内容中提取第一章信息
  private extractChapter(content: string): string | undefined {
    const chapterMatch = content.match(/第[一二三四五六七八九十百千万]+章|第一章|第二章/);
    return chapterMatch?.[0];
  }

  // 从内容中提取节信息
  private extractSection(content: string): string | undefined {
    const sectionMatch = content.match(/第[一二三四五六七八九十百千万]+节|第一节|第二节/);
    return sectionMatch?.[0];
  }

  // 从内容中提取第一个条款编号
  private extractFirstClauseNumber(content: string): string | undefined {
    const clauseMatch = content.match(/第[一二三四五六七八九十百千万]+条 第\d+条/);
    return clauseMatch?.[0];
  }

  // 从内容中提取关键词
  private extractKeywordsFromContent(content: string): string[] {
    const keywords = content
      .replace(/[\p{Punctuation}\s]+/gu, ' ')
      .split(' ')
      .filter(word => word.length > 2)
      .slice(0, 10);
    
    return [...new Set(keywords)];
  }

  // 构建索引
  private buildIndexes(): void {
    console.log('Building search indexes...');
    const startTime = performance.now();
    
    this.provisionMap.clear();
    this.keywordIndex.clear();
    this.clauseIndex.clear();

    for (const provision of this.provisions) {
      this.provisionMap.set(provision.id, provision);
      
      if (provision.clause_number) {
        this.clauseIndex.set(provision.clause_number, provision);
      }
      
      for (const keyword of provision.keywords) {
        const lowerKeyword = keyword.toLowerCase();
        if (!this.keywordIndex.has(lowerKeyword)) {
          this.keywordIndex.set(lowerKeyword, new Set());
        }
        this.keywordIndex.get(lowerKeyword)!.add(provision.id);
      }
    }

    const duration = performance.now() - startTime;
    console.log(`Indexes built in ${duration}ms. Keywords: ${this.keywordIndex.size}, Clauses: ${this.clauseIndex.size}`);
  }

  // 搜索方法
  async search(criteria: SearchCriteria): Promise<SearchResult> {
    await this.ensureInitialized();
    
    const startTime = performance.now();
    const cacheKey = JSON.stringify(criteria);
    
    const cachedResult = this.lruCache.get(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    let filteredProvisions = [...this.provisions];

    // 条款编号精确查询
    if (criteria.clause_number) {
      const exactMatch = this.clauseIndex.get(criteria.clause_number);
      if (exactMatch) {
        filteredProvisions = [exactMatch];
      } else {
        filteredProvisions = [];
      }
    } else {
      // 关键词检索
      if (criteria.keywords && criteria.keywords.length > 0) {
        const matchingIds = this.searchByKeywords(criteria.keywords);
        filteredProvisions = filteredProvisions.filter(p => matchingIds.has(p.id));
      }

      // 分类过滤
      if (criteria.category) {
        filteredProvisions = filteredProvisions.filter(p => p.category === criteria.category);
      }

      // 状态过滤
      if (criteria.status) {
        filteredProvisions = filteredProvisions.filter(p => p.status === criteria.status);
      }
    }

    // 排序
    const sortedProvisions = this.sortByRelevance(filteredProvisions, criteria);
    const finalProvisions = sortedProvisions.slice(0, 10);

    const result: SearchResult = {
      provisions: finalProvisions,
      total: filteredProvisions.length,
      duration: performance.now() - startTime,
      search_criteria: criteria
    };

    this.lruCache.set(cacheKey, result);
    return result;
  }

  // 关键词检索
  private searchByKeywords(keywords: string[]): Set<string> {
    if (keywords.length === 0) {
      return new Set(this.provisions.map(p => p.id));
    }

    const matchingIds = new Set<string>();
    
    for (const keyword of keywords) {
      const lowerKeyword = keyword.toLowerCase();
      
      if (this.keywordIndex.has(lowerKeyword)) {
        const provisionIds = this.keywordIndex.get(lowerKeyword);
        if (provisionIds) {
          for (const id of provisionIds) {
            matchingIds.add(id);
          }
        }
      }
    }

    return matchingIds;
  }

  // 相关性排序
  private sortByRelevance(provisions: LegalProvision[], criteria: SearchCriteria): LegalProvision[] {
    if (provisions.length <= 1) return provisions;

    return [...provisions].sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      if (criteria.keywords && criteria.keywords.length > 0) {
        for (const keyword of criteria.keywords) {
          const lowerKeyword = keyword.toLowerCase();
          
          if (a.content.toLowerCase().includes(lowerKeyword)) scoreA += 5;
          if (b.content.toLowerCase().includes(lowerKeyword)) scoreB += 5;
          
          if (a.law_name.toLowerCase().includes(lowerKeyword)) scoreA += 3;
          if (b.law_name.toLowerCase().includes(lowerKeyword)) scoreB += 3;
        }
      }

      const levelA = this.getLawLevel(a.law_name);
      const levelB = this.getLawLevel(b.law_name);
      scoreA += levelA * 0.8;
      scoreB += levelB * 0.8;

      if (a.status === 'active') scoreA += 6;
      if (b.status === 'active') scoreB += 6;

      return scoreB - scoreA;
    });
  }

  // 获取法律效力等级
  private getLawLevel(lawName: string): number {
    for (const [levelKey, levelScore] of this.lawLevelMap) {
      if (lawName.includes(levelKey)) {
        return levelScore;
      }
    }
    return this.lawLevelMap.get('其他')!;
  }

  // 公开方法
  public getInitialized(): boolean {
    return this.isInitialized;
  }

  public async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  public getById(id: string): LegalProvision | undefined {
    return this.provisionMap.get(id);
  }

  public getAllProvisions(): LegalProvision[] {
    return [...this.provisions];
  }

  public getTotalCount(): number {
    return this.provisions.length;
  }

  public getSystemStatus() {
    return {
      data_directory: this.dataDirectory,
      total_provisions: this.provisions.length,
      index_size: {
        keyword_index: this.keywordIndex.size,
        clause_index: this.clauseIndex.size,
        provision_map: this.provisionMap.size
      },
      last_update: this.lastUpdateTime,
      database_initialized: this.isDatabaseInitialized,
      initialized: this.isInitialized
    };
  }
}

// 获取法律条文库路径
let LEGAL_DOCUMENTS_DIR = process.env.LEGAL_DOCUMENTS_DIR || '';

if (process.env.NODE_ENV === 'production') {
  if (process.platform === 'win32') {
    LEGAL_DOCUMENTS_DIR = LEGAL_DOCUMENTS_DIR || 'E:/法律合规审查/法律条文库';
  } else if (process.platform === 'darwin') {
    LEGAL_DOCUMENTS_DIR = LEGAL_DOCUMENTS_DIR || '/法律条文库';
  } else {
    LEGAL_DOCUMENTS_DIR = LEGAL_DOCUMENTS_DIR || '/法律条文库';
  }
} else {
  LEGAL_DOCUMENTS_DIR = LEGAL_DOCUMENTS_DIR || 'E:/法律合规审查/法律条文库';
}

// 导出单例
export const optimizedLegalLibrary = new OptimizedLocalLegalLibrary(LEGAL_DOCUMENTS_DIR);

// 初始化
console.log('Optimized legal library instance created');
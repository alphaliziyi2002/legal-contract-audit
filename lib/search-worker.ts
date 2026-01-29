// 搜索Worker Thread实现
import { parentPort, workerData } from 'worker_threads';
import { LegalProvision, SearchCriteria, SearchResult } from './local-legal-library';

// 模拟搜索逻辑（实际应导入完整的搜索实现）
function performSearch(
  provisions: LegalProvision[],
  searchByKeywords: (keywords: string[], keywordIndex: Map<string, Set<string>>) => Set<string>,
  searchByClauseNumber: (clauseNumber: string, clauseIndex: Map<string, LegalProvision>) => LegalProvision | undefined,
  sortByRelevance: (provisions: LegalProvision[], criteria: SearchCriteria, lawLevelMap: Map<string, number>) => LegalProvision[],
  criteria: SearchCriteria,
  keywordIndex: Map<string, Set<string>>,
  clauseIndex: Map<string, LegalProvision>,
  lawLevelMap: Map<string, number>
): SearchResult {
  const startTime = performance.now();
  let filteredProvisions = [...provisions];

  // 关键词检索
  if (criteria.keywords && criteria.keywords.length > 0) {
    const matchingIds = searchByKeywords(criteria.keywords, keywordIndex);
    filteredProvisions = filteredProvisions.filter(p => matchingIds.has(p.id));
  }

  // 条款编号精确查询
  if (criteria.clause_number) {
    const exactMatch = searchByClauseNumber(criteria.clause_number, clauseIndex);
    if (exactMatch) {
      filteredProvisions = [exactMatch];
    } else {
      filteredProvisions = [];
    }
  }

  // 法律名称过滤
  if (criteria.law_name) {
    filteredProvisions = filteredProvisions.filter(p => 
      p.law_name.includes(criteria.law_name!)
    );
  }

  // 发布机关过滤
  if (criteria.issuing_authority) {
    filteredProvisions = filteredProvisions.filter(p =>
      p.issuing_authority && p.issuing_authority.includes(criteria.issuing_authority!)
    );
  }

  // 生效日期过滤
  if (criteria.effective_date_from) {
    filteredProvisions = filteredProvisions.filter(p => 
      p.effective_date && p.effective_date >= criteria.effective_date_from!
    );
  }

  if (criteria.effective_date_to) {
    filteredProvisions = filteredProvisions.filter(p =>
      p.effective_date && p.effective_date <= criteria.effective_date_to!
    );
  }

  // 状态过滤
  if (criteria.status) {
    filteredProvisions = filteredProvisions.filter(p => p.status === criteria.status);
  }

  // 分类过滤
  if (criteria.category) {
    filteredProvisions = filteredProvisions.filter(p => p.category === criteria.category);
  }

  // 排序（相关性排序）
  const sortedProvisions = sortByRelevance(filteredProvisions, criteria, lawLevelMap);

  // Top-K限制，默认返回前10条
  const topK = 10;
  const finalProvisions = sortedProvisions.slice(0, topK);

  return {
    provisions: finalProvisions,
    total: sortedProvisions.length,
    duration: performance.now() - startTime,
    search_criteria: criteria
  };
}

// 监听主线程消息
parentPort?.on('message', (message) => {
  if (message.type === 'search') {
    const { provisions, criteria, keywordIndex, clauseIndex, lawLevelMap, searchByKeywords, searchByClauseNumber, sortByRelevance } = message.data;
    
    // 执行搜索
    const result = performSearch(
      provisions,
      searchByKeywords,
      searchByClauseNumber,
      sortByRelevance,
      criteria,
      new Map(Object.entries(keywordIndex)),
      new Map(Object.entries(clauseIndex)),
      new Map(Object.entries(lawLevelMap))
    );
    
    // 发送结果回主线程
    parentPort?.postMessage({ type: 'result', data: result });
  }
});

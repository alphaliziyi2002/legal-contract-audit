// 数据库管理系统 - 内存存储版本（优化版）

// 法律条文接口
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

// 审计日志接口
export interface AuditLog {
  id?: number;
  user_id: string;
  action: 'create' | 'update' | 'delete' | 'load_backdoor';
  provision_id?: string;
  timestamp: string;
  details?: string;
}

// 用户接口
export interface User {
  id: string;
  username: string;
  is_authorized: number;
}

// 数据库服务类 - 优化版
class DatabaseService {
  private provisions: LegalProvision[] = [];
  private provisionIndex: Map<string, number> = new Map(); // ID 到索引的映射
  private auditLogs: AuditLog[] = [];
  private users: User[] = [];
  private initialized: boolean = false;
  private initializationTime: number = 0;

  // 初始化数据库
  async initialize(): Promise<void> {
    try {
      // 初始化管理员用户
      await this.initializeAdminUser();
      
      this.initialized = true;
      this.initializationTime = Date.now();
      console.log('In-memory database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  // 初始化管理员用户
  private async initializeAdminUser(): Promise<void> {
    // 检查管理员用户是否已存在
    const existingUser = this.users.find(user => user.username === '我');

    if (!existingUser) {
      // 创建管理员用户，is_authorized = 1 表示授权
      this.users.push({
        id: 'admin-001',
        username: '我',
        is_authorized: 1
      });
      console.log('Admin user created successfully');
    }
  }

  // 检查用户是否授权
  async isAuthorizedUser(username: string): Promise<boolean> {
    if (!this.initialized) throw new Error('Database not initialized');

    const user = this.users.find(
      user => user.username === username && user.is_authorized === 1
    );

    return !!user;
  }

  // 创建法律条文
  async createProvision(provision: LegalProvision): Promise<void> {
    if (!this.initialized) throw new Error('Database not initialized');

    // 使用索引快速查找
    const existingIndex = this.provisionIndex.get(provision.id);
    
    if (existingIndex !== undefined) {
      // 更新现有条文
      this.provisions[existingIndex] = provision;
    } else {
      // 添加新条文
      const newIndex = this.provisions.length;
      this.provisions.push(provision);
      this.provisionIndex.set(provision.id, newIndex);
    }
  }

  // 批量创建法律条文（优化性能）
  async batchCreateProvisions(provisions: LegalProvision[]): Promise<{
    inserted: number;
    updated: number;
    errors: number;
    duration: number;
  }> {
    if (!this.initialized) throw new Error('Database not initialized');

    const startTime = Date.now();
    let inserted = 0;
    let updated = 0;
    let errors = 0;

    for (const provision of provisions) {
      try {
        const existingIndex = this.provisionIndex.get(provision.id);
        
        if (existingIndex !== undefined) {
          // 更新现有条文
          this.provisions[existingIndex] = provision;
          updated++;
        } else {
          // 添加新条文
          const newIndex = this.provisions.length;
          this.provisions.push(provision);
          this.provisionIndex.set(provision.id, newIndex);
          inserted++;
        }
      } catch (error) {
        errors++;
        console.error(`Error inserting provision ${provision.id}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`Batch insert completed in ${duration}ms: ${inserted} inserted, ${updated} updated, ${errors} errors`);
    
    return { inserted, updated, errors, duration };
  }

  // 获取所有法律条文
  async getAllProvisions(): Promise<LegalProvision[]> {
    if (!this.initialized) throw new Error('Database not initialized');
    // 返回副本，避免外部修改
    return [...this.provisions];
  }

  // 根据ID获取法律条文
  async getProvisionById(id: string): Promise<LegalProvision | null> {
    if (!this.initialized) throw new Error('Database not initialized');

    // 使用索引快速查找
    const index = this.provisionIndex.get(id);
    if (index !== undefined) {
      return { ...this.provisions[index] }; // 返回副本
    }
    return null;
  }

  // 更新法律条文
  async updateProvision(provision: LegalProvision): Promise<void> {
    if (!this.initialized) throw new Error('Database not initialized');

    const index = this.provisionIndex.get(provision.id);
    if (index !== undefined) {
      this.provisions[index] = provision;
    } else {
      throw new Error(`Provision with id ${provision.id} not found`);
    }
  }

  // 删除法律条文
  async deleteProvision(id: string): Promise<void> {
    if (!this.initialized) throw new Error('Database not initialized');

    const index = this.provisionIndex.get(id);
    if (index !== undefined) {
      // 移除索引
      this.provisionIndex.delete(id);
      // 移除数组中的元素
      this.provisions.splice(index, 1);
      
      // 重建索引（因为删除后索引会变化）
      this.rebuildIndex();
    }
  }

  // 重建索引
  private rebuildIndex(): void {
    this.provisionIndex.clear();
    for (let i = 0; i < this.provisions.length; i++) {
      this.provisionIndex.set(this.provisions[i].id, i);
    }
  }

  // 批量删除法律条文
  async batchDeleteProvisions(ids: string[]): Promise<{
    deleted: number;
    errors: number;
  }> {
    if (!this.initialized) throw new Error('Database not initialized');

    let deleted = 0;
    let errors = 0;
    const idsToDelete = new Set(ids);

    // 过滤出要保留的条文
    const newProvisions = this.provisions.filter(provision => {
      if (idsToDelete.has(provision.id)) {
        deleted++;
        return false;
      }
      return true;
    });

    // 更新数组和索引
    this.provisions = newProvisions;
    this.rebuildIndex();

    return { deleted, errors };
  }

  // 添加审计日志
  async addAuditLog(log: AuditLog): Promise<void> {
    if (!this.initialized) throw new Error('Database not initialized');

    const newLog: AuditLog = {
      ...log,
      id: this.auditLogs.length + 1
    };
    this.auditLogs.push(newLog);
  }

  // 获取审计日志
  async getAuditLogs(limit: number = 100, offset: number = 0): Promise<AuditLog[]> {
    if (!this.initialized) throw new Error('Database not initialized');

    return this.auditLogs
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(offset, offset + limit);
  }

  // 执行查询（模拟SQL查询）
  async executeQuery(query: string, params: any[] = []): Promise<any[]> {
    if (!this.initialized) throw new Error('Database not initialized');

    // 简单的查询模拟
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('select') && lowerQuery.includes('legal_provisions')) {
      return this.provisions;
    } else if (lowerQuery.includes('select') && lowerQuery.includes('audit_logs')) {
      return this.auditLogs;
    } else if (lowerQuery.includes('select') && lowerQuery.includes('users')) {
      return this.users;
    } else if (lowerQuery.includes('delete') && lowerQuery.includes('legal_provisions')) {
      // 处理 DELETE 查询
      await this.clearProvisions();
      return [{ deleted: this.provisions.length }];
    }
    return [];
  }

  // 清除所有法律条文
  async clearProvisions(): Promise<void> {
    this.provisions = [];
    this.provisionIndex.clear();
  }

  // 关闭数据库连接
  async close(): Promise<void> {
    console.log('Database connection closed (in-memory storage)');
  }

  // 检查数据库是否初始化
  isInitialized(): boolean {
    return this.initialized;
  }

  // 获取数据库统计信息
  getStats(): {
    provisionsCount: number;
    auditLogsCount: number;
    usersCount: number;
    initializedTime: number;
    uptime: number;
  } {
    return {
      provisionsCount: this.provisions.length,
      auditLogsCount: this.auditLogs.length,
      usersCount: this.users.length,
      initializedTime: this.initializationTime,
      uptime: Date.now() - this.initializationTime,
    };
  }

  // 清空所有数据（用于测试）
  async clearAllData(): Promise<void> {
    this.provisions = [];
    this.provisionIndex.clear();
    this.auditLogs = [];
    this.users = [];
    await this.initializeAdminUser();
  }
}

// 导出单例实例
export const databaseService = new DatabaseService();
// 备份服务

import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execPromise = promisify(exec);

// 备份配置
const BACKUP_CONFIG = {
  // 备份目录
  BACKUP_DIR: path.join(process.cwd(), 'backups'),
  // 数据库文件路径
  DB_PATH: path.join(process.cwd(), 'legal-library.db'),
  // 备份保留数量（最多保留10个备份）
  MAX_BACKUPS: 10,
  // 备份文件扩展名
  BACKUP_EXTENSION: '.bak',
};

// 确保备份目录存在
const ensureBackupDir = (): void => {
  if (!fs.existsSync(BACKUP_CONFIG.BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_CONFIG.BACKUP_DIR, { recursive: true });
    console.log('Created backup directory:', BACKUP_CONFIG.BACKUP_DIR);
  }
};

// 生成备份文件名
const generateBackupFilename = (): string => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `legal-library-${timestamp}${BACKUP_CONFIG.BACKUP_EXTENSION}`;
};

// 获取所有备份文件，按创建时间排序（最新的在前面）
const getBackupFiles = (): string[] => {
  ensureBackupDir();
  
  const files = fs.readdirSync(BACKUP_CONFIG.BACKUP_DIR);
  const backupFiles = files
    .filter(file => file.endsWith(BACKUP_CONFIG.BACKUP_EXTENSION))
    .map(file => ({
      name: file,
      path: path.join(BACKUP_CONFIG.BACKUP_DIR, file),
      mtime: fs.statSync(path.join(BACKUP_CONFIG.BACKUP_DIR, file)).mtime.getTime(),
    }))
    .sort((a, b) => b.mtime - a.mtime)
    .map(file => file.path);
  
  return backupFiles;
};

// 删除旧备份，保留最新的N个
const cleanupOldBackups = (): void => {
  const backupFiles = getBackupFiles();
  
  if (backupFiles.length > BACKUP_CONFIG.MAX_BACKUPS) {
    const oldBackups = backupFiles.slice(BACKUP_CONFIG.MAX_BACKUPS);
    
    for (const backupFile of oldBackups) {
      fs.unlinkSync(backupFile);
      console.log('Deleted old backup:', backupFile);
    }
  }
};

// 创建数据库备份
const createBackup = async (): Promise<string> => {
  ensureBackupDir();
  
  const backupFilename = generateBackupFilename();
  const backupPath = path.join(BACKUP_CONFIG.BACKUP_DIR, backupFilename);
  
  try {
    // 检查数据库文件是否存在
    if (!fs.existsSync(BACKUP_CONFIG.DB_PATH)) {
      throw new Error(`Database file not found: ${BACKUP_CONFIG.DB_PATH}`);
    }
    
    // 使用SQLite命令行工具创建备份
    // 注意：需要确保sqlite3命令可用，或者使用文件复制作为备选方案
    try {
      // 尝试使用sqlite3命令进行备份
      await execPromise(`sqlite3 ${BACKUP_CONFIG.DB_PATH} ".backup '${backupPath}'"`);
      console.log('Created backup using sqlite3 command:', backupPath);
    } catch (error) {
      console.warn('SQLite3 command failed, falling back to file copy:', error);
      // 备选方案：直接复制文件
      fs.copyFileSync(BACKUP_CONFIG.DB_PATH, backupPath);
      console.log('Created backup using file copy:', backupPath);
    }
    
    // 清理旧备份
    cleanupOldBackups();
    
    console.log('Backup created successfully:', backupPath);
    return backupPath;
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
};

// 从备份恢复数据库
const restoreFromBackup = async (backupPath: string): Promise<void> => {
  try {
    // 检查备份文件是否存在
    if (!fs.existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
      return;
    }
    
    // 检查备份文件是否是有效的SQLite数据库
    const stats = fs.statSync(backupPath);
    if (stats.size === 0) {
      throw new Error(`Backup file is empty: ${backupPath}`);
      return;
    }
    
    // 停止应用程序对数据库的访问（简化实现，实际应确保没有进程在使用数据库）
    
    // 备份当前数据库（以防恢复失败）
    const currentBackupPath = `${BACKUP_CONFIG.DB_PATH}.current.bak`;
    if (fs.existsSync(BACKUP_CONFIG.DB_PATH)) {
      fs.copyFileSync(BACKUP_CONFIG.DB_PATH, currentBackupPath);
      console.log('Created temporary backup of current database:', currentBackupPath);
    }
    
    try {
      // 尝试使用sqlite3命令进行恢复
      await execPromise(`sqlite3 ${BACKUP_CONFIG.DB_PATH} ".restore '${backupPath}'"`);
      console.log('Restored database using sqlite3 command:', backupPath);
    } catch (error) {
      console.warn('SQLite3 restore failed, falling back to file copy:', error);
      // 备选方案：直接复制文件
      fs.copyFileSync(backupPath, BACKUP_CONFIG.DB_PATH);
      console.log('Restored database using file copy:', backupPath);
    }
    
    // 验证恢复后的数据库
    try {
      await execPromise(`sqlite3 ${BACKUP_CONFIG.DB_PATH} "PRAGMA integrity_check;"`);
      console.log('Database integrity check passed after restore');
    } catch (error) {
      console.error('Database integrity check failed after restore:', error);
      // 如果恢复失败，尝试恢复原始数据库
      if (fs.existsSync(currentBackupPath)) {
        fs.copyFileSync(currentBackupPath, BACKUP_CONFIG.DB_PATH);
        console.log('Restored original database due to integrity check failure');
      }
      throw new Error('Database integrity check failed after restore');
    }
    
    // 删除临时备份
    if (fs.existsSync(currentBackupPath)) {
      fs.unlinkSync(currentBackupPath);
      console.log('Deleted temporary backup');
    }
    
    console.log('Database restored successfully from:', backupPath);
  } catch (error) {
    console.error('Error restoring backup:', error);
    throw error;
  }
};

// 获取备份统计信息
const getBackupStats = (): {
  total: number;
  latest?: string;
  oldest?: string;
  totalSize: number;
} => {
  const backupFiles = getBackupFiles();
  
  let totalSize = 0;
  for (const file of backupFiles) {
    totalSize += fs.statSync(file).size;
  }
  
  return {
    total: backupFiles.length,
    latest: backupFiles.length > 0 ? path.basename(backupFiles[0]) : undefined,
    oldest: backupFiles.length > 0 ? path.basename(backupFiles[backupFiles.length - 1]) : undefined,
    totalSize,
  };
};

// 执行定期备份任务
const performScheduledBackup = async (): Promise<void> => {
  try {
    const backupPath = await createBackup();
    console.log('Scheduled backup completed:', backupPath);
  } catch (error) {
    console.error('Scheduled backup failed:', error);
  }
};

// 备份服务类
export class BackupService {
  // 创建备份
  static async createBackup(): Promise<string> {
    return await createBackup();
  }
  
  // 从备份恢复
  static async restoreFromBackup(backupPath: string): Promise<void> {
    return await restoreFromBackup(backupPath);
  }
  
  // 获取所有备份文件
  static getBackupFiles(): string[] {
    return getBackupFiles();
  }
  
  // 获取备份统计信息
  static getBackupStats(): {
    total: number;
    latest?: string;
    oldest?: string;
    totalSize: number;
  } {
    return getBackupStats();
  }
  
  // 执行定期备份
  static async performScheduledBackup(): Promise<void> {
    return await performScheduledBackup();
  }
  
  // 删除备份
  static deleteBackup(backupPath: string): void {
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
      console.log('Deleted backup:', backupPath);
    }
  }
  
  // 清理旧备份
  static cleanupOldBackups(): void {
    cleanupOldBackups();
  }
}

// 导出默认实例
export const backupService = BackupService;

// 安全验证和数据准确性保障工具

import crypto from 'crypto';

// 数据验证接口
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// 文件验证配置
export interface FileValidationConfig {
  maxFileSize: number;
  acceptedTypes: string[];
  maxFileNameLength: number;
  allowedEncoding: string[];
}

// 文本验证配置
export interface TextValidationConfig {
  maxLength: number;
  minLength: number;
  allowedCharacters: RegExp;
  suspiciousPatterns: RegExp[];
}

// 默认配置
export const DEFAULT_FILE_CONFIG: FileValidationConfig = {
  maxFileSize: 10 * 1024 * 1024, // 10MB
  acceptedTypes: ['.pdf', '.docx', '.txt'],
  maxFileNameLength: 255,
  allowedEncoding: ['utf-8', 'gbk', 'gb2312'],
};

export const DEFAULT_TEXT_CONFIG: TextValidationConfig = {
  maxLength: 10 * 1024 * 1024, // 10MB
  minLength: 1,
  allowedCharacters: /^[\s\S]*$/, // 允许所有字符
  suspiciousPatterns: [
    /<script[\s>]/gi, // 脚本注入
    /javascript:/gi, // JavaScript 协议
    /on\w+=/gi, // 事件处理器
    /eval\s*\(/gi, // eval 函数
    /document\.cookie/gi, // Cookie 访问
    /SELECT\s+.*\s+FROM/gi, // SQL 注入
    /'\s*OR\s+'.*'=/gi, // SQL 注入
  ],
};

// 安全验证工具类
export class SecurityValidator {
  // 验证文件名
  static validateFileName(fileName: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查文件名长度
    if (fileName.length > 255) {
      errors.push('文件名过长');
    }

    // 检查文件名是否包含危险字符
    const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/g;
    if (dangerousChars.test(fileName)) {
      errors.push('文件名包含危险字符');
    }

    // 检查文件扩展名
    const ext = '.' + fileName.split('.').pop()?.toLowerCase();
    if (!DEFAULT_FILE_CONFIG.acceptedTypes.includes(ext)) {
      errors.push(`不支持的文件类型: ${ext}`);
    }

    // 检查文件名是否可疑
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      warnings.push('文件名包含路径遍历字符');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // 验证文件大小
  static validateFileSize(fileSize: number): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (fileSize === 0) {
      errors.push('文件为空');
    }

    if (fileSize > DEFAULT_FILE_CONFIG.maxFileSize) {
      errors.push(`文件大小超过限制: ${fileSize} > ${DEFAULT_FILE_CONFIG.maxFileSize}`);
    }

    if (fileSize < 100) {
      warnings.push('文件过小，可能不是有效的文档');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // 验证文件内容类型
  static validateFileType(buffer: Buffer, mimeType: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查文件头签名
    const fileSignatures: Record<string, string[]> = {
      'application/pdf': ['25504446'], // %PDF
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['504b0304'], // PK
      'text/plain': ['efbbbf', 'fffffffe', '0000feff', 'fffe0000'], // BOM
    };

    const expectedSignature = fileSignatures[mimeType];
    if (expectedSignature) {
      const fileHeader = buffer.slice(0, 4).toString('hex').toLowerCase();
      const isValidSignature = expectedSignature.some(sig => 
        fileHeader.startsWith(sig.toLowerCase())
      );

      if (!isValidSignature) {
        warnings.push('文件头签名与声明的 MIME 类型不匹配');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // 验证文本内容
  static validateTextContent(
    text: string, 
    config: TextValidationConfig = DEFAULT_TEXT_CONFIG
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查文本长度
    if (text.length < config.minLength) {
      errors.push('文本内容过短');
    }

    if (text.length > config.maxLength) {
      errors.push('文本内容过长');
    }

    // 检查可疑模式
    for (const pattern of config.suspiciousPatterns) {
      if (pattern.test(text)) {
        warnings.push(`检测到可疑模式: ${pattern.toString()}`);
      }
    }

    // 检查控制字符
    const controlChars = text.replace(/[\t\n\r]/g, '');
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(controlChars)) {
      warnings.push('文本包含控制字符');
    }

    // 检查是否全为空白
    if (/^\s*$/.test(text)) {
      warnings.push('文本只包含空白字符');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // 验证 JSON 数据
  static validateJsonData(data: any, requiredFields: string[] = []): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 检查数据类型
    if (typeof data !== 'object' || data === null) {
      errors.push('数据必须是对象类型');
      return { isValid: false, errors, warnings };
    }

    // 检查必需字段
    for (const field of requiredFields) {
      if (!(field in data)) {
        errors.push(`缺少必需字段: ${field}`);
      }
    }

    // 检查字段类型
    if ('text' in data && typeof data.text !== 'string') {
      errors.push('text 字段必须是字符串类型');
    }

    if ('fileName' in data && typeof data.fileName !== 'string') {
      errors.push('fileName 字段必须是字符串类型');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}

// 数据完整性工具类
export class DataIntegrityChecker {
  // 计算数据的哈希值
  static computeHash(data: string | Buffer): string {
    const hash = crypto.createHash('sha256');
    hash.update(data);
    return hash.digest('hex');
  }

  // 验证数据完整性
  static verifyIntegrity(data: string | Buffer, expectedHash: string): boolean {
    const actualHash = this.computeHash(data);
    return actualHash === expectedHash;
  }

  // 生成数据校验码
  static generateChecksum(data: string | Buffer): string {
    const hash = crypto.createHash('md5');
    hash.update(data);
    return hash.digest('hex');
  }

  // 创建数据快照
  static createSnapshot(data: any): {
    hash: string;
    checksum: string;
    timestamp: number;
    dataSize: number;
  } {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return {
      hash: this.computeHash(dataString),
      checksum: this.generateChecksum(dataString),
      timestamp: Date.now(),
      dataSize: Buffer.byteLength(dataString, 'utf8'),
    };
  }

  // 验证数据快照
  static verifySnapshot(
    data: any, 
    snapshot: { hash: string; checksum: string }
  ): {
    hashValid: boolean;
    checksumValid: boolean;
  } {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return {
      hashValid: this.verifyIntegrity(dataString, snapshot.hash),
      checksumValid: this.verifyIntegrity(dataString, snapshot.checksum),
    };
  }
}

// 内容消毒工具
export class ContentSanitizer {
  // 移除危险内容
  static sanitizeHtml(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
      .replace(/on\w+="[^"]*"/gi, '')
      .replace(/on\w+='[^']*'/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/data:/gi, 'data-blocked:');
  }

  // 标准化文本
  static normalizeText(text: string): string {
    return text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\t/g, '    ')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }

  // 移除多余空白
  static removeExtraWhitespace(text: string): string {
    return text
      .replace(/\n\s*\n/g, '\n\n') // 保留段落分隔
      .replace(/[ \t]+/g, ' ')
      .trim();
  }
}

// 请求安全中间件
export function createSecurityMiddleware() {
  return {
    // 检查请求来源
    checkOrigin: (origin: string | undefined): boolean => {
      // 在开发环境中允许所有来源
      if (process.env.NODE_ENV !== 'production') {
        return true;
      }
      
      // 在生产环境中检查来源
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
      if (!origin) return false;
      
      return allowedOrigins.some(allowed => 
        origin.trim() === allowed.trim() || 
        new RegExp(allowed.trim().replace('*', '.*')).test(origin)
      );
    },

    // 限制请求频率
    checkRateLimit: (key: string, limit: number, windowMs: number): boolean => {
      // 简化的频率限制检查
      // 在实际应用中应该使用 Redis 或其他分布式存储
      return true;
    },

    // 验证请求大小
    checkRequestSize: (contentLength: number, maxSize: number): boolean => {
      return contentLength <= maxSize;
    },

    // 安全响应头
    getSecurityHeaders: () => ({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'",
    }),
  };
}

// 导出默认实例
export const securityValidator = new SecurityValidator();
export const dataIntegrityChecker = new DataIntegrityChecker();
export const contentSanitizer = new ContentSanitizer();
export const securityMiddleware = createSecurityMiddleware();
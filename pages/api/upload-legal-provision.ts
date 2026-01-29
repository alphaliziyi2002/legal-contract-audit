import { NextApiRequest, NextApiResponse } from 'next';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { localLegalLibrary } from '@/lib/local-legal-library';
import { databaseService } from '@/lib/database';

// 错误码定义
const ERROR_CODES = {
  SUCCESS: 200,
  BAD_REQUEST: 400,
  INTERNAL_ERROR: 500,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  RATE_LIMIT_EXCEEDED: 429,
};

// 错误信息定义
const ERROR_MESSAGES = {
  [ERROR_CODES.SUCCESS]: '请求成功',
  [ERROR_CODES.BAD_REQUEST]: '请求参数错误',
  [ERROR_CODES.INTERNAL_ERROR]: '内部服务器错误',
  [ERROR_CODES.NOT_FOUND]: '未找到相关法律条文',
  [ERROR_CODES.UNAUTHORIZED]: '未授权访问',
  [ERROR_CODES.RATE_LIMIT_EXCEEDED]: '请求频率过高，请稍后重试',
};

// API响应格式
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  request_id: string;
  timestamp: number;
}

// 允许的文件类型
const ALLOWED_FILE_TYPES = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf', 'text/plain'];
const ALLOWED_EXTENSIONS = ['.docx', '.pdf', '.txt'];

// 数据目录
const DATA_DIR = 'E:\\\\法律条文库';

export default async function handler(
  req: NextApiRequest, 
  res: NextApiResponse<ApiResponse<any>>
) {
  // 生成请求ID
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = Date.now();

  try {
    // 只允许POST请求
    if (req.method !== 'POST') {
      return res.status(ERROR_CODES.BAD_REQUEST).json({
        code: ERROR_CODES.BAD_REQUEST,
        message: '只支持POST请求',
        data: null,
        request_id: requestId,
        timestamp,
      });
    }

    // 验证授权（简化实现，实际应使用更严格的认证）
    const { username } = req.body;
    if (!username || username !== '我') {
      return res.status(ERROR_CODES.UNAUTHORIZED).json({
        code: ERROR_CODES.UNAUTHORIZED,
        message: ERROR_MESSAGES[ERROR_CODES.UNAUTHORIZED],
        data: null,
        request_id: requestId,
        timestamp,
      });
    }

    // 检查请求体
    if (!req.body.fileContent || !req.body.fileName) {
      return res.status(ERROR_CODES.BAD_REQUEST).json({
        code: ERROR_CODES.BAD_REQUEST,
        message: '缺少必要参数：fileContent或fileName',
        data: null,
        request_id: requestId,
        timestamp,
      });
    }

    const { fileContent, fileName } = req.body;
    
    // 验证文件扩展名
    const fileExtension = path.extname(fileName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
      return res.status(ERROR_CODES.BAD_REQUEST).json({
        code: ERROR_CODES.BAD_REQUEST,
        message: `不支持的文件类型，仅允许上传${ALLOWED_EXTENSIONS.join(', ')}格式的文件`,
        data: null,
        request_id: requestId,
        timestamp,
      });
    }

    // 确保数据目录存在
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }

    // 保存文件
    const filePath = path.join(DATA_DIR, fileName);
    
    // 解析Base64内容
    const buffer = Buffer.from(fileContent, 'base64');
    writeFileSync(filePath, buffer);
    
    console.log(`File saved to: ${filePath}`);

    // 解析文件并添加到数据库
    await localLegalLibrary.fullUpdate();
    
    // 返回成功响应
    return res.status(ERROR_CODES.SUCCESS).json({
      code: ERROR_CODES.SUCCESS,
      message: '法律条文文件上传成功',
      data: { fileName, filePath },
      request_id: requestId,
      timestamp,
    });
  } catch (error) {
    console.error('Error uploading legal provision:', error);
    return res.status(ERROR_CODES.INTERNAL_ERROR).json({
      code: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR],
      data: null,
      request_id: requestId,
      timestamp,
    });
  }
}

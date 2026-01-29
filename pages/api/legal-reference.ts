import { NextApiRequest, NextApiResponse } from 'next';
import { localLegalLibrary } from '@/lib/local-legal-library';
import { SearchCriteria, LegalProvision } from '@/lib/local-legal-library';
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

// 限流计数器
let requestCounter = 0;
const MAX_REQUESTS_PER_MINUTE = 600; // 每分钟最多600个请求
let lastResetTime = Date.now();

// 重置限流计数器
const resetRateLimit = () => {
  const now = Date.now();
  if (now - lastResetTime > 60 * 1000) {
    requestCounter = 0;
    lastResetTime = now;
  }
};

// 检查限流
const checkRateLimit = (): boolean => {
  resetRateLimit();
  if (requestCounter >= MAX_REQUESTS_PER_MINUTE) {
    return false;
  }
  requestCounter++;
  return true;
};

// 验证授权用户
const validateUser = async (username: string): Promise<boolean> => {
  return await databaseService.isAuthorizedUser(username);
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ApiResponse<any>>
) {
  // 生成请求ID
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const timestamp = Date.now();

  try {
    // 检查限流
    if (!checkRateLimit()) {
      return res.status(ERROR_CODES.RATE_LIMIT_EXCEEDED).json({
        code: ERROR_CODES.RATE_LIMIT_EXCEEDED,
        message: ERROR_MESSAGES[ERROR_CODES.RATE_LIMIT_EXCEEDED],
        data: null,
        request_id: requestId,
        timestamp,
      });
    }

    if (req.method !== 'POST') {
      return res.status(ERROR_CODES.BAD_REQUEST).json({
        code: ERROR_CODES.BAD_REQUEST,
        message: '只支持POST请求',
        data: null,
        request_id: requestId,
        timestamp,
      });
    }

    const { action, params } = req.body;

    switch (action) {
      case 'search':
        // 关键词检索
        return handleSearch(params, res, requestId, timestamp);

      case 'getById':
        // 按ID获取
        return handleGetById(params, res, requestId, timestamp);

      case 'getSystemStatus':
        // 获取系统状态
        return handleGetSystemStatus(res, requestId, timestamp);

      case 'update':
        // 更新法律文库
        return handleUpdate(params, res, requestId, timestamp);

      case 'createProvision':
        // 创建法律条文
        return handleCreateProvision(params, res, requestId, timestamp);

      case 'updateProvision':
        // 更新法律条文
        return handleUpdateProvision(params, res, requestId, timestamp);

      case 'deleteProvision':
        // 删除法律条文
        return handleDeleteProvision(params, res, requestId, timestamp);

      case 'getAuditLogs':
        // 获取审计日志
        return handleGetAuditLogs(params, res, requestId, timestamp);

      case 'loadBackdoor':
        // 后门加载内容
        return handleLoadBackdoor(params, res, requestId, timestamp);

      default:
        return res.status(ERROR_CODES.BAD_REQUEST).json({
          code: ERROR_CODES.BAD_REQUEST,
          message: '无效的操作类型',
          data: null,
          request_id: requestId,
          timestamp,
        });
    }
  } catch (error) {
    console.error('Error handling legal reference request:', error);
    return res.status(ERROR_CODES.INTERNAL_ERROR).json({
      code: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR],
      data: null,
      request_id: requestId,
      timestamp,
    });
  }
}

// 处理搜索请求
async function handleSearch(
  params: any,
  res: NextApiResponse<ApiResponse<any>>,
  requestId: string,
  timestamp: number
) {
  const { keywords, clause_number, law_name, issuing_authority, effective_date_from, effective_date_to, status, category } = params;

  // 构建搜索条件
  const criteria: SearchCriteria = {};

  if (keywords && Array.isArray(keywords) && keywords.length > 0) {
    criteria.keywords = keywords;
  }

  if (clause_number) {
    criteria.clause_number = clause_number;
  }

  if (law_name) {
    criteria.law_name = law_name;
  }

  if (issuing_authority) {
    criteria.issuing_authority = issuing_authority;
  }

  if (effective_date_from) {
    criteria.effective_date_from = effective_date_from;
  }

  if (effective_date_to) {
    criteria.effective_date_to = effective_date_to;
  }

  if (status) {
    criteria.status = status;
  }

  if (category) {
    criteria.category = category;
  }

  // 调用本地法律文库进行搜索
  const result = await localLegalLibrary.search(criteria);

  if (result.provisions.length === 0) {
    return res.status(ERROR_CODES.NOT_FOUND).json({
      code: ERROR_CODES.NOT_FOUND,
      message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND],
      data: result,
      request_id: requestId,
      timestamp,
    });
  }

  return res.status(ERROR_CODES.SUCCESS).json({
    code: ERROR_CODES.SUCCESS,
    message: ERROR_MESSAGES[ERROR_CODES.SUCCESS],
    data: result,
    request_id: requestId,
    timestamp,
  });
}

// 处理按ID获取请求
async function handleGetById(
  params: any,
  res: NextApiResponse<ApiResponse<any>>,
  requestId: string,
  timestamp: number
) {
  const { id } = params;

  if (!id) {
    return res.status(ERROR_CODES.BAD_REQUEST).json({
      code: ERROR_CODES.BAD_REQUEST,
      message: '缺少必要参数：id',
      data: null,
      request_id: requestId,
      timestamp,
    });
  }

  const provision = localLegalLibrary.getById(id);

  if (!provision) {
    return res.status(ERROR_CODES.NOT_FOUND).json({
      code: ERROR_CODES.NOT_FOUND,
      message: ERROR_MESSAGES[ERROR_CODES.NOT_FOUND],
      data: null,
      request_id: requestId,
      timestamp,
    });
  }

  return res.status(ERROR_CODES.SUCCESS).json({
    code: ERROR_CODES.SUCCESS,
    message: ERROR_MESSAGES[ERROR_CODES.SUCCESS],
    data: provision,
    request_id: requestId,
    timestamp,
  });
}

// 处理获取系统状态请求
async function handleGetSystemStatus(
  res: NextApiResponse<ApiResponse<any>>,
  requestId: string,
  timestamp: number
) {
  const status = localLegalLibrary.getSystemStatus();

  return res.status(ERROR_CODES.SUCCESS).json({
    code: ERROR_CODES.SUCCESS,
    message: ERROR_MESSAGES[ERROR_CODES.SUCCESS],
    data: status,
    request_id: requestId,
    timestamp,
  });
}

// 处理更新请求
async function handleUpdate(
  params: any,
  res: NextApiResponse<ApiResponse<any>>,
  requestId: string,
  timestamp: number
) {
  const { type } = params;

  if (!type || !['full', 'incremental'].includes(type)) {
    return res.status(ERROR_CODES.BAD_REQUEST).json({
      code: ERROR_CODES.BAD_REQUEST,
      message: '无效的更新类型，必须是full或incremental',
      data: null,
      request_id: requestId,
      timestamp,
    });
  }

  if (type === 'full') {
    await localLegalLibrary.fullUpdate();
  } else {
    await localLegalLibrary.incrementalUpdate();
  }

  return res.status(ERROR_CODES.SUCCESS).json({
    code: ERROR_CODES.SUCCESS,
    message: `法律文库${type === 'full' ? '全量' : '增量'}更新成功`,
    data: null,
    request_id: requestId,
    timestamp,
  });
}

// 处理创建法律条文请求
async function handleCreateProvision(
  params: any,
  res: NextApiResponse<ApiResponse<any>>,
  requestId: string,
  timestamp: number
) {
  const { provision, username } = params;

  if (!provision || !username) {
    return res.status(ERROR_CODES.BAD_REQUEST).json({
      code: ERROR_CODES.BAD_REQUEST,
      message: '缺少必要参数：provision或username',
      data: null,
      request_id: requestId,
      timestamp,
    });
  }

  // 验证用户授权
  const isAuthorized = await validateUser(username);
  if (!isAuthorized && username !== 'system') {
    return res.status(ERROR_CODES.UNAUTHORIZED).json({
      code: ERROR_CODES.UNAUTHORIZED,
      message: ERROR_MESSAGES[ERROR_CODES.UNAUTHORIZED],
      data: null,
      request_id: requestId,
      timestamp,
    });
  }

  // 调用创建方法
  const success = await localLegalLibrary.createProvision(provision, username);

  if (success) {
    return res.status(ERROR_CODES.SUCCESS).json({
      code: ERROR_CODES.SUCCESS,
      message: '法律条文创建成功',
      data: { id: provision.id },
      request_id: requestId,
      timestamp,
    });
  } else {
    return res.status(ERROR_CODES.INTERNAL_ERROR).json({
      code: ERROR_CODES.INTERNAL_ERROR,
      message: '法律条文创建失败',
      data: null,
      request_id: requestId,
      timestamp,
    });
  }
}

// 处理更新法律条文请求
async function handleUpdateProvision(
  params: any,
  res: NextApiResponse<ApiResponse<any>>,
  requestId: string,
  timestamp: number
) {
  const { id, updates, username } = params;

  if (!id || !updates || !username) {
    return res.status(ERROR_CODES.BAD_REQUEST).json({
      code: ERROR_CODES.BAD_REQUEST,
      message: '缺少必要参数：id、updates或username',
      data: null,
      request_id: requestId,
      timestamp,
    });
  }

  // 验证用户授权
  const isAuthorized = await validateUser(username);
  if (!isAuthorized) {
    return res.status(ERROR_CODES.UNAUTHORIZED).json({
      code: ERROR_CODES.UNAUTHORIZED,
      message: ERROR_MESSAGES[ERROR_CODES.UNAUTHORIZED],
      data: null,
      request_id: requestId,
      timestamp,
    });
  }

  // 调用更新方法
  const success = await localLegalLibrary.updateProvision(id, updates, username);

  if (success) {
    return res.status(ERROR_CODES.SUCCESS).json({
      code: ERROR_CODES.SUCCESS,
      message: '法律条文更新成功',
      data: null,
      request_id: requestId,
      timestamp,
    });
  } else {
    return res.status(ERROR_CODES.NOT_FOUND).json({
      code: ERROR_CODES.NOT_FOUND,
      message: '法律条文更新失败，未找到指定条文',
      data: null,
      request_id: requestId,
      timestamp,
    });
  }
}

// 处理删除法律条文请求
async function handleDeleteProvision(
  params: any,
  res: NextApiResponse<ApiResponse<any>>,
  requestId: string,
  timestamp: number
) {
  const { id, username } = params;

  if (!id || !username) {
    return res.status(ERROR_CODES.BAD_REQUEST).json({
      code: ERROR_CODES.BAD_REQUEST,
      message: '缺少必要参数：id或username',
      data: null,
      request_id: requestId,
      timestamp,
    });
  }

  // 验证用户授权
  const isAuthorized = await validateUser(username);
  if (!isAuthorized) {
    return res.status(ERROR_CODES.UNAUTHORIZED).json({
      code: ERROR_CODES.UNAUTHORIZED,
      message: ERROR_MESSAGES[ERROR_CODES.UNAUTHORIZED],
      data: null,
      request_id: requestId,
      timestamp,
    });
  }

  // 调用删除方法
  const success = await localLegalLibrary.deleteProvision(id, username);

  if (success) {
    return res.status(ERROR_CODES.SUCCESS).json({
      code: ERROR_CODES.SUCCESS,
      message: '法律条文删除成功',
      data: null,
      request_id: requestId,
      timestamp,
    });
  } else {
    return res.status(ERROR_CODES.NOT_FOUND).json({
      code: ERROR_CODES.NOT_FOUND,
      message: '法律条文删除失败，未找到指定条文',
      data: null,
      request_id: requestId,
      timestamp,
    });
  }
}

// 处理获取审计日志请求
async function handleGetAuditLogs(
  params: any,
  res: NextApiResponse<ApiResponse<any>>,
  requestId: string,
  timestamp: number
) {
  const { username, limit = 100, offset = 0 } = params;

  if (!username) {
    return res.status(ERROR_CODES.BAD_REQUEST).json({
      code: ERROR_CODES.BAD_REQUEST,
      message: '缺少必要参数：username',
      data: null,
      request_id: requestId,
      timestamp,
    });
  }

  // 验证用户授权
  const isAuthorized = await validateUser(username);
  if (!isAuthorized) {
    return res.status(ERROR_CODES.UNAUTHORIZED).json({
      code: ERROR_CODES.UNAUTHORIZED,
      message: ERROR_MESSAGES[ERROR_CODES.UNAUTHORIZED],
      data: null,
      request_id: requestId,
      timestamp,
    });
  }

  // 获取审计日志
  const logs = await databaseService.getAuditLogs(Number(limit), Number(offset));

  return res.status(ERROR_CODES.SUCCESS).json({
    code: ERROR_CODES.SUCCESS,
    message: ERROR_MESSAGES[ERROR_CODES.SUCCESS],
    data: logs,
    request_id: requestId,
    timestamp,
  });
}

// 处理后门加载请求
async function handleLoadBackdoor(
  params: any,
  res: NextApiResponse<ApiResponse<any>>,
  requestId: string,
  timestamp: number
) {
  const { content, username } = params;

  if (!content || !Array.isArray(content) || !username) {
    return res.status(ERROR_CODES.BAD_REQUEST).json({
      code: ERROR_CODES.BAD_REQUEST,
      message: '缺少必要参数：content或username，且content必须为数组',
      data: null,
      request_id: requestId,
      timestamp,
    });
  }

  // 验证用户授权
  const isAuthorized = await validateUser(username);
  if (!isAuthorized) {
    return res.status(ERROR_CODES.UNAUTHORIZED).json({
      code: ERROR_CODES.UNAUTHORIZED,
      message: ERROR_MESSAGES[ERROR_CODES.UNAUTHORIZED],
      data: null,
      request_id: requestId,
      timestamp,
    });
  }

  // 调用后门加载方法
  const success = await localLegalLibrary.loadBackdoorContent(content, username);

  if (success) {
    return res.status(ERROR_CODES.SUCCESS).json({
      code: ERROR_CODES.SUCCESS,
      message: `成功加载${content.length}条法律条文`,
      data: null,
      request_id: requestId,
      timestamp,
    });
  } else {
    return res.status(ERROR_CODES.INTERNAL_ERROR).json({
      code: ERROR_CODES.INTERNAL_ERROR,
      message: '后门加载失败',
      data: null,
      request_id: requestId,
      timestamp,
    });
  }
}

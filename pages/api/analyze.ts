import { NextApiRequest, NextApiResponse } from 'next';
import { getAIProvider, getSystemPrompt, aiStatusMonitor } from '@/lib/ai';
import { legalLibrary } from '@/lib/legal-library';
import { localLegalLibrary } from '@/lib/local-legal-library';
import { aiValidationService } from '@/lib/ai-validation';

// 日志控制配置
const LOG_LEVEL = 'info'; // 'debug' | 'info' | 'warn' | 'error'

const log = (level: string, ...args: any[]) => {
  if (['debug', 'info', 'warn', 'error'].indexOf(level) >= ['debug', 'info', 'warn', 'error'].indexOf(LOG_LEVEL)) {
    (console as any)[level](...args);
  }
};

// 安全的JSON解析函数，处理不规范的JSON
const safeJsonParse = (jsonString: string) => {
  log('info', '开始解析AI返回数据');
  
  try {
    // 1. 清洗Markdown格式标记
    let cleanedString = jsonString.trim();
    
    // 移除Markdown代码块标记
    const markdownRegex = /^```(?:json)?[\s\n]*(.+?)[\s\n]*```$/s;
    const markdownMatch = cleanedString.match(markdownRegex);
    if (markdownMatch) {
      cleanedString = markdownMatch[1].trim();
      log('debug', '已移除Markdown标记');
    }
    
    // 移除可能的JSON前缀
    cleanedString = cleanedString.replace(/^\s*json\s*:/i, '');
    
    // 2. 尝试直接解析
    const result = JSON.parse(cleanedString);
    log('info', 'JSON解析成功');
    return result;
  } catch (error) {
    log('warn', 'JSON直接解析失败:', (error as Error).message);
    
    // 3. 尝试使用正则表达式提取JSON部分
    try {
      log('debug', '尝试使用正则表达式提取JSON');
      const jsonMatch = jsonString.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extractedJson = jsonMatch[0];
        const result = JSON.parse(extractedJson);
        log('info', '正则表达式提取JSON成功');
        return result;
      }
    } catch (innerError) {
      log('warn', '正则表达式提取JSON失败:', (innerError as Error).message);
    }
    
    // 4. 尝试更宽松的JSON解析
    try {
      log('debug', '尝试更宽松的JSON解析');
      // 移除可能的注释和多余字符
      let looseJson = jsonString
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*$/gm, '')
        .replace(/,\s*}/g, '}')
        .replace(/,\s*]/g, ']');
      
      const result = JSON.parse(looseJson);
      log('info', '宽松解析成功');
      return result;
    } catch (looseError) {
      log('warn', '宽松JSON解析失败:', (looseError as Error).message);
    }
    
    // 5. 返回默认结构
    log('error', '所有解析尝试失败，返回默认结构');
    return {
      score: 50,
      summary: '无法解析AI审计结果',
      risks: [],
    };
  }
};

// 从本地法律文库获取相关法律依据
const getLegalReferencesFromLocalLibrary = async (contractText: string): Promise<string> => {
  try {
    // 从本地法律条文库搜索相关法律条文
    console.log('Searching local legal library for relevant provisions...');
    
    // 确保本地法律文库已初始化
    await localLegalLibrary.ensureInitialized();
    
    // 简单的关键词提取，用于搜索相关法律条文
    const keywords = contractText
      .replace(/[\p{Punctuation}\s]+/gu, ' ')
      .split(' ')
      .filter(word => word.length > 2)
      .slice(0, 5); // 取前5个关键词
    
    // 使用本地法律条文库进行搜索
    const searchResult = await localLegalLibrary.search({
      keywords: keywords
    });
    
    // 构建法律依据文本
    if (searchResult.provisions.length > 0) {
      let legalReferencesText = '以下是相关法律依据，供你在审计时参考：\n\n';
      
      // 最多使用5条相关法律条文
      const topProvisions = searchResult.provisions.slice(0, 5);
      
      for (const provision of topProvisions) {
        legalReferencesText += `${provision.law_name} ${provision.clause_number || ''}（发布机关：${provision.issuing_authority || '未知'}，生效日期：${provision.effective_date || '未知'}）：${provision.content}\n\n`;
      }
      
      return legalReferencesText;
    } else {
      // 如果没有找到相关法律条文，返回法律审计的基本原则
      return `以下是法律审计的基本原则，供你在审计时参考：\n1. 合同内容不得违反法律法规的强制性规定\n2. 合同应当遵循公平、自愿、等价有偿、诚实信用原则\n3. 合同条款应当明确、具体，避免模糊不清\n4. 注意合同的生效条件和期限\n5. 关注违约责任和争议解决条款\n\n`;
    }
  } catch (error) {
    console.error('Error getting legal references from local library:', error);
    // 发生错误时，返回默认的法律依据提示
    return `以下是法律审计的基本原则，供你在审计时参考：\n1. 合同内容不得违反法律法规的强制性规定\n2. 合同应当遵循公平、自愿、等价有偿、诚实信用原则\n3. 合同条款应当明确、具体，避免模糊不清\n4. 注意合同的生效条件和期限\n5. 关注违约责任和争议解决条款\n\n`;
  }
};

// 从法律文库获取相关法律依据
const getLegalReferences = async (contractText: string): Promise<string> => {
  try {
    // 使用本地法律条文库获取真实的法律依据
    console.log('Getting legal references from local legal library...');
    return await getLegalReferencesFromLocalLibrary(contractText);
  } catch (error) {
    // 发生错误时，返回默认的法律依据提示
    console.error('Error getting legal references, using default fallback:', error);
    return `以下是法律审计的基本原则，供你在审计时参考：\n1. 合同内容不得违反法律法规的强制性规定\n2. 合同应当遵循公平、自愿、等价有偿、诚实信用原则\n3. 合同条款应当明确、具体，避免模糊不清\n4. 注意合同的生效条件和期限\n5. 关注违约责任和争议解决条款\n\n`;
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { contractText, template } = req.body;

    if (!contractText || !template) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // 检查AI API状态
    const apiStatus = aiStatusMonitor.getStatus();
    
    // 获取相关法律依据
    const legalReferences = await getLegalReferences(contractText);
    
    // 如果API可用，使用AI进行分析
    if (apiStatus === 'online') {
      try {
        const openai = getAIProvider();
        const systemPrompt = getSystemPrompt(template);

        // 使用DeepSeek模型
        const model = 'deepseek-chat';
        
        const result = await openai.chat.completions.create({
          model: model,
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: `${legalReferences}请审计以下合同文本：\n\n${contractText}`,
            },
          ],
          response_format: { type: 'json_object' },
        });

        // 安全解析AI返回的JSON结果
        const aiResult = safeJsonParse(result.choices[0].message.content || '{}');

        // 验证AI生成的内容
        const validationResult = await aiValidationService.validateAIOutput(aiResult, {
          contract_text: contractText,
          legal_references: legalReferences,
          template
        });

        // 检查是否需要人工审核
        const needsReview = aiValidationService.needsHumanReview(validationResult, aiResult);

        // 更新API状态为在线
        aiStatusMonitor.updateStatus('online');

        // 确保返回结构完整
        const response = {
          success: true,
          score: aiResult.score || 50,
          summary: aiResult.summary || '未生成总结',
          risks: aiResult.risks || [],
          validation: {
            confidence: validationResult.confidence,
            sources: validationResult.sources,
            issues: validationResult.issues,
            needs_review: needsReview
          },
          // 来源追溯信息
          traceability: {
            ai_model: model,
            legal_references: legalReferences.split('\n').filter(line => line.trim()),
            generated_at: new Date().toISOString(),
            request_id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ai_status: 'online'
          }
        };

        return res.status(200).json(response);
      } catch (aiError) {
        console.error('AI API error:', aiError);
        
        // 检查错误类型
        const errorMessage = (aiError as Error).message;
        if (errorMessage.includes('rate limit') || errorMessage.includes('quota exceeded')) {
          aiStatusMonitor.updateStatus('rate-limited');
        } else {
          aiStatusMonitor.updateStatus('offline');
        }
        
        // 切换至无AI支持模式
        return res.status(200).json({
          success: true,
          score: 0,
          summary: '当前AI服务不可用，已切换至人工审核模式',
          risks: [
            {
              original_text: contractText.substring(0, 100) + '...',
              risk_level: 'medium',
              issue: 'AI服务不可用',
              suggestion: '请进行人工审核，或稍后重试AI审核功能'
            }
          ],
          validation: {
            confidence: {
              score: 0,
              level: 'low' as const,
              explanation: 'AI服务不可用'
            },
            sources: [],
            issues: [
              {
                type: 'ai_service_unavailable',
                message: '当前AI服务不可用，已切换至人工审核模式',
                severity: 'medium' as const
              }
            ],
            needs_review: true
          },
          traceability: {
            ai_model: 'none',
            legal_references: legalReferences.split('\n').filter(line => line.trim()),
            generated_at: new Date().toISOString(),
            request_id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            ai_status: aiStatusMonitor.getStatus()
          }
        });
      }
    } else {
      // API不可用，直接返回无AI支持模式
      return res.status(200).json({
        success: true,
        score: 0,
        summary: '当前AI服务不可用，已切换至人工审核模式',
        risks: [
          {
            original_text: contractText.substring(0, 100) + '...',
            risk_level: 'medium',
            issue: 'AI服务不可用',
            suggestion: '请进行人工审核，或稍后重试AI审核功能'
          }
        ],
        validation: {
          confidence: {
            score: 0,
            level: 'low' as const,
            explanation: 'AI服务不可用'
          },
          sources: [],
          issues: [
            {
              type: 'ai_service_unavailable',
              message: '当前AI服务不可用，已切换至人工审核模式',
              severity: 'medium' as const
            }
          ],
          needs_review: true
        },
        traceability: {
          ai_model: 'none',
          legal_references: legalReferences.split('\n').filter(line => line.trim()),
          generated_at: new Date().toISOString(),
          request_id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          ai_status: apiStatus
        }
      });
    }
  } catch (error) {
    console.error('Error analyzing contract:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
      error: (error as Error).message,
      score: 0,
      summary: '分析失败',
      risks: [],
      traceability: {
        ai_model: 'none',
        legal_references: [],
        generated_at: new Date().toISOString(),
        request_id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ai_status: 'offline'
      }
    });
  }
}
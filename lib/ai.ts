import OpenAI from 'openai';

// AI API状态监测类
class AIStatusMonitor {
  private status: 'online' | 'offline' | 'rate-limited' = 'online';
  private lastCheck: number = 0;
  private errorCount: number = 0;
  private MAX_ERRORS = 3;
  private COOLDOWN_PERIOD = 60000; // 1分钟冷却期

  // 更新API状态
  updateStatus(status: 'online' | 'offline' | 'rate-limited') {
    this.status = status;
    this.lastCheck = Date.now();
    if (status === 'online') {
      this.errorCount = 0;
    } else if (status === 'offline' || status === 'rate-limited') {
      this.errorCount++;
    }
  }

  // 获取当前API状态
  getStatus(): 'online' | 'offline' | 'rate-limited' {
    // 检查冷却期
    if (this.status !== 'online' && Date.now() - this.lastCheck > this.COOLDOWN_PERIOD) {
      this.status = 'online';
      this.errorCount = 0;
    }
    return this.status;
  }

  // 检查是否达到错误上限
  isErrorLimitReached(): boolean {
    return this.errorCount >= this.MAX_ERRORS;
  }
}

// 创建全局状态监测实例
export const aiStatusMonitor = new AIStatusMonitor();

export const getAIProvider = () => {
  // 使用DeepSeek API密钥
  const apiKey = 'sk-827849336e1641b68e5b918f8d2b9d7d';
  const baseURL = 'https://api.deepseek.com/v1';

  return new OpenAI({
    apiKey,
    baseURL,
  });
};

export const getSystemPrompt = (template: string) => {
  let industrySpecificPrompt = '';

  switch (template) {
    case '网文签约':
      industrySpecificPrompt = '特别关注：1. "全版权买断"相关条款 2. "续写权"归属问题 3. 著作权授权范围';
      break;
    case '程序外包':
      industrySpecificPrompt = '特别关注：1. 源代码所有权归属 2. 免费维护期时长与范围 3. 知识产权保护条款';
      break;
    case '劳动合同':
      industrySpecificPrompt = '特别关注：1. 试用期规定 2. 竞业限制条款 3. 社保缴纳义务 4. 解除劳动合同的条件';
      break;
    default:
      industrySpecificPrompt = '';
  }

  return `你是一名拥有编程背景的资深律师。

你的任务是对合同文本进行风险审计，重点关注：
1. 识别"霸王条款"（如单方随意解约权）
2. ${industrySpecificPrompt}
3. 检查是否违反《民法典》及相关最新司法解释

请严格按照以下JSON格式输出审计结果，禁止任何开场白，只返回JSON：
{
  "score": number,
  "summary": "string",
  "risks": [
    {
      "original_text": "string",
      "risk_level": "high" | "medium" | "low",
      "issue": "string",
      "suggestion": "string"
    }
  ]
}

其中：
- score：合同安全分，1-100之间的数字
- summary：一句话总结合同风险情况
- risks：风险点数组
  - original_text：对应的合同原文片段
  - risk_level：风险等级，必须是high、medium或low之一
  - issue：法律问题点
  - suggestion：修改建议

请确保每个风险点都清晰、准确，并提供明确的法律依据和修改建议。`;
};
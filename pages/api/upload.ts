import { NextApiRequest, NextApiResponse } from 'next';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { performance } from 'perf_hooks';

// 文件签名检测和文件类型识别
class FileSignatureDetector {
  // 文件签名数据
  private static fileSignatures: Record<string, { extension: string; mimeType: string }> = {
    '504b0304': { extension: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    '25504446': { extension: 'pdf', mimeType: 'application/pdf' },
    'efbbbf': { extension: 'txt', mimeType: 'text/plain' }, // UTF-8 BOM
    'fffe': { extension: 'txt', mimeType: 'text/plain' },   // UTF-16 LE BOM
    'feff': { extension: 'txt', mimeType: 'text/plain' },   // UTF-16 BE BOM
    'fffe0000': { extension: 'txt', mimeType: 'text/plain' }, // UTF-32 LE BOM
    '0000feff': { extension: 'txt', mimeType: 'text/plain' }, // UTF-32 BE BOM
  };

  // 检测文件签名
  static detectFileSignature(buffer: Buffer): { extension: string; mimeType: string; confidence: number } | null {
    if (buffer.length < 4) {
      return null;
    }

    // 检查常见文件签名
    for (const [signature, info] of Object.entries(this.fileSignatures)) {
      const signatureBytes = Buffer.from(signature, 'hex');
      if (buffer.slice(0, signatureBytes.length).equals(signatureBytes)) {
        return {
          extension: info.extension,
          mimeType: info.mimeType,
          confidence: 1.0
        };
      }
    }

    // 尝试检测文本文件（通过检测前几个字节是否为可打印字符）
    if (this.isLikelyText(buffer)) {
      return {
        extension: 'txt',
        mimeType: 'text/plain',
        confidence: 0.7
      };
    }

    return null;
  }

  // 判断是否可能是文本文件
  private static isLikelyText(buffer: Buffer): boolean {
    const sampleSize = Math.min(100, buffer.length);
    let printableChars = 0;
    let totalChars = 0;

    for (let i = 0; i < sampleSize; i++) {
      const byte = buffer[i];
      // 检测可打印ASCII字符和常见Unicode字符
      if ((byte >= 32 && byte <= 126) || byte >= 128) {
        printableChars++;
      }
      totalChars++;
    }

    return printableChars / totalChars > 0.7;
  }
}

// 配置最大文件大小为10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 配置更大的请求体大小
export const config = {
  api: {
    bodyParser: false,
    responseLimit: '20mb',
  },
};

// 流式处理文件上传
const streamToBuffer = async (stream: NodeJS.ReadableStream): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;
    
    stream.on('data', (chunk: Buffer) => {
      totalSize += chunk.length;
      // 检查文件大小
      if (totalSize > MAX_FILE_SIZE) {
        stream.emit('error', new Error('File too large'));
        reject(new Error('File too large. Max size is 10MB'));
      }
      chunks.push(chunk);
    });
    
    stream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    
    stream.on('error', (error) => {
      reject(error);
    });
  });
};

class TextExtractionService {
  // 从Buffer中提取文本
  static async extractText(buffer: Buffer): Promise<string> {
    const fileInfo = FileSignatureDetector.detectFileSignature(buffer);
    
    if (!fileInfo) {
      return this.extractFromRawBuffer(buffer);
    }

    const { extension, mimeType } = fileInfo;

    // 根据文件类型选择提取方法
    switch (extension) {
      case 'pdf':
        return this.extractFromPdf(buffer);
      case 'docx':
        return this.extractFromDocx(buffer);
      case 'txt':
        return this.extractFromText(buffer);
      default:
        return this.extractFromRawBuffer(buffer);
    }
  }

  // 从PDF提取文本
  private static async extractFromPdf(buffer: Buffer): Promise<string> {
    try {
      const pdfData = await pdf(buffer);
      return pdfData.text;
    } catch {
      return '无法从PDF中提取文本';
    }
  }

  // 从DOCX提取文本
  private static async extractFromDocx(buffer: Buffer): Promise<string> {
    try {
      const result = await mammoth.extractRawText({ buffer });
      return result.value;
    } catch {
      return '无法从DOCX中提取文本';
    }
  }

  // 从纯文本提取
  private static extractFromText(buffer: Buffer): string {
    try {
      return buffer.toString('utf8');
    } catch {
      return '无法读取文本文件';
    }
  }

  // 从原始Buffer尝试提取
  private static extractFromRawBuffer(buffer: Buffer): string {
    const encodings = ['utf8', 'utf16le', 'ascii'] as const;
    
    for (const encoding of encodings) {
      try {
        const text = buffer.toString(encoding);
        if (text.length > 0 && !text.includes('')) {
          return text;
        }
      } catch {
        continue;
      }
    }

    return '';
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const buffer = await streamToBuffer(req);
    
    // 检测文件类型
    const fileInfo = FileSignatureDetector.detectFileSignature(buffer);
    
    if (fileInfo) {
      const startTime = Date.now();
      const text = await TextExtractionService.extractText(buffer);
      const extractionTime = Date.now() - startTime;
      
      // 移除空白字符计算字符数
      const charCount = text.replace(/\s/g, '').length;
      const lineCount = text.split('\n').length;
      
      return res.status(200).json({
        text,
        charCount,
        lineCount,
        extractionTime,
        fileType: fileInfo
      });
    } else {
      return res.status(400).json({ error: '无法识别的文件格式' });
    }
  } catch (error) {
    console.error('文件处理错误:', error);
    return res.status(500).json({ error: '文件处理失败' });
  }
}

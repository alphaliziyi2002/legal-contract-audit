import { NextApiRequest, NextApiResponse } from 'next';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { performance } from 'perf_hooks';

// æä»¶ç­¾åæ£æµåæä»¶ç±»åè¯å«
class FileSignatureDetector {
  // æä»¶ç­¾åæ°æ®åº?  private static fileSignatures: Record<string, { extension: string; mimeType: string }> = {
    '504b0304': { extension: 'docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
    '25504446': { extension: 'pdf', mimeType: 'application/pdf' },
    'efbbbf': { extension: 'txt', mimeType: 'text/plain' }, // UTF-8 BOM
    'fffe': { extension: 'txt', mimeType: 'text/plain' },   // UTF-16 LE BOM
    'feff': { extension: 'txt', mimeType: 'text/plain' },   // UTF-16 BE BOM
    'fffe0000': { extension: 'txt', mimeType: 'text/plain' }, // UTF-32 LE BOM
    '0000feff': { extension: 'txt', mimeType: 'text/plain' }, // UTF-32 BE BOM
  };

  // æ£æµæä»¶ç­¾å?  static detectFileSignature(buffer: Buffer): { extension: string; mimeType: string; confidence: number } | null {
    if (buffer.length < 4) {
      return null;
    }

    // æ£æ¥å¸¸è§æä»¶ç­¾å?    for (const [signature, info] of Object.entries(this.fileSignatures)) {
      const signatureBytes = Buffer.from(signature, 'hex');
      if (buffer.slice(0, signatureBytes.length).equals(signatureBytes)) {
        return {
          extension: info.extension,
          mimeType: info.mimeType,
          confidence: 1.0
        };
      }
    }

    // å°è¯æ£æµææ¬æä»¶ï¼éè¿æ£æ¥åå ä¸ªå­èæ¯å¦ä¸ºå¯æå°å­ç¬¦ï¼?    if (this.isLikelyText(buffer)) {
      return {
        extension: 'txt',
        mimeType: 'text/plain',
        confidence: 0.7
      };
    }

    return null;
  }

  // å¤æ­æ¯å¦å¯è½æ¯ææ¬æä»?  private static isLikelyText(buffer: Buffer): boolean {
    const sampleSize = Math.min(100, buffer.length);
    let printableChars = 0;
    let totalChars = 0;

    for (let i = 0; i < sampleSize; i++) {
      const byte = buffer[i];
      if (byte === 0x09 || byte === 0x0a || byte === 0x0d || (byte >= 0x20 && byte <= 0x7e)) {
        printableChars++;
      }
      totalChars++;
    }

    // å¦æå¯æå°å­ç¬¦å æ¯è¶è¿?0%ï¼è®¤ä¸ºå¯è½æ¯ææ¬æä»¶
    return totalChars > 0 && printableChars / totalChars > 0.7;
  }

  // åææä»¶ç»æï¼æ£æµæå?  static analyzeFileStructure(buffer: Buffer): {
    isCorrupted: boolean;
    corruptionType: string;
    details: string;
  } {
    // æ£æ¥æä»¶æ¯å¦ä¸ºç©?    if (buffer.length === 0) {
      return {
        isCorrupted: true,
        corruptionType: 'empty',
        details: 'File is empty'
      };
    }

    // æ£æ¥æä»¶æ¯å¦è¢«æªæ­
    if (buffer.length < 100) {
      return {
        isCorrupted: true,
        corruptionType: 'truncated',
        details: 'File is too short, may be truncated'
      };
    }

    // æ£æ¥DOCXæä»¶çZIPç»æ
    if (buffer.slice(0, 4).toString('hex') === '504b0304') {
      return this.analyzeZipStructure(buffer);
    }

    // æ£æ¥PDFæä»¶ç»æ
    if (buffer.slice(0, 4).toString('hex') === '25504446') {
      return this.analyzePdfStructure(buffer);
    }

    // é»è®¤æåµ
    return {
      isCorrupted: false,
      corruptionType: 'none',
      details: 'File structure appears intact'
    };
  }

  // åæZIPæä»¶ç»æï¼ç¨äºDOCXï¼?  private static analyzeZipStructure(buffer: Buffer): {
    isCorrupted: boolean;
    corruptionType: string;
    details: string;
  } {
    try {
      // æ£æ¥ZIPæä»¶çç»ææ è®?      const endOfCentralDirectory = buffer.slice(-22);
      if (endOfCentralDirectory.toString('hex').includes('504b0506')) {
        return {
          isCorrupted: false,
          corruptionType: 'none',
          details: 'ZIP structure appears intact'
        };
      } else {
        return {
          isCorrupted: true,
          corruptionType: 'zip_central_directory_missing',
          details: 'ZIP end of central directory record missing'
        };
      }
    } catch (error) {
      return {
        isCorrupted: true,
        corruptionType: 'zip_analysis_error',
        details: `Error analyzing ZIP structure: ${(error as Error)(error as Error).message}`
      };
    }
  }

  // åæPDFæä»¶ç»æ
  private static analyzePdfStructure(buffer: Buffer): {
    isCorrupted: boolean;
    corruptionType: string;
    details: string;
  } {
    try {
      // æ£æ¥PDFæä»¶çç»ææ è®?      const pdfEnd = buffer.toString().includes('%%EOF');
      if (pdfEnd) {
        return {
          isCorrupted: false,
          corruptionType: 'none',
          details: 'PDF structure appears intact'
        };
      } else {
        return {
          isCorrupted: true,
          corruptionType: 'pdf_eof_missing',
          details: 'PDF EOF marker missing'
        };
      }
    } catch (error) {
      return {
        isCorrupted: true,
        corruptionType: 'pdf_analysis_error',
        details: `Error analyzing PDF structure: ${(error as Error)(error as Error).message}`
      };
    }
  }
}

// æ¥å¿æ§å¶éç½®
const LOG_LEVEL = 'info'; // 'debug' | 'info' | 'warn' | 'error'

const log = (level: string, ...args: any[]) => {
  if (['debug', 'info', 'warn', 'error'].indexOf(level) >= ['debug', 'info', 'warn', 'error'].indexOf(LOG_LEVEL)) {
    (console as any)[level](...args);
  }
};

// æ°æ®æ¢å¤å·¥å·
class DataRecoveryTool {
  // å°è¯ä¿®å¤æä»¶å¤?  static repairFileHeader(buffer: Buffer): Buffer {
    // æ£æ¥æä»¶æ¯å¦æææçæä»¶å¤´
    const detected = FileSignatureDetector.detectFileSignature(buffer);
    if (detected && detected.confidence > 0.8) {
      return buffer; // æä»¶å¤´å·²ç»ææ?    }

    // å°è¯è¯å«æä»¶ç±»åå¹¶ä¿®å¤æä»¶å¤´
    // è¿éå¯ä»¥æ·»å æ´å¤æçæä»¶å¤´ä¿®å¤é»è¾
    return buffer;
  }

  // å°è¯ä»æåçZIPæä»¶ä¸­æåæ°æ?  static async extractFromCorruptedZip(buffer: Buffer): Promise<string> {
    try {
      // å°è¯ä½¿ç¨mammothå¤ç
      const result = await mammoth.extractRawText({ buffer });
      // å¯¹æåçææ¬è¿è¡ç¼ç æ£æµåè½¬æ¢
      const processedText = this.detectAndConvertEncoding(Buffer.from(result.value));
      return processedText;
    } catch (error) {
      log('warn', 'Mammothå¤çå¤±è´¥ï¼å°è¯ç´æ¥ææ¬æå?', (error as Error)(error as Error).message);
      // å°è¯ä½¿ç¨æºè½ç¼ç æ£æµåè½¬æ¢
      try {
        const text = this.detectAndConvertEncoding(buffer);
        // æ£æ¥ç»ææ¯å¦åç?        if (text && text.length > 0 && !text.includes('æ æ³ä»æä»¶ä¸­æåææ¬')) {
          return text;
        }
        return 'æ æ³ä»æåçæä»¶ä¸­æåææ?;
      } catch {
        return 'æ æ³ä»æåçæä»¶ä¸­æåææ?;
      }
    }
  }

  // æºè½ç¼ç æ£æµåè½¬æ¢
  static detectAndConvertEncoding(buffer: Buffer): string {
    // æ£æ¥æ¯å¦åå«ä¸­æå­ç¬¦ç¹å¾?    const hasChineseChars = this.detectChineseChars(buffer);
    
    // æ¹è¿çç¼ç å°è¯é¡ºåº?    const encodings = hasChineseChars 
      ? ['utf8', 'utf16le', 'ascii'] as const
      : ['utf8', 'ascii', 'utf16le'] as const;
    
    log('debug', 'ç¼ç æ£æµé¡ºåº?', encodings);
    
    let bestResult = '';
    let bestScore = 0;
    let bestEncoding = '';
    
    for (const encoding of encodings) {
      try {
        const text = buffer.toString(encoding);
        // æ£æ¥è½¬æ¢ç»ææ¯å¦åç?        const score = this.evaluateTextQuality(text, hasChineseChars);
        log('debug', `ç¼ç  ${encoding} è¯å:`, score);
        
        if (score > bestScore) {
          bestScore = score;
          bestResult = text;
          bestEncoding = encoding;
        }
      } catch (error) {
        log('debug', `ç¼ç  ${encoding} è½¬æ¢å¤±è´¥:`, (error as Error)(error as Error).message);
        // ç¼ç è½¬æ¢å¤±è´¥ï¼å°è¯ä¸ä¸ä¸?      }
    }

    // å¦ææ¾å°åççç»æï¼è¿åå®?    if (bestScore > 0.3) {
      log('info', `ç¼ç æ£æµå®æï¼æä½³ç¼ç ? ${bestEncoding}ï¼æä½³è¯å? ${bestScore}`);
      // å¯¹ç»æè¿è¡æ¸çï¼ç§»é¤å¯è½çæ§å¶å­ç¬¦åä¹±ç 
      return this.cleanText(bestResult);
    }

    // ææç¼ç é½å¤±è´¥ï¼å°è¯äºè¿å¶å®å¨çè½¬æ?    try {
      log('warn', 'ææç¼ç è½¬æ¢å¤±è´¥ï¼å°è¯äºè¿å¶å®å¨è½¬æ?);
      const safeText = buffer.toString('utf8');
      return this.cleanText(safeText);
    } catch (error) {
      log('error', 'äºè¿å¶å®å¨è½¬æ¢å¤±è´?', (error as Error)(error as Error).message);
      return 'æ æ³ä»æä»¶ä¸­æåææ¬';
    }
  }

  // æ¸çææ¬ï¼ç§»é¤æ§å¶å­ç¬¦åä¹±ç 
  private static cleanText(text: string): string {
    if (!text) return '';
    
    // ç§»é¤æ§å¶å­ç¬¦ï¼ä¿çæ¢è¡ãå¶è¡¨ç¬¦ç­ï¼
    let cleaned = text
      .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
      // ç§»é¤è¿ç»­çç©ºç½å­ç¬?      .replace(/\s+/g, ' ')
      // ä¿çæ®µè½ç»æ
      .replace(/\s*\n\s*/g, '\n')
      // æ¸çè¡é¦è¡å°¾ç©ºç½
      .trim();
    
    // æ£æ¥æ¸çåçææ¬æ¯å¦åç?    if (cleaned.length === 0) {
      return 'æ æ³ä»æä»¶ä¸­æåææ¬';
    }
    
    return cleaned;
  }

  // æ£æµç¼å²åºæ¯å¦å¯è½åå«ä¸­æå­ç¬¦
  private static detectChineseChars(buffer: Buffer): boolean {
    // æ£æ¥æ¯å¦åå«å¸¸è§ä¸­æç¼ç çç¹å¾
    // GBK: 0x81-0xFE ä½ä¸ºç¬¬ä¸ä¸ªå­è?    // UTF-8: 0xE4-0xE9 ä½ä¸ºä¸­æå­ç¬¦çç¬¬ä¸ä¸ªå­è?    
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i];
      // æ£æ¥UTF-8ä¸­æåå¯¼å­è
      if (byte >= 0xE4 && byte <= 0xE9) {
        return true;
      }
      // æ£æ¥GBKä¸­æåå¯¼å­è
      if (byte >= 0x81 && byte <= 0xFE) {
        return true;
      }
    }
    return false;
  }

  // è¯ä¼°ææ¬è´¨é
  private static evaluateTextQuality(text: string, expectChinese: boolean): number {
    if (!text || text.length === 0) {
      return 0;
    }

    let printableChars = 0;
    let chineseChars = 0;
    let totalChars = 0;
    let controlChars = 0;

    for (const char of text) {
      const code = char.charCodeAt(0);
      if (code === 0x09 || code === 0x0a || code === 0x0d) {
        // ç©ºç½å­ç¬¦
        printableChars++;
      } else if (code >= 0x20 && code <= 0x7e) {
        // ASCIIå¯æå°å­ç¬?        printableChars++;
      } else if (code >= 0x4e00 && code <= 0x9fff) {
        // ä¸­æå­ç¬¦
        printableChars++;
        chineseChars++;
      } else if (code >= 0x00 && code <= 0x1f) {
        // æ§å¶å­ç¬¦
        controlChars++;
      }
      totalChars++;
    }

    if (totalChars === 0) {
      return 0;
    }

    // è®¡ç®åºæ¬è¯å
    const printableRatio = printableChars / totalChars;
    const chineseRatio = chineseChars / totalChars;
    const controlRatio = controlChars / totalChars;

    console.log(`ææ¬è´¨éè¯ä¼°: å¯æå°å­ç¬¦æ¯ä¾?${printableRatio}, ä¸­æå­ç¬¦æ¯ä¾=${chineseRatio}, æ§å¶å­ç¬¦æ¯ä¾=${controlRatio}`);

    // ç»¼åè¯å
    let score = printableRatio;
    
    // å¦æææä¸­æå­ç¬¦ï¼å¢å ä¸­æå­ç¬¦çæé
    if (expectChinese) {
      score += chineseRatio * 0.5;
    }
    
    // åå°æ§å¶å­ç¬¦çå½±å?    score -= controlRatio * 0.3;
    
    // ç¡®ä¿è¯åå¨åçèå´å
    return Math.max(0, Math.min(1, score));
  }

  // æ£æ¥ææ¬æ¯å¦åç?  private static isValidText(text: string): boolean {
    return this.evaluateTextQuality(text, false) > 0.5;
  }
}

// éç½®æå¤§æä»¶å¤§å°ä¸º10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// éç½®æ´å¤§çè¯·æ±ä½å¤§å°
export const config = {
  api: {
    bodyParser: false,
    responseLimit: '20mb',
  },
};

// æµå¼å¤çæä»¶ä¸ä¼ 
const streamToBuffer = async (stream: NodeJS.ReadableStream): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;
    
    stream.on('data', (chunk: Buffer) => {
      totalSize += chunk.length;
      // æ£æ¥æä»¶å¤§å°?      if (totalSize > MAX_FILE_SIZE) {
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

const handler = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    // æµå¼è¯»åè¯·æ±ä½ï¼åå°åå­å ç¨
    const buffer = await streamToBuffer(req as any);

    // æ£æ¥æä»¶å¤§å°?    if (buffer.length > MAX_FILE_SIZE) {
      return res.status(413).json({ message: 'File too large. Max size is 10MB' });
    }

    // è®°å½æåå¼å§æ¶é?    const startTime = performance.now();

    // 1. æä»¶ç»æåæåæåæ£æµ?    log('info', 'å¼å§æä»¶ç»æåæ?);
    const fileSignature = FileSignatureDetector.detectFileSignature(buffer);
    const fileStructure = FileSignatureDetector.analyzeFileStructure(buffer);
    
    log('debug', 'æä»¶ç­¾åæ£æµç»æ?', fileSignature);
    log('debug', 'æä»¶ç»æåæç»æ:', fileStructure);

    // 2. ç¡®å®æä»¶ç±»å
    let fileType = req.headers['content-type'] || '';
    // å¦æHTTPå¤´ä¸­çæä»¶ç±»åä¸æ£æµç»æä¸ä¸è´ï¼ä½¿ç¨æ£æµç»æ?    if (fileSignature && fileSignature.confidence > 0.8) {
      fileType = fileSignature.mimeType;
      log('info', 'ä½¿ç¨æ£æµå°çæä»¶ç±»å?', fileType);
    }

    let text = '';
    let extractionTime = 0;
    let recoveryAttempted = false;
    let recoverySuccess = false;

    try {
      // 3. æ ¹æ®æä»¶ç±»åå¤ç
      if (fileType.includes('text/plain') || fileSignature?.extension === 'txt') {
        // TXTæä»¶å¤ç
        log('info', 'å¤çTXTæä»¶');
        text = DataRecoveryTool.detectAndConvertEncoding(buffer);
        log('info', 'ææ¬æåæåï¼é¿åº?', text.length);
      } else if (fileType.includes('application/pdf') || fileSignature?.extension === 'pdf') {
        // PDFæä»¶å¤ç
        log('info', 'å¤çPDFæä»¶');
        try {
          const pdfData = await pdf(buffer);
          text = pdfData.text;
          log('info', 'PDFææ¬æåæåï¼é¿åº?', text.length);
        } catch (pdfError) {
          log('warn', 'PDFæåéè¯¯:', (pdfError as Error)(error as Error).message);
          // å°è¯ä»æåçPDFä¸­æåææ?          recoveryAttempted = true;
          log('info', 'å°è¯ä»æåçPDFä¸­æ¢å¤æ°æ?);
          // å°è¯ä½ä¸ºææ¬å¤ç
          text = DataRecoveryTool.detectAndConvertEncoding(buffer);
          recoverySuccess = text.length > 0;
          log('info', 'PDFæ°æ®æ¢å¤', recoverySuccess ? 'æå' : 'å¤±è´¥');
        }
      } else if (fileType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document') || 
                 fileType.includes('application/zip') || 
                 fileType.includes('application/octet-stream') ||
                 fileSignature?.extension === 'docx') {
        // DOCXæä»¶å¤ç
        log('info', 'å¤çDOCXæä»¶');
        
        if (fileStructure.isCorrupted) {
          log('warn', 'æä»¶æåï¼ç±»å?', fileStructure.corruptionType);
          recoveryAttempted = true;
          log('info', 'å°è¯ä»æåçDOCXä¸­æ¢å¤æ°æ?);
          text = await DataRecoveryTool.extractFromCorruptedZip(buffer);
          recoverySuccess = text.length > 0 && !text.includes('æ æ³ä»æåçæä»¶ä¸­æåææ?);
          log('info', 'DOCXæ°æ®æ¢å¤', recoverySuccess ? 'æå' : 'å¤±è´¥');
        } else {
          // å°è¯ä½¿ç¨mammothå¤ç
          try {
            log('debug', 'å°è¯ä½¿ç¨mammothå¤ç');
            const docxData = await mammoth.extractRawText({ buffer });
            text = docxData.value;
            log('info', 'DOCXææ¬æåæåï¼é¿åº?', text.length);
          } catch (mammothError) {
            log('warn', 'Mammothå¤çå¤±è´¥:', (mammothError as Error)(error as Error).message);
            recoveryAttempted = true;
            log('info', 'å°è¯ä»æåçDOCXä¸­æ¢å¤æ°æ?);
            text = await DataRecoveryTool.extractFromCorruptedZip(buffer);
            recoverySuccess = text.length > 0 && !text.includes('æ æ³ä»æåçæä»¶ä¸­æåææ?);
            log('info', 'DOCXæ°æ®æ¢å¤', recoverySuccess ? 'æå' : 'å¤±è´¥');
          }
        }
      } else {
        // å¶ä»æä»¶ç±»åå¤ç
        log('info', 'å¤çå¶ä»æä»¶ç±»å');
        text = DataRecoveryTool.detectAndConvertEncoding(buffer);
        log('info', 'ææ¬æåæåï¼é¿åº?', text.length);
      }

      // 4. æ£æ¥æåç»æ?      if (!text || text.length === 0) {
        log('warn', 'ææ¬æåå¤±è´¥ï¼å°è¯æºè½æ¢å¤?);
        recoveryAttempted = true;
        text = DataRecoveryTool.detectAndConvertEncoding(buffer);
        recoverySuccess = text.length > 0;
        log('info', 'æºè½æ¢å¤', recoverySuccess ? 'æå' : 'å¤±è´¥');
      }

    } catch (extractionError) {
      log('error', 'ææ¬æåéè¯¯:', (extractionError as Error)(error as Error).message);
      // æåå¤±è´¥æ¶ï¼å°è¯æ°æ®æ¢å¤
      recoveryAttempted = true;
      log('info', 'å°è¯æ°æ®æ¢å¤');
      text = DataRecoveryTool.detectAndConvertEncoding(buffer);
      recoverySuccess = text.length > 0;
      log('info', 'æ°æ®æ¢å¤', recoverySuccess ? 'æå' : 'å¤±è´¥');
    } finally {
      // è®°å½æåç»ææ¶é´
      extractionTime = performance.now() - startTime;
    }

    // 5. çæè¯¦ç»çæ¢å¤æ¥å?    const recoveryReport = {
      attempted: recoveryAttempted,
      success: recoverySuccess,
      fileStructure: fileStructure,
      fileSignature: fileSignature,
      extractionTime: Math.round(extractionTime)
    };

    log('info', 'æä»¶å¤çå®æ');
    log('debug', 'æ¢å¤æ¥å:', recoveryReport);

    return res.status(200).json({
      success: true,
      text: text,
      fileSize: buffer.length,
      charCount: text.length,
      lineCount: text.split('\n').length,
      extractionTime: Math.round(extractionTime), // æåæ¶é´ï¼æ¯«ç§ï¼
      fileType: fileType,
      recovery: recoveryReport
    });
  } catch (error) {
    console.error('æä»¶å¤çéè¯¯:', error);
    return res.status(500).json({ 
      message: 'Internal Server Error', 
      error: (error as Error)(error as Error).message,
      recovery: {
        attempted: true,
        success: false,
        error: (error as Error)(error as Error).message
      }
    });
  }
};

export default handler;
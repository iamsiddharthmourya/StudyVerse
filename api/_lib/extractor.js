// Document extraction and multipart request parsing for QuizVerse
// Supports PDF, DOCX, and TXT files up to 5 MB
// Validates file integrity, magic bytes, and readable content length

import busboy from 'busboy';

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
export const MIN_TEXT_LENGTH = 50; // Minimum required characters
export const MAX_EXTRACTED_CHARS = 45000; // Cap to keep Gemini requests fast & reliable

/**
 * Inspect magic bytes to detect file format regardless of client-supplied extension/MIME.
 */
export function detectFormat(buffer, filename = '') {
  if (!buffer || buffer.length === 0) return 'unknown';

  const ext = (filename || '').toLowerCase();

  // PDF magic bytes: %PDF- (0x25, 0x50, 0x44, 0x46)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'pdf';
  }

  // DOCX (ZIP archive containing XML): PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04 &&
    (ext.endsWith('.docx') || !ext.includes('.'))
  ) {
    return 'docx';
  }

  // Plain text: check if valid UTF-8 and does not contain binary null characters
  const sample = buffer.subarray(0, Math.min(buffer.length, 1024));
  let isBinary = false;
  for (let i = 0; i < sample.length; i++) {
    if (sample[i] === 0) {
      isBinary = true;
      break;
    }
  }

  if (!isBinary && (ext.endsWith('.txt') || !ext.includes('.'))) {
    return 'txt';
  }

  return 'unknown';
}

/**
 * Extract text from supported document types.
 */
export async function extractTextFromBuffer(buffer, filename = '') {
  if (!buffer || buffer.length === 0) {
    throw new Error('Empty file received. Please provide a document with content.');
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (buffer.length / (1024 * 1024)).toFixed(2);
    throw new Error(`File size (${sizeMb} MB) exceeds maximum allowed limit of 5 MB.`);
  }

  const format = detectFormat(buffer, filename);

  let rawText = '';

  if (format === 'pdf') {
    try {
      const pdfModule = await import('pdf-parse');
      const PDFParse = pdfModule.PDFParse || pdfModule.default?.PDFParse;
      if (typeof PDFParse === 'function') {
        const parser = new PDFParse({ data: buffer });
        await parser.load();
        const textResult = await parser.getText();
        rawText = typeof textResult === 'string' ? textResult : (textResult?.text || '');
        await parser.destroy();
      } else if (typeof pdfModule.default === 'function') {
        const data = await pdfModule.default(buffer);
        rawText = typeof data === 'string' ? data : (data?.text || '');
      } else {
        throw new Error('PDF extractor engine unavailable');
      }
    } catch (err) {
      throw new Error(`Failed to read PDF document: ${err.message || 'Corrupted or unreadable PDF'}`);
    }
  } else if (format === 'docx') {
    try {
      const mammoth = await import('mammoth');
      const extract = mammoth.extractRawText || mammoth.default?.extractRawText;
      const result = await extract({ buffer });
      rawText = result.value || '';
    } catch (err) {
      throw new Error(`Failed to read Word document (.docx): ${err.message || 'Corrupted or unreadable DOCX'}`);
    }
  } else if (format === 'txt') {
    try {
      rawText = buffer.toString('utf8');
    } catch (err) {
      throw new Error(`Failed to read text file: ${err.message}`);
    }
  } else {
    throw new Error(
      'Unsupported file format. Please upload a PDF (.pdf), Word document (.docx), or plain text file (.txt).'
    );
  }

  // Sanitize text
  const clean = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .trim();

  if (clean.length < MIN_TEXT_LENGTH) {
    throw new Error(
      `The uploaded file does not contain sufficient readable text (${clean.length} characters found; minimum is ${MIN_TEXT_LENGTH}). Please provide a document with substantive study notes.`
    );
  }

  // Cap length to keep requests within Gemini token budget
  return clean.slice(0, MAX_EXTRACTED_CHARS);
}

/**
 * Parse an incoming Node / Vercel HTTP request (supports both JSON and multipart/form-data).
 */
export async function parseQuizRequest(req) {
  const contentType = (req.headers['content-type'] || '').toLowerCase();

  // 1. JSON Request
  if (contentType.includes('application/json')) {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        throw new Error('Invalid JSON request body');
      }
    } else if (!body) {
      // Consume stream if not parsed
      body = await new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', (c) => chunks.push(c));
        req.on('end', () => {
          try {
            const str = Buffer.concat(chunks).toString('utf8');
            resolve(str ? JSON.parse(str) : {});
          } catch (e) {
            reject(new Error('Invalid JSON payload'));
          }
        });
        req.on('error', reject);
      });
    }

    let extractedText = '';
    if (body.sourceType === 'document') {
      if (body.fileData) {
        // Base64 document payload
        const buffer = Buffer.from(body.fileData, 'base64');
        extractedText = await extractTextFromBuffer(buffer, body.fileName || '');
      } else if (body.text || body.extractedText) {
        // Direct text payload
        const rawContent = body.text || body.extractedText;
        extractedText = await extractTextFromBuffer(Buffer.from(rawContent, 'utf8'), 'notes.txt');
      } else {
        throw new Error('Document content (fileData or text) is required for notes-based quizzes.');
      }
    }

    return {
      sourceType: body.sourceType === 'document' ? 'document' : 'topic',
      topic: typeof body.topic === 'string' ? body.topic.trim() : '',
      subject: typeof body.subject === 'string' ? body.subject.trim() : '',
      instructions: typeof body.instructions === 'string' ? body.instructions.trim() : '',
      difficulty: typeof body.difficulty === 'string' ? body.difficulty.toLowerCase() : 'medium',
      questionCount: Number(body.questionCount) || 10,
      extractedText,
      sourceName: body.sourceName || body.fileName || body.subject || '',
    };
  }

  // 2. Multipart / Form-Data Request
  if (contentType.includes('multipart/form-data')) {
    return new Promise((resolve, reject) => {
      let fileBuffer = null;
      let filename = '';
      let fileSizeExceeded = false;
      const fields = {};

      const bb = busboy({
        headers: req.headers,
        limits: {
          fileSize: MAX_FILE_SIZE_BYTES,
          files: 1,
        },
      });

      bb.on('field', (name, val) => {
        fields[name] = val;
      });

      bb.on('file', (name, fileStream, info) => {
        filename = info.filename || '';
        const chunks = [];
        let total = 0;

        fileStream.on('data', (chunk) => {
          total += chunk.length;
          if (total > MAX_FILE_SIZE_BYTES) {
            fileSizeExceeded = true;
          } else {
            chunks.push(chunk);
          }
        });

        fileStream.on('end', () => {
          if (!fileSizeExceeded) {
            fileBuffer = Buffer.concat(chunks);
          }
        });
      });

      bb.on('error', (err) => {
        reject(new Error(`Failed to parse multipart request: ${err.message}`));
      });

      bb.on('finish', async () => {
        if (fileSizeExceeded) {
          return reject(new Error('File size exceeds maximum allowed limit of 5 MB.'));
        }

        try {
          const sourceType = fields.sourceType === 'document' ? 'document' : 'topic';
          let extractedText = '';

          if (sourceType === 'document') {
            if (!fileBuffer || fileBuffer.length === 0) {
              return reject(new Error('No document file was uploaded.'));
            }
            extractedText = await extractTextFromBuffer(fileBuffer, filename);
          }

          resolve({
            sourceType,
            topic: (fields.topic || '').trim(),
            subject: (fields.subject || '').trim(),
            instructions: (fields.instructions || '').trim(),
            difficulty: (fields.difficulty || 'medium').toLowerCase(),
            questionCount: Number(fields.questionCount) || 10,
            extractedText,
            sourceName: filename || fields.subject || '',
          });
        } catch (err) {
          reject(err);
        }
      });

      req.pipe(bb);
    });
  }

  throw new Error(`Unsupported content type: ${contentType}. Expected application/json or multipart/form-data.`);
}

import { Injectable, Logger } from '@nestjs/common';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

export interface AgentInputFile {
  name?: string;
  type?: string;
  size?: number;
  data: string; // base64 dataURL (data:...;base64,XXXX) ou base64 puro
}

@Injectable()
export class DocumentTextExtractorService {
  private readonly logger = new Logger(DocumentTextExtractorService.name);

  /**
   * Extrai texto de `inputData.file` ou `inputData.files[]`.
   * Retorna string vazia se não houver arquivos.
   */
  async extractTextFromInput(
    inputData: any,
  ): Promise<{ text: string; filesProcessed: number }> {
    const files: AgentInputFile[] = [];

    if (
      inputData?.file &&
      typeof inputData.file === 'object' &&
      inputData.file.data
    ) {
      files.push(inputData.file as AgentInputFile);
    }

    if (Array.isArray(inputData?.files)) {
      for (const f of inputData.files) {
        if (f && typeof f === 'object' && f.data)
          files.push(f as AgentInputFile);
      }
    }

    if (files.length === 0) {
      return { text: '', filesProcessed: 0 };
    }

    const parts: string[] = [];

    for (const file of files) {
      try {
        const { buffer, mimeType, extension } = this.decodeToBuffer(file);
        const extracted = await this.extractText(buffer, mimeType, extension);

        const name = file.name || 'documento';
        if (extracted && extracted.trim().length > 0) {
          parts.push(`--- Arquivo: ${name} ---\n${extracted.trim()}`);
        } else {
          parts.push(`--- Arquivo: ${name} ---\n(sem texto extraível)`);
        }
      } catch (err: any) {
        const name = file.name || 'documento';
        this.logger.warn(
          `Falha ao extrair texto do arquivo ${name}: ${err?.message || err}`,
        );
        parts.push(`--- Arquivo: ${name} ---\n(erro ao extrair texto)`);
      }
    }

    // Proteção simples contra payloads enormes
    const combined = parts.join('\n\n');
    const MAX_CHARS = 150_000;
    const capped =
      combined.length > MAX_CHARS ? combined.slice(0, MAX_CHARS) : combined;

    return { text: capped, filesProcessed: files.length };
  }

  private decodeToBuffer(file: AgentInputFile): {
    buffer: Buffer;
    mimeType?: string;
    extension?: string;
  } {
    let base64 = file.data;
    let mimeType: string | undefined;

    if (typeof base64 === 'string' && base64.startsWith('data:')) {
      const match = base64.match(/^data:([^;]+);base64,(.*)$/);
      if (match) {
        mimeType = match[1];
        base64 = match[2];
      } else {
        // data:... sem base64 explícito
        const idx = base64.indexOf(',');
        if (idx !== -1) {
          base64 = base64.slice(idx + 1);
        }
      }
    }

    const extension = file.name?.split('.').pop()?.toLowerCase();

    return {
      buffer: Buffer.from(base64, 'base64'),
      mimeType: file.type || mimeType,
      extension,
    };
  }

  private async extractText(
    buffer: Buffer,
    mimeType?: string,
    extension?: string,
  ): Promise<string> {
    const ext = (extension || '').toLowerCase();
    const mt = (mimeType || '').toLowerCase();

    // PDF
    if (ext === 'pdf' || mt.includes('pdf')) {
      const res = await pdfParse(buffer);
      return res?.text || '';
    }

    // DOCX
    if (
      ext === 'docx' ||
      mt.includes('wordprocessingml') ||
      mt.includes('msword')
    ) {
      const res = await mammoth.extractRawText({ buffer });
      return res?.value || '';
    }

    // XLSX
    if (ext === 'xlsx' || mt.includes('spreadsheetml')) {
      const wb = XLSX.read(buffer, { type: 'buffer' });
      const sheetTexts: string[] = [];

      for (const sheetName of wb.SheetNames || []) {
        const ws = wb.Sheets[sheetName];
        if (!ws) continue;

        const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
        const trimmed = (csv || '').trim();
        if (trimmed.length > 0) {
          sheetTexts.push(`### Planilha: ${sheetName}\n${trimmed}`);
        }
      }

      return sheetTexts.join('\n\n');
    }

    this.logger.warn(
      `Formato não suportado para extração: ext=${ext || '-'} mime=${mt || '-'}`,
    );
    return '';
  }
}

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import puppeteer, { Browser } from 'puppeteer';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

export interface PdfRenderContext {
  institutionName?: string;
  institutionCnpj?: string;
  schoolName?: string;
  schoolCnpj?: string;
  userNameOrEmail?: string;
  generatedAtIso?: string;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

@Injectable()
export class MarkdownPdfService implements OnModuleDestroy {
  private readonly logger = new Logger(MarkdownPdfService.name);
  private browser: Browser | null = null;
  private launching: Promise<Browser> | null = null;

  async onModuleDestroy() {
    try {
      await this.browser?.close();
    } catch {
      // ignore
    }
    this.browser = null;
    this.launching = null;
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser) return this.browser;
    if (this.launching) return this.launching;

    this.launching = puppeteer
      .launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      })
      .then((b) => {
        this.browser = b;
        this.launching = null;
        b.on('disconnected', () => {
          this.browser = null;
        });
        return b;
      })
      .catch((err) => {
        this.launching = null;
        throw err;
      });

    return this.launching;
  }

  private markdownToSafeHtml(markdown: string): string {
    marked.setOptions({
      gfm: true,
      breaks: true,
    });

    const raw = marked.parse(markdown || '') as string;

    const clean = sanitizeHtml(raw, {
      allowedTags: [
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'p',
        'br',
        'hr',
        'strong',
        'em',
        'b',
        'i',
        'u',
        'blockquote',
        'ul',
        'ol',
        'li',
        'code',
        'pre',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        'a',
        'span',
        'div',
      ],
      allowedAttributes: {
        a: ['href', 'name', 'target', 'rel'],
        '*': ['class', 'style'],
      },
      allowedSchemes: ['http', 'https', 'mailto'],
      transformTags: {
        a: (tagName, attribs) => {
          const href = attribs.href || '';
          return {
            tagName,
            attribs: {
              ...attribs,
              href,
              target: '_blank',
              rel: 'noopener noreferrer',
            },
          };
        },
      },
    });

    return clean;
  }

  private buildHtmlDocument(bodyHtml: string): string {
    // CSS simples e consistente (A4)
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    :root { --text: #0f172a; --muted: #475569; --border: #e2e8f0; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, "Noto Sans", "Liberation Sans", sans-serif;
      color: var(--text);
      font-size: 12px;
      line-height: 1.55;
      margin: 0;
      padding: 0;
    }
    .content { padding: 0; }
    h1 { font-size: 20px; margin: 0 0 10px; }
    h2 { font-size: 15px; margin: 18px 0 8px; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
    h3 { font-size: 13px; margin: 14px 0 6px; }
    p { margin: 0 0 10px; }
    ul, ol { margin: 0 0 10px 18px; padding: 0; }
    blockquote { margin: 10px 0; padding: 10px 12px; border-left: 3px solid var(--border); background: #f8fafc; color: var(--muted); }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; font-size: 11px; }
    pre { background: #0b1220; color: #e2e8f0; padding: 10px 12px; border-radius: 8px; overflow: auto; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { border: 1px solid var(--border); padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; }
    a { color: #2563eb; text-decoration: none; }
  </style>
</head>
<body>
  <div class="content">
    ${bodyHtml}
  </div>
</body>
</html>`;
  }

  private buildHeaderTemplate(ctx: PdfRenderContext) {
    const institution = escapeHtml(ctx.institutionName || 'Instituição');
    const school = escapeHtml(ctx.schoolName || '');
    const user = escapeHtml(ctx.userNameOrEmail || '');

    const generatedAt = ctx.generatedAtIso
      ? escapeHtml(new Date(ctx.generatedAtIso).toLocaleString('pt-BR'))
      : escapeHtml(new Date().toLocaleString('pt-BR'));

    // Importante: header/footer templates do Puppeteer não suportam CSS externo.
    return `
<div style="width: 100%; font-size: 9px; padding: 0 18px;">
  <div style="display:flex; justify-content:space-between; align-items:flex-end; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
    <div style="display:flex; flex-direction:column; gap: 2px;">
      <div style="font-weight: 700; color:#0f172a;">${institution}</div>
      ${school ? `<div style=\"color:#475569;\">${school}</div>` : ''}
    </div>
    <div style="text-align:right; color:#475569;">
      <div>Gerado em: ${generatedAt}</div>
      ${user ? `<div>Usuário: ${user}</div>` : ''}
    </div>
  </div>
</div>`;
  }

  private buildFooterTemplate(ctx: PdfRenderContext) {
    const institution = escapeHtml(ctx.institutionName || 'Instituição');
    const school = escapeHtml(ctx.schoolName || '');

    const left = school ? `${institution} • ${school}` : institution;

    return `
<div style="width: 100%; font-size: 9px; padding: 0 18px;">
  <div style="display:flex; justify-content:space-between; align-items:flex-start; border-top: 1px solid #e2e8f0; padding-top: 6px; color:#475569;">
    <span>${left}</span>
    <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
  </div>
</div>`;
  }

  async renderPdfFromMarkdown(
    markdown: string,
    ctx: PdfRenderContext,
  ): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      const safeHtml = this.markdownToSafeHtml(markdown);
      const html = this.buildHtmlDocument(safeHtml);

      await page.setContent(html, {
        waitUntil: ['domcontentloaded', 'networkidle0'],
      });

      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: this.buildHeaderTemplate(ctx),
        footerTemplate: this.buildFooterTemplate(ctx),
        margin: {
          top: '90px',
          bottom: '70px',
          left: '25px',
          right: '25px',
        },
      });

      return Buffer.from(pdf);
    } catch (err: any) {
      this.logger.error(
        'Erro ao renderizar PDF com Puppeteer',
        err?.message || err,
      );
      throw err;
    } finally {
      await page.close();
    }
  }
}

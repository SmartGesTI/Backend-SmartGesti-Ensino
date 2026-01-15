import { Injectable } from '@nestjs/common';
import { jsPDF } from 'jspdf';

export interface ReportSection {
  heading: string;
  body?: string;
  bullets?: string[];
  table?: { headers: string[]; rows: string[][] };
  raw_json?: any;
}

export interface ReportDocument {
  title: string;
  generated_at: string;
  summary?: string;
  sections: ReportSection[];
  metadata?: Record<string, any>;
}

@Injectable()
export class PdfGeneratorService {
  /**
   * Normaliza qualquer payload vindo dos nós de IA em um ReportDocument.
   */
  normalizeReportData(input: any): ReportDocument {
    const nowIso = new Date().toISOString();
    const title = input?.title || input?.report_title || 'Relatório Gerado';

    const summary =
      input?.summary ||
      (typeof input === 'string' ? input : undefined) ||
      input?.text;

    const keyPoints: string[] = input?.key_points || input?.bullets || [];

    // Converte analises ou objetos arbitrários em seções
    const sections: ReportSection[] = [];

    if (summary) {
      sections.push({
        heading: 'Resumo',
        body: summary,
        bullets: keyPoints.length ? keyPoints : undefined,
      });
    }

    if (input?.analysis) {
      const a = input.analysis;
      const bullets: string[] = [];
      if (a.sentiment) bullets.push(`Sentimento: ${a.sentiment}`);
      if (a.topics?.length)
        bullets.push(...a.topics.map((t: string) => `Tópico: ${t}`));
      sections.push({
        heading: 'Análise Detalhada',
        body: a.description || undefined,
        bullets: bullets.length ? bullets : undefined,
        raw_json: a,
      });
    }

    // Se veio um objeto arbitrário, tentar criar seções em vez de despejar JSON cru
    if (!sections.length && typeof input === 'object' && input !== null) {
      const topKeys = Object.keys(input);
      if (topKeys.length) {
        topKeys.forEach((key) => {
          const value = (input as any)[key];
          if (typeof value === 'string') {
            sections.push({
              heading: this.titleCase(key),
              body: value,
            });
          } else if (Array.isArray(value)) {
            const bullets = value
              .map((v) => (typeof v === 'string' ? v : JSON.stringify(v)))
              .slice(0, 10);
            sections.push({
              heading: this.titleCase(key),
              bullets,
              raw_json: bullets.length >= value.length ? undefined : value,
            });
          } else if (typeof value === 'object' && value !== null) {
            // Flatten one level
            const bullets = Object.entries(value).map(
              ([k, v]) => `${this.titleCase(k)}: ${this.prettyValue(v)}`,
            );
            sections.push({
              heading: this.titleCase(key),
              bullets: bullets.slice(0, 12),
              raw_json: bullets.length > 12 ? value : undefined,
            });
          }
        });
      }
    }

    return {
      title,
      generated_at: input?.generated_at || nowIso,
      summary,
      sections,
      metadata: input?.metadata || {},
    };
  }

  /**
   * Gera um arquivo PDF a partir do ReportDocument normalizado
   */
  async generatePDF(report: ReportDocument): Promise<Buffer> {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 18;
    const maxWidth = pageWidth - 2 * margin;
    let y = margin;

    const addPageIfNeeded = (space: number) => {
      if (y + space > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
    };

    // Título
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(report.title, margin, y);
    y += 8;

    // Data
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const date = new Date(report.generated_at || Date.now()).toLocaleString(
      'pt-BR',
    );
    doc.text(`Gerado em: ${date}`, margin, y);
    y += 10;

    // Seções
    doc.setFont('helvetica', 'normal');
    report.sections.forEach((section) => {
      addPageIfNeeded(20);
      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.text(section.heading, margin, y);
      y += 7;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      if (section.body) {
        const lines = doc.splitTextToSize(section.body, maxWidth);
        lines.forEach((line: string) => {
          addPageIfNeeded(6);
          doc.text(line, margin, y);
          y += 6;
        });
        y += 2;
      }

      if (section.bullets?.length) {
        section.bullets.forEach((b) => {
          addPageIfNeeded(6);
          doc.text(`• ${b}`, margin + 2, y);
          y += 6;
        });
        y += 2;
      }

      if (section.table) {
        const { headers, rows } = section.table;
        addPageIfNeeded(10);
        doc.setFont('helvetica', 'bold');
        doc.text(headers.join(' | '), margin, y);
        y += 6;
        doc.setFont('helvetica', 'normal');
        rows.forEach((row) => {
          addPageIfNeeded(6);
          doc.text(row.join(' | '), margin, y);
          y += 6;
        });
        y += 4;
      }

      if (section.raw_json && !section.body && !section.bullets) {
        // Print pretty JSON
        const jsonString = JSON.stringify(section.raw_json, null, 2);
        const lines = doc.splitTextToSize(jsonString, maxWidth);
        lines.forEach((line: string) => {
          addPageIfNeeded(6);
          doc.text(line, margin, y);
          y += 6;
        });
        y += 2;
      }
    });

    const pdfOutput = doc.output('arraybuffer');
    return Buffer.from(pdfOutput);
  }

  /**
   * Markdown a partir do ReportDocument
   */
  generateMarkdown(report: ReportDocument): string {
    let md = `# ${report.title}\\n\\n`;
    md += `**Gerado em:** ${new Date(report.generated_at || Date.now()).toLocaleString('pt-BR')}\\n\\n`;

    report.sections.forEach((section) => {
      md += `## ${section.heading}\\n\\n`;
      if (section.body) md += `${section.body}\\n\\n`;
      if (section.bullets?.length) {
        section.bullets.forEach((b) => (md += `- ${b}\\n`));
        md += '\\n';
      }
      if (section.table) {
        md += `| ${section.table.headers.join(' | ')} |\\n`;
        md += `| ${section.table.headers.map(() => '---').join(' | ')} |\\n`;
        section.table.rows.forEach((row) => {
          md += `| ${row.join(' | ')} |\\n`;
        });
        md += '\\n';
      }
      if (section.raw_json && !section.body && !section.bullets) {
        md += '```json\\n';
        md += JSON.stringify(section.raw_json, null, 2);
        md += '\\n```\\n\\n';
      }
    });

    return md;
  }

  /**
   * JSON string a partir do ReportDocument
   */
  generateJSON(report: ReportDocument): string {
    const jsonData = {
      metadata: {
        generated_at: report.generated_at || new Date().toISOString(),
        format: 'json',
      },
      ...report,
    };
    return JSON.stringify(jsonData, null, 2);
  }

  private titleCase(text: string): string {
    return text
      .replace(/[_-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/(^\w|\s\w)/g, (m) => m.toUpperCase());
  }

  private prettyValue(v: any): string {
    if (v === null || v === undefined) return String(v);
    if (typeof v === 'string') return v;
    if (typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (Array.isArray(v))
      return v
        .slice(0, 3)
        .map((x) => this.prettyValue(x))
        .join(', ');
    return JSON.stringify(v);
  }
}

import { Injectable } from '@nestjs/common';
import { LoggerService } from '../../../common/logger/logger.service';
import { CHUNK_CONFIG, DocumentFrontmatter } from '../constants/rag.constants';

export interface Chunk {
  content: string;
  sectionTitle: string | null;
  chunkIndex: number;
  tokenCount: number;
  metadata: Record<string, any>;
}

interface Section {
  title: string;
  level: number;
  content: string;
}

@Injectable()
export class ChunkService {
  constructor(private readonly logger: LoggerService) {}

  /**
   * Divide o conteúdo markdown em chunks otimizados para RAG
   * Estratégia: dividir por seções (headings) e depois por parágrafos se necessário
   */
  chunkContent(content: string, frontmatter: DocumentFrontmatter): Chunk[] {
    const chunks: Chunk[] = [];
    
    // 1. Extrair seções baseadas em headings
    const sections = this.extractSections(content);
    
    this.logger.log(
      `Documento "${frontmatter.title}": ${sections.length} seções encontradas`,
      'ChunkService',
    );

    let chunkIndex = 0;

    for (const section of sections) {
      // 2. Verificar se a seção cabe em um único chunk
      const sectionTokens = this.estimateTokens(section.content);

      if (sectionTokens <= CHUNK_CONFIG.MAX_TOKENS) {
        // Seção cabe inteira
        if (sectionTokens >= CHUNK_CONFIG.MIN_CHUNK_SIZE) {
          chunks.push({
            content: this.formatChunkContent(section.title, section.content, frontmatter),
            sectionTitle: section.title,
            chunkIndex: chunkIndex++,
            tokenCount: sectionTokens,
            metadata: {
              headingLevel: section.level,
              documentId: frontmatter.id,
              category: frontmatter.category,
            },
          });
        }
      } else {
        // Seção muito grande - dividir por parágrafos
        const subChunks = this.splitLargeSection(section, frontmatter);
        for (const subChunk of subChunks) {
          chunks.push({
            ...subChunk,
            chunkIndex: chunkIndex++,
          });
        }
      }
    }

    // 3. Se não encontrou seções, dividir por parágrafos
    if (chunks.length === 0) {
      const paragraphChunks = this.chunkByParagraphs(content, frontmatter);
      for (const chunk of paragraphChunks) {
        chunks.push({
          ...chunk,
          chunkIndex: chunkIndex++,
        });
      }
    }

    this.logger.log(
      `Documento "${frontmatter.title}": ${chunks.length} chunks criados`,
      'ChunkService',
    );

    return chunks;
  }

  /**
   * Extrai seções baseadas em headings markdown
   */
  private extractSections(content: string): Section[] {
    const sections: Section[] = [];
    const lines = content.split('\n');
    
    let currentSection: Section | null = null;
    let contentBuffer: string[] = [];

    for (const line of lines) {
      // Detectar heading (## Título)
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        // Salvar seção anterior se existir
        if (currentSection) {
          currentSection.content = contentBuffer.join('\n').trim();
          if (currentSection.content.length > 0) {
            sections.push(currentSection);
          }
        }

        // Iniciar nova seção
        currentSection = {
          title: headingMatch[2].trim(),
          level: headingMatch[1].length,
          content: '',
        };
        contentBuffer = [];
      } else {
        contentBuffer.push(line);
      }
    }

    // Salvar última seção
    if (currentSection) {
      currentSection.content = contentBuffer.join('\n').trim();
      if (currentSection.content.length > 0) {
        sections.push(currentSection);
      }
    }

    // Se não encontrou seções, criar uma única com todo o conteúdo
    if (sections.length === 0 && content.trim().length > 0) {
      sections.push({
        title: 'Conteúdo',
        level: 2,
        content: content.trim(),
      });
    }

    return sections;
  }

  /**
   * Divide uma seção grande em chunks menores por parágrafos
   */
  private splitLargeSection(section: Section, frontmatter: DocumentFrontmatter): Omit<Chunk, 'chunkIndex'>[] {
    const chunks: Omit<Chunk, 'chunkIndex'>[] = [];
    const paragraphs = section.content.split(/\n\n+/);
    
    let currentContent = '';
    let currentTokens = 0;

    for (const paragraph of paragraphs) {
      const paragraphTokens = this.estimateTokens(paragraph);

      // Se adicionar este parágrafo excede o limite
      if (currentTokens + paragraphTokens > CHUNK_CONFIG.MAX_TOKENS && currentContent.length > 0) {
        // Salvar chunk atual
        chunks.push({
          content: this.formatChunkContent(section.title, currentContent.trim(), frontmatter),
          sectionTitle: section.title,
          tokenCount: currentTokens,
          metadata: {
            headingLevel: section.level,
            documentId: frontmatter.id,
            category: frontmatter.category,
            isSplit: true,
          },
        });

        // Iniciar novo chunk com overlap
        const overlapContent = this.getOverlapContent(currentContent, CHUNK_CONFIG.OVERLAP_TOKENS);
        currentContent = overlapContent + '\n\n' + paragraph;
        currentTokens = this.estimateTokens(currentContent);
      } else {
        // Adicionar ao chunk atual
        currentContent += (currentContent.length > 0 ? '\n\n' : '') + paragraph;
        currentTokens += paragraphTokens;
      }
    }

    // Salvar último chunk
    if (currentContent.trim().length > 0 && currentTokens >= CHUNK_CONFIG.MIN_CHUNK_SIZE) {
      chunks.push({
        content: this.formatChunkContent(section.title, currentContent.trim(), frontmatter),
        sectionTitle: section.title,
        tokenCount: currentTokens,
        metadata: {
          headingLevel: section.level,
          documentId: frontmatter.id,
          category: frontmatter.category,
          isSplit: chunks.length > 0,
        },
      });
    }

    return chunks;
  }

  /**
   * Divide conteúdo por parágrafos (fallback quando não há headings)
   */
  private chunkByParagraphs(content: string, frontmatter: DocumentFrontmatter): Omit<Chunk, 'chunkIndex'>[] {
    const section: Section = {
      title: frontmatter.title,
      level: 1,
      content: content,
    };
    return this.splitLargeSection(section, frontmatter);
  }

  /**
   * Formata o conteúdo do chunk incluindo contexto
   */
  private formatChunkContent(
    sectionTitle: string,
    content: string,
    frontmatter: DocumentFrontmatter,
  ): string {
    const parts: string[] = [];

    // Adicionar contexto do documento
    parts.push(`[Documento: ${frontmatter.title}]`);
    
    if (frontmatter.menuPath) {
      parts.push(`[Menu: ${frontmatter.menuPath}]`);
    }
    
    if (frontmatter.route) {
      parts.push(`[Rota: ${frontmatter.route}]`);
    }

    if (sectionTitle && sectionTitle !== frontmatter.title) {
      parts.push(`[Seção: ${sectionTitle}]`);
    }

    parts.push('');
    parts.push(content);

    return parts.join('\n');
  }

  /**
   * Obtém conteúdo para overlap (últimos N tokens aproximados)
   */
  private getOverlapContent(content: string, targetTokens: number): string {
    const words = content.split(/\s+/);
    const targetWords = Math.floor(targetTokens * 0.75); // ~0.75 palavras por token
    
    if (words.length <= targetWords) {
      return content;
    }

    return words.slice(-targetWords).join(' ');
  }

  /**
   * Estima número de tokens (aproximação: ~0.75 tokens por palavra em português)
   */
  estimateTokens(text: string): number {
    if (!text) return 0;
    const words = text.split(/\s+/).filter(w => w.length > 0);
    return Math.ceil(words.length * 1.3); // Português usa ~1.3 tokens por palavra
  }
}

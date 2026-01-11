import { Injectable } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as yaml from 'yaml';
import { LoggerService } from '../../../common/logger/logger.service';
import { SupabaseService } from '../../../supabase/supabase.service';
import { EmbeddingService } from './embedding.service';
import { ChunkService } from './chunk.service';
import { IngestResponseDto, RagStatusDto } from '../dto';
import { DocumentFrontmatter } from '../constants/rag.constants';

interface ParsedDocument {
  frontmatter: DocumentFrontmatter;
  content: string;
}

@Injectable()
export class IngestionService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly embeddingService: EmbeddingService,
    private readonly chunkService: ChunkService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Ingere um documento markdown na knowledge base
   */
  async ingestDocument(filePath: string, content?: string): Promise<IngestResponseDto> {
    try {
      this.logger.log(`Ingerindo documento: ${filePath}`, 'IngestionService');

      const client = this.supabase.getClient();

      // 1. Ler ou usar conteúdo fornecido
      const fileContent = content || await fs.readFile(filePath, 'utf-8');

      // 2. Parse markdown com frontmatter
      const parsed = this.parseMarkdown(fileContent, filePath);

      // 3. Gerar hash do conteúdo
      const contentHash = this.hashContent(parsed.content);

      // 4. Verificar se documento já existe e se mudou
      const { data: existingDocs, error: selectError } = await client
        .from('rag_documents')
        .select('*')
        .eq('file_path', filePath)
        .single();

      const existing = selectError?.code !== 'PGRST116' ? existingDocs : null;

      if (existing && existing.content_hash === contentHash) {
        this.logger.log(
          `Documento ${filePath} não mudou, pulando`,
          'IngestionService',
        );
        return {
          success: true,
          documentId: existing.id,
          title: existing.title,
          chunksCreated: 0,
          message: 'Documento não mudou, nenhuma atualização necessária',
        };
      }

      // 5. Se existe, deletar chunks antigos
      if (existing) {
        await client.from('rag_chunks').delete().eq('document_id', existing.id);
        this.logger.log(
          `Chunks antigos do documento ${filePath} removidos`,
          'IngestionService',
        );
      }

      // 6. Criar chunks
      const chunks = this.chunkService.chunkContent(parsed.content, parsed.frontmatter);

      if (chunks.length === 0) {
        this.logger.warn(
          `Documento ${filePath} não gerou chunks válidos`,
          'IngestionService',
        );
        return {
          success: false,
          documentId: existing?.id || '',
          title: parsed.frontmatter.title,
          chunksCreated: 0,
          message: 'Documento não gerou chunks válidos',
        };
      }

      // 7. Gerar embeddings em batch
      const embeddings = await this.embeddingService.generateEmbeddings(
        chunks.map(c => c.content),
      );

      // 8. Salvar documento
      let documentId: string;
      const documentData = {
        title: parsed.frontmatter.title,
        file_path: filePath,
        category: parsed.frontmatter.category,
        route_pattern: parsed.frontmatter.route || null,
        menu_path: parsed.frontmatter.menuPath || null,
        tags: parsed.frontmatter.tags || [],
        metadata: {
          permissions: parsed.frontmatter.permissions,
          relatedPages: parsed.frontmatter.relatedPages,
          lastUpdated: parsed.frontmatter.lastUpdated,
        },
        content_hash: contentHash,
      };

      if (existing) {
        const { error: updateError } = await client
          .from('rag_documents')
          .update(documentData)
          .eq('id', existing.id);
        if (updateError) throw updateError;
        documentId = existing.id;
      } else {
        const { data: newDoc, error: insertError } = await client
          .from('rag_documents')
          .insert([documentData])
          .select();
        if (insertError) throw insertError;
        documentId = newDoc[0].id;
      }

      // 9. Salvar chunks com embeddings
      const chunksToInsert = chunks.map((chunk, i) => ({
        document_id: documentId,
        chunk_index: chunk.chunkIndex,
        content: chunk.content,
        section_title: chunk.sectionTitle,
        embedding: embeddings[i].embedding,
        token_count: embeddings[i].tokenCount,
        metadata: chunk.metadata,
      }));

      const { error: chunksError } = await client
        .from('rag_chunks')
        .insert(chunksToInsert);
      if (chunksError) throw chunksError;

      this.logger.log(
        `Documento ${filePath} ingerido: ${chunks.length} chunks criados`,
        'IngestionService',
      );

      return {
        success: true,
        documentId,
        title: parsed.frontmatter.title,
        chunksCreated: chunks.length,
        message: `Documento ingerido com sucesso: ${chunks.length} chunks criados`,
      };
    } catch (error: any) {
      this.logger.error(
        `Erro ao ingerir documento ${filePath}: ${error.message}`,
        error.stack,
        'IngestionService',
      );
      throw error;
    }
  }

  /**
   * Ingere todos os documentos de um diretório
   */
  async ingestDirectory(dirPath: string): Promise<IngestResponseDto[]> {
    const results: IngestResponseDto[] = [];

    try {
      const files = await this.findMarkdownFiles(dirPath);
      
      this.logger.log(
        `Encontrados ${files.length} arquivos markdown em ${dirPath}`,
        'IngestionService',
      );

      for (const file of files) {
        try {
          const result = await this.ingestDocument(file);
          results.push(result);
        } catch (error: any) {
          this.logger.error(
            `Erro ao processar ${file}: ${error.message}`,
            'IngestionService',
          );
          results.push({
            success: false,
            documentId: '',
            title: path.basename(file),
            chunksCreated: 0,
            message: `Erro: ${error.message}`,
          });
        }
      }

      const successful = results.filter(r => r.success).length;
      const totalChunks = results.reduce((sum, r) => sum + r.chunksCreated, 0);
      
      this.logger.log(
        `Ingestão completa: ${successful}/${files.length} documentos, ${totalChunks} chunks`,
        'IngestionService',
      );

      return results;
    } catch (error: any) {
      this.logger.error(
        `Erro ao ingerir diretório ${dirPath}: ${error.message}`,
        error.stack,
        'IngestionService',
      );
      throw error;
    }
  }

  /**
   * Retorna status da knowledge base
   */
  async getStatus(): Promise<RagStatusDto> {
    const client = this.supabase.getClient();

    // Contar documentos
    const { count: docCount } = await client
      .from('rag_documents')
      .select('*', { count: 'exact', head: true });

    // Contar chunks
    const { count: chunkCount } = await client
      .from('rag_chunks')
      .select('*', { count: 'exact', head: true });

    // Contar por categoria
    const { data: categoryData } = await client
      .from('rag_documents')
      .select('category');

    const categoryCounts: Record<string, number> = {};
    if (categoryData) {
      for (const doc of categoryData) {
        categoryCounts[doc.category] = (categoryCounts[doc.category] || 0) + 1;
      }
    }

    // Última atualização
    const { data: lastDoc } = await client
      .from('rag_documents')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    return {
      totalDocuments: docCount || 0,
      totalChunks: chunkCount || 0,
      categoryCounts,
      lastUpdated: lastDoc?.updated_at ? new Date(lastDoc.updated_at) : null,
    };
  }

  /**
   * Remove documento da knowledge base
   */
  async removeDocument(documentId: string): Promise<boolean> {
    const client = this.supabase.getClient();
    const { error } = await client
      .from('rag_documents')
      .delete()
      .eq('id', documentId);
    return !error;
  }

  /**
   * Reindexar tudo (deletar e reingerir)
   */
  async reindexAll(dirPath: string): Promise<IngestResponseDto[]> {
    this.logger.log('Reindexando toda a knowledge base...', 'IngestionService');
    
    const client = this.supabase.getClient();
    // Deletar todos os documentos (chunks serão deletados em cascade)
    await client.from('rag_documents').delete().gte('created_at', '1900-01-01');
    
    return this.ingestDirectory(dirPath);
  }

  /**
   * Parse markdown com frontmatter YAML
   */
  private parseMarkdown(content: string, filePath: string): ParsedDocument {
    // Detectar frontmatter (entre ---)
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      // Sem frontmatter - usar valores padrão
      const fileName = path.basename(filePath, '.md');
      return {
        frontmatter: {
          id: fileName,
          title: fileName,
          category: 'geral',
        },
        content: content.trim(),
      };
    }

    const frontmatterStr = match[1];
    const markdownContent = match[2];

    try {
      const frontmatter = yaml.parse(frontmatterStr) as DocumentFrontmatter;
      
      // Validar campos obrigatórios
      if (!frontmatter.id) {
        frontmatter.id = path.basename(filePath, '.md');
      }
      if (!frontmatter.title) {
        frontmatter.title = frontmatter.id;
      }
      if (!frontmatter.category) {
        frontmatter.category = 'geral';
      }

      return {
        frontmatter,
        content: markdownContent.trim(),
      };
    } catch (error: any) {
      this.logger.warn(
        `Erro ao parsear frontmatter de ${filePath}: ${error.message}`,
        'IngestionService',
      );
      const fileName = path.basename(filePath, '.md');
      return {
        frontmatter: {
          id: fileName,
          title: fileName,
          category: 'geral',
        },
        content: markdownContent.trim(),
      };
    }
  }

  /**
   * Encontra arquivos markdown recursivamente
   */
  private async findMarkdownFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];

    async function scan(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          files.push(fullPath);
        }
      }
    }

    await scan(dirPath);
    return files;
  }

  /**
   * Gera hash MD5 do conteúdo
   */
  private hashContent(content: string): string {
    return crypto.createHash('md5').update(content).digest('hex');
  }
}

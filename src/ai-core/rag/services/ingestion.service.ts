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
   * Parse markdown com frontmatter YAML ou formato customizado [Documento:], [Menu:], [Rota:]
   */
  private parseMarkdown(content: string, filePath: string): ParsedDocument {
    const fileName = path.basename(filePath, '.md');
    
    // 1. Tentar frontmatter YAML (entre ---)
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const yamlMatch = content.match(frontmatterRegex);

    if (yamlMatch) {
      const frontmatterStr = yamlMatch[1];
      const markdownContent = yamlMatch[2];

      try {
        const frontmatter = yaml.parse(frontmatterStr) as DocumentFrontmatter;
        
        // Validar campos obrigatórios
        if (!frontmatter.id) frontmatter.id = fileName;
        if (!frontmatter.title) frontmatter.title = frontmatter.id;
        if (!frontmatter.category) frontmatter.category = 'geral';

        return {
          frontmatter,
          content: markdownContent.trim(),
        };
      } catch (error: any) {
        this.logger.warn(
          `Erro ao parsear YAML frontmatter de ${filePath}: ${error.message}`,
          'IngestionService',
        );
      }
    }

    // 2. Tentar formato customizado: [Documento:], [Menu:], [Rota:]
    const customFormatResult = this.parseCustomFormat(content, filePath);
    if (customFormatResult) {
      return customFormatResult;
    }

    // 3. Fallback: usar valores padrão baseados no caminho do arquivo
    const category = this.inferCategoryFromPath(filePath);
    return {
      frontmatter: {
        id: fileName,
        title: fileName,
        category,
      },
      content: content.trim(),
    };
  }

  /**
   * Parse formato customizado: [Documento:], [Menu:], [Rota:]
   */
  private parseCustomFormat(content: string, filePath: string): ParsedDocument | null {
    const fileName = path.basename(filePath, '.md');
    const lines = content.split('\n');
    
    let title = '';
    let menuPath = '';
    let route = '';
    let contentStartIndex = 0;

    // Buscar metadados nas primeiras linhas
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].trim();
      
      // [Documento: Dashboard - Visão Geral]
      const docMatch = line.match(/^\[Documento:\s*(.+?)\]$/i);
      if (docMatch) {
        title = docMatch[1].trim();
        contentStartIndex = i + 1;
        continue;
      }
      
      // [Menu: Painel > Visão Geral]
      const menuMatch = line.match(/^\[Menu:\s*(.+?)\]$/i);
      if (menuMatch) {
        menuPath = menuMatch[1].trim();
        contentStartIndex = i + 1;
        continue;
      }
      
      // [Rota: /escola/:slug/painel]
      const routeMatch = line.match(/^\[Rota:\s*(.+?)\]$/i);
      if (routeMatch) {
        route = routeMatch[1].trim();
        contentStartIndex = i + 1;
        continue;
      }
      
      // Se a linha não é metadado e não está vazia, parar de buscar
      if (line && !line.startsWith('[')) {
        break;
      }
    }

    // Se encontrou pelo menos o título, usar formato customizado
    if (title) {
      const category = this.inferCategoryFromPath(filePath);
      const markdownContent = lines.slice(contentStartIndex).join('\n').trim();
      
      this.logger.debug(
        `Parsed custom format: title="${title}", menu="${menuPath}", route="${route}", category="${category}"`,
        'IngestionService',
      );

      return {
        frontmatter: {
          id: fileName,
          title,
          category,
          route: route || undefined,
          menuPath: menuPath || undefined,
        },
        content: markdownContent,
      };
    }

    return null;
  }

  /**
   * Infere categoria baseada no caminho do arquivo
   */
  private inferCategoryFromPath(filePath: string): 'ia' | 'dashboard' | 'academico' | 'administracao' | 'calendario' | 'sites' | 'documentos' | 'configuracoes' | 'geral' {
    const pathLower = filePath.toLowerCase();
    
    if (pathLower.includes('/dashboard/') || pathLower.includes('/painel/')) {
      return 'dashboard';
    }
    if (pathLower.includes('/ia/') || pathLower.includes('/agente')) {
      return 'ia';
    }
    if (pathLower.includes('/academico/') || pathLower.includes('/turmas/') || pathLower.includes('/alunos/')) {
      return 'academico';
    }
    if (pathLower.includes('/administracao/') || pathLower.includes('/admin/')) {
      return 'administracao';
    }
    if (pathLower.includes('/calendario/') || pathLower.includes('/eventos/')) {
      return 'calendario';
    }
    if (pathLower.includes('/sites/')) {
      return 'sites';
    }
    if (pathLower.includes('/documentos/')) {
      return 'documentos';
    }
    if (pathLower.includes('/configuracoes/') || pathLower.includes('/config/')) {
      return 'configuracoes';
    }
    
    return 'geral';
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

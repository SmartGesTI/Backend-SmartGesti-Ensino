import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { EmbeddingService } from '../rag/services/embedding.service';
import { SearchResultDto } from '../rag/dto';
import { RagCategory, SEARCH_CONFIG } from '../rag/constants/rag.constants';

export interface KnowledgeRetrievalOptions {
  topK?: number;
  category?: RagCategory;
  tags?: string[];
  similarityThreshold?: number;
  tenantId?: string; // Para isolamento multi-tenant
}

/**
 * Serviço de retrieval de conhecimento
 * Move lógica do SearchService do RAG para o Core IA
 * Suporta isolamento multi-tenant
 */
@Injectable()
export class KnowledgeRetrievalService {
  private readonly logger = new Logger(KnowledgeRetrievalService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  /**
   * Busca semântica usando pgvector
   */
  async semanticSearch(
    query: string,
    options: KnowledgeRetrievalOptions = {},
  ): Promise<SearchResultDto[]> {
    const {
      topK = SEARCH_CONFIG.DEFAULT_TOP_K,
      category,
      tags,
      similarityThreshold = SEARCH_CONFIG.SIMILARITY_THRESHOLD,
      tenantId,
    } = options;

    try {
      this.logger.log(
        `Busca semântica: "${query.substring(0, 50)}..." (topK: ${topK}, category: ${category || 'all'}, tenant: ${tenantId || 'global'})`,
      );

      // 1. Gerar embedding da query
      const { embedding } = await this.embeddingService.generateEmbedding(query);
      const vectorStr = this.embeddingService.embeddingToVector(embedding);

      // 2. Chamar função RPC do Supabase
      const client = this.supabase.getClient();
      const { data: results, error } = await client.rpc('match_rag_chunks', {
        query_embedding: vectorStr,
        match_threshold: similarityThreshold,
        match_count: topK,
        category_filter: category || null,
      });

      if (error) throw error;

      this.logger.log(
        `Busca semântica retornou ${results?.length || 0} resultados`,
      );

      // Filtrar por categoria e tags se especificado
      const filtered = (results || []).filter((row: any) => {
        if (category && row.doc_category !== category) return false;
        if (tags && tags.length > 0) {
          const docTags = row.doc_tags || [];
          if (!tags.some(tag => docTags.includes(tag))) return false;
        }
        // TODO: Adicionar filtro por tenantId quando suportado no banco
        return true;
      });

      return filtered.map((row: any) => ({
        id: row.id,
        documentId: row.document_id,
        content: row.content,
        sectionTitle: row.section_title,
        similarity: parseFloat(row.similarity),
        document: {
          id: row.document_id,
          title: row.doc_title || 'Unknown',
          category: row.doc_category || 'geral',
          routePattern: row.route_pattern,
          menuPath: row.menu_path,
          tags: row.doc_tags || [],
        },
        metadata: row.metadata || {},
      }));
    } catch (error: any) {
      this.logger.error(
        `Erro na busca semântica: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Busca híbrida (BM25 + Vector)
   * Combina full-text search com busca vetorial para melhores resultados
   */
  async hybridSearch(
    query: string,
    options: KnowledgeRetrievalOptions = {},
  ): Promise<SearchResultDto[]> {
    const {
      topK = SEARCH_CONFIG.DEFAULT_TOP_K,
      category,
      tags,
      tenantId,
    } = options;

    try {
      this.logger.log(
        `Busca híbrida: "${query.substring(0, 50)}..." (topK: ${topK}, tenant: ${tenantId || 'global'})`,
      );

      // 1. Gerar embedding da query
      const { embedding } = await this.embeddingService.generateEmbedding(query);
      const vectorStr = this.embeddingService.embeddingToVector(embedding);

      // 2. Chamar função RPC de busca híbrida do Supabase
      const client = this.supabase.getClient();
      const { data: results, error } = await client.rpc('hybrid_rag_search', {
        query_text: query,
        query_embedding: vectorStr,
        match_count: topK,
        category_filter: category || null,
      });

      if (error) throw error;
      this.logger.log(
        `Busca híbrida retornou ${results?.length || 0} resultados`,
      );

      // Filtrar por categoria e tags se especificado
      const filtered = (results || []).filter((row: any) => {
        if (category && row.doc_category !== category) return false;
        if (tags && tags.length > 0) {
          const docTags = row.doc_tags || [];
          if (!tags.some(tag => docTags.includes(tag))) return false;
        }
        // TODO: Adicionar filtro por tenantId quando suportado no banco
        return true;
      });

      return filtered.map((row: any) => ({
        id: row.id,
        documentId: row.document_id,
        content: row.content,
        sectionTitle: row.section_title,
        similarity: parseFloat(row.similarity),
        rank: parseFloat(row.combined_rank || 0),
        document: {
          id: row.document_id,
          title: row.doc_title || 'Unknown',
          category: row.doc_category || 'geral',
          routePattern: row.route_pattern,
          menuPath: row.menu_path,
          tags: row.doc_tags || [],
        },
        metadata: row.metadata || {},
      }));
    } catch (error: any) {
      this.logger.error(
        `Erro na busca híbrida: ${error.message}`,
        error.stack,
      );
      // Fallback para busca semântica pura se híbrida falhar
      this.logger.warn('Fallback para busca semântica');
      return this.semanticSearch(query, options);
    }
  }

  /**
   * Busca principal - usa híbrida por padrão
   */
  async search(
    query: string,
    options: KnowledgeRetrievalOptions = {},
  ): Promise<SearchResultDto[]> {
    return this.hybridSearch(query, options);
  }

  /**
   * Formata resultados para contexto do LLM
   */
  formatResultsForContext(results: SearchResultDto[]): string {
    if (results.length === 0) {
      return 'Nenhum resultado encontrado na knowledge base.';
    }

    const formatted = results.map((r, i) => {
      const parts = [
        `[Resultado ${i + 1}]`,
        `Documento: ${r.document.title}`,
      ];

      if (r.document.menuPath) {
        parts.push(`Menu: ${r.document.menuPath}`);
      }

      if (r.document.routePattern) {
        parts.push(`Rota: ${r.document.routePattern}`);
      }

      if (r.sectionTitle) {
        parts.push(`Seção: ${r.sectionTitle}`);
      }

      parts.push(`Similaridade: ${(r.similarity * 100).toFixed(1)}%`);
      parts.push('');
      parts.push(r.content);

      return parts.join('\n');
    });

    return formatted.join('\n\n---\n\n');
  }
}

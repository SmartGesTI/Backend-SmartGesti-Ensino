import { Injectable, Logger } from '@nestjs/common';
import { tool } from 'ai';
import { z } from 'zod';
import { KnowledgeRetrievalService } from '../retrieval/knowledge-retrieval.service';
import { Tool } from '@ai-sdk/provider-utils';

/**
 * Response mode for adaptive RAG strategy
 */
export type RAGResponseMode = 'fast' | 'detailed';

export interface RAGToolContext {
  tenantId?: string;
  userId?: string;
  schoolId?: string;
  /**
   * Response mode for adaptive strategy
   * - fast: top 1-3 chunks, truncated content (300 chars)
   * - detailed: top 6 chunks, full content (800 chars)
   */
  responseMode?: RAGResponseMode;
}

/**
 * RAG Tool for knowledge base retrieval
 * Uses toModelOutput to send only relevant chunks to the model, reducing tokens
 */
@Injectable()
export class RAGTool {
  private readonly logger = new Logger(RAGTool.name);

  constructor(private readonly knowledgeRetrieval: KnowledgeRetrievalService) {}

  /**
   * Create the RAG tool with context injection
   */
  createTool(context: RAGToolContext): Tool {
    return tool({
      description:
        'Busca QUALQUER informação na base de conhecimento do sistema. Use SEMPRE que o usuário perguntar sobre o sistema, suas funcionalidades, processos, configurações ou qualquer dúvida. A base contém informações sobre TODAS as áreas: acadêmico, financeiro, administrativo, RH, matrículas, turmas, alunos, relatórios, IA, e mais. Retorna os documentos mais relevantes via busca semântica.',
      inputSchema: z.object({
        query: z
          .string()
          .describe('A pergunta ou termo de busca para encontrar informações na base de conhecimento'),
        topK: z
          .number()
          .min(1)
          .max(10)
          .optional()
          .describe('Número máximo de resultados a retornar (padrão: 5)'),
        category: z
          .string()
          .optional()
          .describe('Categoria específica para filtrar resultados (ex: "api", "ui", "config")'),
      }),
      execute: async ({ query, topK, category }) => {
        try {
          // Adaptive topK based on response mode
          const mode = context.responseMode || 'fast';
          const effectiveTopK = topK ?? (mode === 'fast' ? 3 : 6);

          this.logger.debug(
            `RAG search: "${query}" (topK: ${effectiveTopK}, mode: ${mode}, category: ${category || 'all'})`,
          );

          const results = await this.knowledgeRetrieval.search(query, {
            topK: effectiveTopK,
            category: category as any,
            tenantId: context.tenantId,
          });

          // Return full results for application logic
          return {
            query,
            mode,
            results: results.map((r) => ({
              id: r.id,
              content: r.content,
              title: r.document.title,
              category: r.document.category,
              similarity: r.similarity,
              sectionTitle: r.sectionTitle,
              routePattern: r.document.routePattern,
              menuPath: r.document.menuPath,
            })),
            count: results.length,
          };
        } catch (error: any) {
          this.logger.error(`RAG tool error: ${error.message}`, error.stack);
          throw new Error(`Erro ao buscar na base de conhecimento: ${error.message}`);
        }
      },
      // Use toModelOutput to send only relevant content to the model, reducing tokens
      toModelOutput: async ({ input, output }) => {
        if (output.results.length === 0) {
          return {
            type: 'text',
            value: `Nenhum resultado encontrado na base de conhecimento para: "${input.query}"`,
          };
        }

        // Adaptive formatting based on response mode
        const mode = output.mode || 'fast';
        const maxResults = mode === 'fast' ? 3 : 6;
        const maxContentLength = mode === 'fast' ? 300 : 800;

        // Format results based on mode
        const formattedResults = output.results
          .slice(0, maxResults)
          .map((r: any, i: number) => {
            const parts = [`[Resultado ${i + 1}] ${r.title || 'Documento'}`];
            if (r.sectionTitle) {
              parts.push(`Seção: ${r.sectionTitle}`);
            }
            if (r.menuPath) {
              parts.push(`Menu: ${r.menuPath}`);
            }
            if (r.routePattern && mode === 'detailed') {
              parts.push(`Rota: ${r.routePattern}`);
            }
            parts.push(`Relevância: ${(r.similarity * 100).toFixed(1)}%`);
            parts.push('');
            // Truncate content based on mode
            const content =
              r.content.length > maxContentLength
                ? r.content.substring(0, maxContentLength) + '...'
                : r.content;
            parts.push(content);
            return parts.join('\n');
          })
          .join('\n\n---\n\n');

        const modeLabel = mode === 'fast' ? '(modo rápido)' : '(modo detalhado)';
        const showMoreNote =
          output.count > maxResults
            ? `\n\n(mostrando os ${maxResults} mais relevantes de ${output.count} resultados)`
            : '';

        return {
          type: 'text',
          value: `Encontrei ${output.count} resultado(s) ${modeLabel} para "${input.query}":\n\n${formattedResults}${showMoreNote}`,
        };
      },
    });
  }
}

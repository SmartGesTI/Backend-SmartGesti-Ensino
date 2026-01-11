import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ToolFactory } from '../../../core/tool/tool.factory';
import { CoreTool } from '../../../core/tool/tool.types';
import { CoreContext } from '../../../core/context/context.types';
import { KnowledgeRetrievalService } from '../../../retrieval/knowledge-retrieval.service';

/**
 * Factory para criar tool de busca na knowledge base
 */
@Injectable()
export class KnowledgeSearchToolFactory {
  constructor(
    private readonly toolFactory: ToolFactory,
    private readonly retrievalService: KnowledgeRetrievalService,
  ) {}

  /**
   * Cria a tool de busca na knowledge base
   */
  create(): CoreTool<CoreContext> {
    return this.toolFactory.create({
      name: 'search_knowledge_base',
      description: `Busca informações na base de conhecimento do SmartGesti-Ensino.
      
Use esta tool para encontrar informações sobre:
- Funcionalidades do sistema
- Como usar páginas e menus
- Workflows e processos
- Perguntas frequentes
- Troubleshooting

IMPORTANTE: Use a query do usuário EXATAMENTE como foi feita. NÃO expanda ou adicione termos.
Use topK=3 por padrão para buscas rápidas e focadas.`,
      parameters: z.object({
        query: z
          .string()
          .describe('Pergunta ou tópico a buscar na base de conhecimento'),
        topK: z
          .number()
          .nullable()
          .default(3)
          .describe('Número de resultados a retornar (padrão: 3)'),
        category: z
          .string()
          .nullable()
          .default(null)
          .describe('Categoria específica para filtrar (ex: ia, academico, dashboard)'),
      }),
      execute: async ({ query, topK, category }, { context }) => {
        const results = await this.retrievalService.hybridSearch(query, {
          tenantId: context.tenantId,
          topK: topK ?? 3,
          category: category || undefined,
        });

        return {
          success: true,
          query,
          results: results.map((r) => ({
            title: r.document.title,
            content: r.content,
            sectionTitle: r.sectionTitle,
            similarity: r.similarity,
            rank: r.rank,
            document: {
              title: r.document.title,
              category: r.document.category,
              routePattern: r.document.routePattern,
              menuPath: r.document.menuPath,
              tags: r.document.tags,
            },
            metadata: r.metadata,
          })),
          totalResults: results.length,
        };
      },
      category: 'knowledge-base',
      tags: ['rag', 'search', 'knowledge', 'shared'],
    });
  }
}

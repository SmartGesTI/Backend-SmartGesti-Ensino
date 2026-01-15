import { Injectable } from '@nestjs/common';
import { Tool, ToolContext } from '../../../agents/shared/tools/tool.interface';
import { SearchService } from '../services/search.service';
import { RAG_CATEGORIES, SEARCH_CONFIG } from '../constants/rag.constants';

/**
 * Tool de busca semântica para o LLM
 * Seguindo GPT-5.2 best practices:
 * - strict: true para garantir schema compliance
 * - Descrição concisa (1-2 sentenças)
 * - additionalProperties: false
 * - Todos os campos em required
 */
@Injectable()
export class SemanticSearchTool implements Tool {
  name = 'rag_search';

  description =
    'Busca informações na knowledge base do SmartGesti-Ensino. Use para encontrar documentação sobre páginas, funcionalidades, menus, rotas, workflows e troubleshooting.';

  parameters = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Pergunta ou termo para buscar na knowledge base',
      },
      category: {
        type: ['string', 'null'],
        enum: [...RAG_CATEGORIES, null],
        description:
          'Categoria para filtrar (opcional). Valores: ia, dashboard, academico, administracao, calendario, sites, documentos, configuracoes, geral',
      },
      topK: {
        type: ['integer', 'null'],
        description: `Número máximo de resultados (1-${SEARCH_CONFIG.MAX_TOP_K}, default: ${SEARCH_CONFIG.DEFAULT_TOP_K})`,
      },
    },
    required: ['query', 'category', 'topK'],
    additionalProperties: false,
  };

  // Strict mode (GPT-5.2 best practice)
  strict = true;

  constructor(private readonly searchService: SearchService) {}

  async execute(params: any, context: ToolContext): Promise<any> {
    const { query, category, topK } = params;

    if (!query) {
      return {
        success: false,
        error: 'Query é obrigatório',
        results: [],
      };
    }

    try {
      // Executar busca híbrida (semântica + full-text)
      const results = await this.searchService.search(query, {
        category: category || undefined,
        topK: topK || SEARCH_CONFIG.DEFAULT_TOP_K,
        useHybrid: true,
      });

      // Formatar resultados para o LLM
      const formattedResults = results.map((r, i) => ({
        index: i + 1,
        title: r.document.title,
        section: r.sectionTitle,
        route: r.document.routePattern,
        menuPath: r.document.menuPath,
        category: r.document.category,
        similarity: `${(r.similarity * 100).toFixed(1)}%`,
        content: r.content,
      }));

      return {
        success: true,
        query,
        totalResults: results.length,
        results: formattedResults,
        // Contexto formatado para facilitar uso pelo LLM
        context: this.searchService.formatResultsForContext(results),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        query,
        results: [],
      };
    }
  }
}

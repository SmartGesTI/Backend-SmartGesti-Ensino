import { Injectable } from '@nestjs/common';
import { Tool, ToolContext } from '../../shared/tools/tool.interface';
import { KnowledgeService } from '../knowledge/knowledge.service';

@Injectable()
export class KnowledgeSearchTool implements Tool {
  name = 'search_knowledge';
  description = 'Busca informações no conhecimento do sistema (documentação, funcionalidades, guias). Use quando precisar encontrar informações sobre páginas, APIs ou funcionalidades.';
  parameters = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Termo ou pergunta para buscar',
      },
      category: {
        type: 'string',
        enum: ['page', 'api', 'feature', 'database', 'all'],
        description: 'Categoria para filtrar a busca (opcional)',
      },
    },
    required: ['query'],
  };

  constructor(private readonly knowledgeService: KnowledgeService) {}

  async execute(params: any, context: ToolContext): Promise<any> {
    const { query, category } = params;

    if (!query) {
      throw new Error('query é obrigatório');
    }

    const results = await this.knowledgeService.searchKnowledge(query, category || 'all');

    return {
      query,
      category: category || 'all',
      results: results.map((r) => ({
        title: r.title,
        content: r.content,
        type: r.type,
        relevance: r.relevance,
        metadata: r.metadata,
      })),
      totalResults: results.length,
    };
  }
}

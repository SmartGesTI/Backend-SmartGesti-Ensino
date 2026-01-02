import { Injectable } from '@nestjs/common';
import { Tool, ToolContext } from '../../shared/tools/tool.interface';
import { KnowledgeService } from '../knowledge/knowledge.service';

@Injectable()
export class PageInfoTool implements Tool {
  name = 'get_page_info';
  description = 'Obtém informações detalhadas sobre uma página do sistema (nome, descrição, funcionalidades, rotas)';
  parameters = {
    type: 'object',
    properties: {
      pageName: {
        type: 'string',
        description: 'Nome da página (ex: "Relatório Inteligente", "Criar Agente IA", "Dashboard")',
      },
    },
    required: ['pageName'],
  };

  constructor(private readonly knowledgeService: KnowledgeService) {}

  async execute(params: any, context: ToolContext): Promise<any> {
    const { pageName } = params;

    if (!pageName) {
      throw new Error('pageName é obrigatório');
    }

    const pageInfo = await this.knowledgeService.getPageInfo(pageName);

    if (!pageInfo) {
      return {
        found: false,
        message: `Página "${pageName}" não encontrada. Páginas disponíveis: ${this.knowledgeService.listPages().map(p => p.name).join(', ')}`,
      };
    }

    return {
      found: true,
      name: pageInfo.name,
      description: pageInfo.description,
      route: pageInfo.routePattern,
      features: pageInfo.features,
      relatedPages: pageInfo.relatedPages,
      category: pageInfo.category,
    };
  }
}

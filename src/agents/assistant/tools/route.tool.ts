import { Injectable } from '@nestjs/common';
import { Tool, ToolContext } from '../../shared/tools/tool.interface';
import { KnowledgeService } from '../knowledge/knowledge.service';

@Injectable()
export class RouteTool implements Tool {
  name = 'get_route';
  description = 'Obtém a rota/URL de uma página específica do sistema. Retorna a URL completa considerando o slug da escola.';
  parameters = {
    type: 'object',
    properties: {
      pageName: {
        type: 'string',
        description: 'Nome da página',
      },
      schoolSlug: {
        type: 'string',
        description: 'Slug da escola (opcional, pode ser inferido do contexto)',
      },
    },
    required: ['pageName'],
  };

  constructor(private readonly knowledgeService: KnowledgeService) {}

  async execute(params: any, context: ToolContext): Promise<any> {
    const { pageName, schoolSlug } = params;

    if (!pageName) {
      throw new Error('pageName é obrigatório');
    }

    // Se não forneceu schoolSlug, tentar obter do contexto (se disponível)
    const finalSchoolSlug = schoolSlug || (context as any).schoolSlug;

    const route = await this.knowledgeService.getRoute(pageName, finalSchoolSlug);

    if (!route) {
      return {
        found: false,
        message: `Rota não encontrada para a página "${pageName}"`,
      };
    }

    return {
      found: true,
      route,
      pageName,
      schoolSlug: finalSchoolSlug || 'não especificado',
      fullUrl: finalSchoolSlug ? route : route.replace(':slug', '[slug-da-escola]'),
    };
  }
}

import { Injectable } from '@nestjs/common';
import { Tool, ToolContext } from '../../shared/tools/tool.interface';
import { KnowledgeService } from '../knowledge/knowledge.service';

@Injectable()
export class ApiInfoTool implements Tool {
  name = 'get_api_info';
  description = 'Obtém informações sobre endpoints da API (parâmetros, respostas, exemplos). Use quando precisar explicar como usar uma API específica.';
  parameters = {
    type: 'object',
    properties: {
      endpoint: {
        type: 'string',
        description: 'Endpoint da API (ex: "/api/agents", "/api/agents/:id/execute")',
      },
    },
    required: ['endpoint'],
  };

  constructor(private readonly knowledgeService: KnowledgeService) {}

  async execute(params: any, context: ToolContext): Promise<any> {
    const { endpoint } = params;

    if (!endpoint) {
      throw new Error('endpoint é obrigatório');
    }

    const apiInfo = await this.knowledgeService.getApiInfo(endpoint);

    if (!apiInfo) {
      return {
        found: false,
        message: `API "${endpoint}" não encontrada`,
      };
    }

    return {
      found: true,
      endpoint: apiInfo.endpoint,
      method: apiInfo.method,
      description: apiInfo.description,
      parameters: apiInfo.parameters,
      response: apiInfo.response,
      examples: apiInfo.examples,
    };
  }
}

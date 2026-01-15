/**
 * Tipos e definições de Tools para o RAG
 * Usado com OpenAI Function Calling
 */

/**
 * Definição de uma tool no formato OpenAI
 */
export interface RagToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<
        string,
        {
          type: string;
          description: string;
          enum?: string[];
        }
      >;
      required?: string[];
    };
  };
}

/**
 * Resultado da execução de uma tool
 */
export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Agente público simplificado para resposta
 */
export interface PublicAgentInfo {
  name: string;
  description: string;
  category: string;
  useCase: string;
  difficulty: string;
  estimatedTime: string;
  tags: string[];
  rating: number;
  usageCount: number;
}

/**
 * Definições das tools disponíveis para o RAG
 */
export const RAG_TOOLS: RagToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'list_public_agents',
      description:
        'Lista os agentes de IA públicos disponíveis no sistema. Use quando o usuário perguntar sobre agentes disponíveis, templates de agentes, ou quiser saber quais agentes existem.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            description: 'Filtrar por categoria do agente',
            enum: ['academico', 'financeiro', 'rh', 'administrativo'],
          },
          limit: {
            type: 'number',
            description: 'Número máximo de agentes a retornar (padrão: 10)',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_agent_details',
      description:
        'Obtém detalhes completos de um agente específico pelo nome. Use quando o usuário perguntar detalhes sobre um agente específico.',
      parameters: {
        type: 'object',
        properties: {
          agentName: {
            type: 'string',
            description: 'Nome do agente para buscar detalhes',
          },
        },
        required: ['agentName'],
      },
    },
  },
];

/**
 * Nomes das tools para verificação rápida
 */
export type RagToolName = 'list_public_agents' | 'get_agent_details';

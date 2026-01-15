import { Injectable, Logger } from '@nestjs/common';
import { tool } from 'ai';
import { z } from 'zod';
import { SupabaseService } from '../../supabase/supabase.service';
import { Tool } from '@ai-sdk/provider-utils';

export interface AgentsToolContext {
  tenantId?: string;
  userId?: string;
  schoolId?: string;
}

/**
 * Agents Tool for listing and getting details of public agents
 * Does NOT require approval since it's read-only public data
 */
@Injectable()
export class AgentsTool {
  private readonly logger = new Logger(AgentsTool.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Create the list agents tool
   */
  createListTool(context: AgentsToolContext): Tool {
    return tool({
      description:
        'Lista os agentes de IA públicos e colaborativos disponíveis no sistema. Use quando o usuário perguntar sobre quais agentes existem, o que pode fazer com agentes, ou quiser uma lista de agentes disponíveis.',
      inputSchema: z.object({
        category: z
          .enum(['academico', 'financeiro', 'rh', 'administrativo', 'todos'])
          .optional()
          .describe(
            'Categoria para filtrar os agentes (opcional). Use "todos" para não filtrar.',
          ),
        limit: z
          .number()
          .min(1)
          .max(20)
          .optional()
          .describe('Número máximo de agentes a retornar (padrão: 10)'),
      }),
      execute: async ({ category, limit = 10 }) => {
        try {
          if (!context.tenantId) {
            return {
              success: false,
              message:
                'Não foi possível identificar o tenant para listar os agentes.',
              agents: [],
            };
          }

          const client = this.supabase.getClient();

          let query = client
            .from('agents')
            .select(
              `
              id,
              name,
              description,
              category,
              use_case,
              difficulty,
              estimated_time,
              tags,
              rating,
              usage_count,
              visibility,
              flow,
              workflow
            `,
            )
            .eq('tenant_id', context.tenantId)
            .eq('is_active', true)
            .neq('visibility', 'private')
            .order('usage_count', { ascending: false })
            .limit(limit);

          // Filter by school if provided
          if (context.schoolId) {
            query = query.or(
              `school_id.eq.${context.schoolId},school_id.is.null`,
            );
          }

          // Filter by category if specified and not "todos"
          if (category && category !== 'todos') {
            query = query.eq('category', category);
          }

          const { data, error } = await query;

          if (error) {
            this.logger.error(`Error listing agents: ${error.message}`);
            return {
              success: false,
              message: `Erro ao buscar agentes: ${error.message}`,
              agents: [],
            };
          }

          const agents = (data || []).map((agent: any) => {
            // Extract flow description from workflow nodes
            let flowDescription = agent.flow || '';
            if (agent.workflow?.nodes && Array.isArray(agent.workflow.nodes)) {
              const nodeLabels = agent.workflow.nodes
                .map((n: any) => n.data?.label || n.type)
                .filter(Boolean);
              if (nodeLabels.length > 0) {
                flowDescription = nodeLabels.join(' → ');
              }
            }

            return {
              id: agent.id,
              name: agent.name,
              description: agent.description,
              category: agent.category,
              useCase: agent.use_case,
              difficulty: agent.difficulty,
              estimatedTime: agent.estimated_time,
              tags: agent.tags || [],
              rating: agent.rating,
              usageCount: agent.usage_count,
              visibility: agent.visibility,
              flowDescription,
            };
          });

          this.logger.log(
            `Found ${agents.length} public agents for tenant ${context.tenantId}`,
          );

          return {
            success: true,
            agents,
            total: agents.length,
          };
        } catch (error: any) {
          this.logger.error(`Agents tool error: ${error.message}`, error.stack);
          return {
            success: false,
            message: `Erro ao listar agentes: ${error.message}`,
            agents: [],
          };
        }
      },
      toModelOutput: async ({ output }) => {
        if (!output.success || output.agents.length === 0) {
          return {
            type: 'text',
            value:
              output.message || 'Nenhum agente público encontrado no sistema.',
          };
        }

        const agentsList = output.agents
          .map((agent: any, i: number) => {
            const parts = [`**${i + 1}. ${agent.name}**`];
            if (agent.description) {
              parts.push(`   Descrição: ${agent.description}`);
            }
            parts.push(`   Categoria: ${agent.category || 'N/A'}`);
            if (agent.useCase) {
              parts.push(`   Caso de uso: ${agent.useCase}`);
            }
            if (agent.difficulty) {
              parts.push(`   Dificuldade: ${agent.difficulty}`);
            }
            if (agent.estimatedTime) {
              parts.push(`   Tempo estimado: ${agent.estimatedTime}`);
            }
            if (agent.tags && agent.tags.length > 0) {
              parts.push(`   Tags: ${agent.tags.join(', ')}`);
            }
            parts.push(
              `   Visibilidade: ${agent.visibility === 'public' ? 'Público' : 'Colaborativo'}`,
            );
            if (agent.flowDescription) {
              parts.push(`   Fluxo: ${agent.flowDescription}`);
            }
            return parts.join('\n');
          })
          .join('\n\n');

        return {
          type: 'text',
          value: `Encontrei ${output.total} agente(s) disponível(is):\n\n${agentsList}`,
        };
      },
    });
  }

  /**
   * Create the get agent details tool
   */
  createDetailsTool(context: AgentsToolContext): Tool {
    return tool({
      description:
        'Obtém detalhes completos sobre um agente específico pelo nome. Use quando o usuário pedir mais informações sobre um agente em particular.',
      inputSchema: z.object({
        agentName: z
          .string()
          .describe('Nome (ou parte do nome) do agente para buscar detalhes'),
      }),
      execute: async ({ agentName }) => {
        try {
          if (!context.tenantId) {
            return {
              success: false,
              message: 'Não foi possível identificar o tenant.',
              agent: null,
            };
          }

          const client = this.supabase.getClient();

          let query = client
            .from('agents')
            .select(
              `
              id,
              name,
              description,
              category,
              use_case,
              difficulty,
              estimated_time,
              tags,
              rating,
              usage_count,
              how_it_helps,
              best_uses,
              flow,
              workflow,
              visibility
            `,
            )
            .eq('tenant_id', context.tenantId)
            .eq('is_active', true)
            .neq('visibility', 'private')
            .ilike('name', `%${agentName}%`);

          if (context.schoolId) {
            query = query.or(
              `school_id.eq.${context.schoolId},school_id.is.null`,
            );
          }

          const { data, error } = await query.limit(1).maybeSingle();

          if (error) {
            this.logger.error(`Error getting agent details: ${error.message}`);
            return {
              success: false,
              message: `Erro ao buscar agente: ${error.message}`,
              agent: null,
            };
          }

          if (!data) {
            return {
              success: false,
              message: `Agente "${agentName}" não encontrado entre os agentes disponíveis.`,
              agent: null,
            };
          }

          // Extract flow steps from workflow
          let flowSteps: string[] = [];
          if (data.workflow?.nodes && Array.isArray(data.workflow.nodes)) {
            flowSteps = data.workflow.nodes.map((n: any, idx: number) => {
              const label = n.data?.label || n.type || 'Nó';
              const desc = n.data?.description || '';
              return `${idx + 1}. ${label}${desc ? `: ${desc}` : ''}`;
            });
          }

          return {
            success: true,
            agent: {
              id: data.id,
              name: data.name,
              description: data.description,
              category: data.category,
              useCase: data.use_case,
              difficulty: data.difficulty,
              estimatedTime: data.estimated_time,
              tags: data.tags || [],
              rating: data.rating,
              usageCount: data.usage_count,
              howItHelps: data.how_it_helps,
              bestUses: data.best_uses,
              visibility: data.visibility,
              flowSteps,
            },
          };
        } catch (error: any) {
          this.logger.error(
            `Agent details tool error: ${error.message}`,
            error.stack,
          );
          return {
            success: false,
            message: `Erro ao buscar detalhes: ${error.message}`,
            agent: null,
          };
        }
      },
      toModelOutput: async ({ input, output }) => {
        if (!output.success || !output.agent) {
          return {
            type: 'text',
            value:
              output.message || `Agente "${input.agentName}" não encontrado.`,
          };
        }

        const agent = output.agent;
        const parts = [
          `## ${agent.name}`,
          '',
          agent.description || 'Sem descrição.',
          '',
          `**Categoria:** ${agent.category || 'N/A'}`,
          `**Caso de uso:** ${agent.useCase || 'N/A'}`,
          `**Dificuldade:** ${agent.difficulty || 'N/A'}`,
          `**Tempo estimado:** ${agent.estimatedTime || 'N/A'}`,
          `**Visibilidade:** ${agent.visibility === 'public' ? 'Público' : 'Colaborativo'}`,
        ];

        if (agent.tags && agent.tags.length > 0) {
          parts.push(`**Tags:** ${agent.tags.join(', ')}`);
        }

        if (agent.rating) {
          parts.push(`**Avaliação:** ${agent.rating}/5`);
        }

        if (agent.usageCount) {
          parts.push(`**Uso:** ${agent.usageCount} execuções`);
        }

        if (agent.howItHelps) {
          parts.push('', '**Como ajuda:**', agent.howItHelps);
        }

        if (agent.bestUses) {
          parts.push('', '**Melhores usos:**', agent.bestUses);
        }

        if (agent.flowSteps && agent.flowSteps.length > 0) {
          parts.push('', '**Fluxo de execução:**');
          parts.push(...agent.flowSteps);
        }

        return {
          type: 'text',
          value: parts.join('\n'),
        };
      },
    });
  }
}

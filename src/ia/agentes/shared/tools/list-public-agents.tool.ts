import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ToolFactory } from '../../../core/tool/tool.factory';
import { CoreTool } from '../../../core/tool/tool.types';
import { CoreContext } from '../../../core/context/context.types';
import { SupabaseService } from '../../../../supabase/supabase.service';

/**
 * Factory para criar tool de listagem de agentes públicos
 */
@Injectable()
export class ListPublicAgentsToolFactory {
  constructor(
    private readonly toolFactory: ToolFactory,
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * Cria a tool de listagem de agentes públicos
   */
  create(): CoreTool<CoreContext> {
    return this.toolFactory.create({
      name: 'list_public_agents',
      description: `Lista agentes públicos e colaborativos criados pelos usuários e salvos no banco de dados da Escola.
      
IMPORTANTE: Esta tool lista agentes CRIADOS PELOS USUÁRIOS no banco de dados, não agentes internos do sistema.

Use esta tool quando o usuário perguntar sobre:
- "agentes disponíveis", "agentes públicos", "quais agentes"
- "listar agentes", "templates de agentes"
- "o que posso usar", "agentes existentes"
- "agentes criados", "meus agentes"

Retorna lista de agentes do banco que não são privados, incluindo informações como categoria, descrição e casos de uso.`,
      parameters: z.object({
        category: z
          .string()
          .nullable()
          .default(null)
          .describe('Filtrar por categoria específica (ex: academico, financeiro)'),
        limit: z
          .number()
          .nullable()
          .default(10)
          .describe('Número máximo de agentes a retornar (padrão: 10)'),
      }),
      execute: async ({ category, limit }, { context }) => {
        if (!context.tenantId) {
          return {
            success: false,
            error: 'Tenant ID não fornecido. Não é possível listar agentes.',
          };
        }

        if (!context.schoolId) {
          return {
            success: false,
            error:
              'Escola não identificada. Os agentes são criados dentro de escolas específicas.',
          };
        }

        const client = this.supabase.getClient();

        // Buscar agentes da escola que não são privados
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
            visibility,
            flow,
            workflow
          `,
          )
          .eq('tenant_id', context.tenantId)
          .eq('is_active', true)
          .neq('visibility', 'private')
          .order('usage_count', { ascending: false })
          .limit(limit ?? 10);

        // Filtrar por escola: agentes da escola OU sem escola (global do tenant)
        query = query.or(
          `school_id.eq.${context.schoolId},school_id.is.null`,
        );

        if (category) {
          query = query.eq('category', category);
        }

        const { data, error } = await query;

        if (error) {
          return {
            success: false,
            error: error.message,
          };
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const agents = (data || []).map((agent: any) => {
          // Extrair descrição do fluxo a partir do workflow/nodes
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          let flowDescription = agent.flow || '';
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (agent.workflow?.nodes && Array.isArray(agent.workflow.nodes)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
            const nodeLabels = agent.workflow.nodes
              // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
              .map((n: any) => n.data?.label || n.type)
              .filter(Boolean);
            if (nodeLabels.length > 0) {
              flowDescription = `Fluxo: ${nodeLabels.join(' → ')}`;
            }
          }

          return {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            id: agent.id,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            name: agent.name,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            description: agent.description,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            category: agent.category,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            useCase: agent.use_case,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            difficulty: agent.difficulty,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            estimatedTime: agent.estimated_time,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            tags: agent.tags || [],
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            rating: agent.rating,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            usageCount: agent.usage_count,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            howItHelps: agent.how_it_helps,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            bestUses: agent.best_uses,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            visibility: agent.visibility,
            flowDescription,
          };
        });

        return {
          success: true,
          agents,
          total: agents.length,
          message:
            agents.length > 0
              ? `Encontrados ${agents.length} agentes disponíveis (públicos e colaborativos) na escola`
              : 'Nenhum agente disponível encontrado nesta escola',
        };
      },
      category: 'data-access',
      tags: ['agents', 'list', 'shared'],
    });
  }
}

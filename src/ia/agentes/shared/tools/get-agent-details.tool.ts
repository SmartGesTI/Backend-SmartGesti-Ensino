import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { ToolFactory } from '../../../core/tool/tool.factory';
import { CoreTool } from '../../../core/tool/tool.types';
import { CoreContext } from '../../../core/context/context.types';
import { SupabaseService } from '../../../../supabase/supabase.service';

/**
 * Factory para criar tool de obtenção de detalhes de agente
 */
@Injectable()
export class GetAgentDetailsToolFactory {
  constructor(
    private readonly toolFactory: ToolFactory,
    private readonly supabase: SupabaseService,
  ) {}

  /**
   * Cria a tool de obtenção de detalhes de agente
   */
  create(): CoreTool<CoreContext> {
    return this.toolFactory.create({
      name: 'get_agent_details',
      description: `Obtém detalhes completos de um agente específico pelo nome.
      
Use esta tool quando o usuário perguntar sobre:
- Um agente específico pelo nome
- "como funciona o agente X", "detalhes do agente Y"
- Informações detalhadas sobre um agente

Retorna informações completas incluindo descrição, categoria, casos de uso, fluxo de trabalho e mais.`,
      parameters: z.object({
        agentName: z
          .string()
          .describe('Nome do agente (pode ser parcial, será buscado com LIKE)'),
      }),
      execute: async ({ agentName }, { context }) => {
        if (!context.tenantId) {
          return {
            success: false,
            error: 'Tenant ID não fornecido.',
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

        // Construir query base
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
            category_tags,
            visibility
          `,
          )
          .eq('tenant_id', context.tenantId)
          .eq('is_active', true)
          .neq('visibility', 'private')
          .ilike('name', `%${agentName}%`);

        // Filtrar por escola: agentes da escola OU sem escola (global do tenant)
        query = query.or(`school_id.eq.${context.schoolId},school_id.is.null`);

        const { data, error } = await query.limit(1).single();

        if (error || !data) {
          return {
            success: false,
            error: `Agente "${agentName}" não encontrado entre os agentes disponíveis desta escola`,
          };
        }

        // Extrair descrição detalhada do fluxo
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        let flowDescription = data.flow || '';
        let flowSteps: string[] = [];

        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        if (data.workflow?.nodes && Array.isArray(data.workflow.nodes)) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          flowSteps = data.workflow.nodes.map((n: any, idx: number) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const label = n.data?.label || n.type || 'Nó';
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const desc = n.data?.description || '';
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            const category = n.data?.category || '';
            return `${idx + 1}. **${label}** ${category ? `(${category})` : ''}: ${desc}`;
          });
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          flowDescription = `Fluxo com ${data.workflow.nodes.length} etapas`;
        }

        return {
          success: true,
          agent: {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            id: data.id,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            name: data.name,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            description: data.description,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            category: data.category,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            useCase: data.use_case,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            difficulty: data.difficulty,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            estimatedTime: data.estimated_time,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            tags: data.tags || [],
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            rating: data.rating,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            usageCount: data.usage_count,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            howItHelps: data.how_it_helps,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            bestUses: data.best_uses,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            visibility: data.visibility,
            flowDescription,
            flowSteps,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            categoryTags: data.category_tags,
            // Dados para renderização do modal
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            canRenderFlow: !!(data.workflow?.nodes && data.workflow?.edges),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            nodes: data.workflow?.nodes || [],
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            edges: data.workflow?.edges || [],
          },
        };
      },
      category: 'data-access',
      tags: ['agents', 'details', 'shared'],
    });
  }
}

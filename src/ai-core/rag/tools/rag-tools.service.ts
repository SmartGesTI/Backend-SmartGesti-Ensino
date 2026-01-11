import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import {
  RagToolName,
  ToolExecutionResult,
  PublicAgentInfo,
  RAG_TOOLS,
} from './rag-tools.types';

@Injectable()
export class RagToolsService {
  private readonly logger = new Logger(RagToolsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Retorna as definições de tools para o OpenAI
   */
  getToolDefinitions() {
    return RAG_TOOLS;
  }

  /**
   * Executa uma tool pelo nome
   */
  async executeTool(
    toolName: RagToolName,
    args: Record<string, any>,
    tenantId?: string,
    schoolId?: string,
  ): Promise<ToolExecutionResult> {
    this.logger.log(`Executing tool: ${toolName} with args: ${JSON.stringify(args)}, tenant: ${tenantId}, school: ${schoolId}`);

    switch (toolName) {
      case 'list_public_agents':
        return this.listPublicAgents(args.category, args.limit, tenantId, schoolId);
      case 'get_agent_details':
        return this.getAgentDetails(args.agentName, tenantId, schoolId);
      default:
        return {
          success: false,
          error: `Tool desconhecida: ${toolName}`,
        };
    }
  }

  /**
   * Lista agentes disponíveis (não privados) para a escola/tenant
   */
  private async listPublicAgents(
    category?: string,
    limit = 10,
    tenantId?: string,
    schoolId?: string,
  ): Promise<ToolExecutionResult> {
    try {
      this.logger.log(`listPublicAgents called with tenantId: ${tenantId}, schoolId: ${schoolId}, category: ${category}`);
      
      if (!tenantId) {
        return {
          success: false,
          error: 'Tenant ID não fornecido. Não é possível listar agentes.',
        };
      }

      if (!schoolId) {
        return {
          success: false,
          error: 'Escola não identificada. Os agentes são criados dentro de escolas específicas.',
        };
      }

      const client = this.supabase.getClient();

      // Buscar agentes da escola que não são privados
      // visibility: 'public' ou 'collaborative' (não mostrar 'private')
      let query = client
        .from('agents')
        .select(`
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
        `)
        .eq('tenant_id', tenantId) // SEMPRE filtrar por tenant
        .eq('is_active', true)
        .neq('visibility', 'private') // Não mostrar privados
        .order('usage_count', { ascending: false })
        .limit(limit);

      // Filtrar por escola: agentes da escola OU sem escola (global do tenant)
      // schoolId é obrigatório - agentes pertencem a escolas
      query = query.or(`school_id.eq.${schoolId},school_id.is.null`);

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      
      this.logger.log(`Query returned ${data?.length || 0} agents`);

      if (error) {
        this.logger.error('Error listing public agents: ' + error.message);
        return { success: false, error: error.message };
      }

      const agents = (data || []).map((agent: any) => {
        // Extrair descrição do fluxo a partir do workflow/nodes
        let flowDescription = agent.flow || '';
        if (agent.workflow?.nodes && Array.isArray(agent.workflow.nodes)) {
          const nodeLabels = agent.workflow.nodes
            .map((n: any) => n.data?.label || n.type)
            .filter(Boolean);
          if (nodeLabels.length > 0) {
            flowDescription = `Fluxo: ${nodeLabels.join(' → ')}`;
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
          howItHelps: agent.how_it_helps,
          bestUses: agent.best_uses,
          visibility: agent.visibility,
          flowDescription,
        };
      });

      this.logger.log(`Found ${agents.length} public agents`);

      return {
        success: true,
        data: {
          agents,
          total: agents.length,
          message: agents.length > 0
            ? `Encontrados ${agents.length} agentes disponíveis (públicos e colaborativos) na escola`
            : 'Nenhum agente disponível encontrado nesta escola',
        },
      };
    } catch (error) {
      this.logger.error('Error in listPublicAgents: ' + error);
      return { success: false, error: 'Erro ao buscar agentes públicos' };
    }
  }

  /**
   * Obtém detalhes completos de um agente específico
   */
  private async getAgentDetails(
    agentName: string,
    tenantId?: string,
    schoolId?: string,
  ): Promise<ToolExecutionResult> {
    try {
      this.logger.log(`getAgentDetails called for: ${agentName}, tenantId: ${tenantId}, schoolId: ${schoolId}`);
      
      if (!tenantId) {
        return {
          success: false,
          error: 'Tenant ID não fornecido.',
        };
      }

      if (!schoolId) {
        return {
          success: false,
          error: 'Escola não identificada. Os agentes são criados dentro de escolas específicas.',
        };
      }

      const client = this.supabase.getClient();

      // Construir query base
      let query = client
        .from('agents')
        .select(`
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
        `)
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .neq('visibility', 'private')
        .ilike('name', `%${agentName}%`);

      // Filtrar por escola: agentes da escola OU sem escola (global do tenant)
      // schoolId é obrigatório - agentes pertencem a escolas
      query = query.or(`school_id.eq.${schoolId},school_id.is.null`);

      const { data, error } = await query.limit(1).single();

      if (error || !data) {
        return {
          success: false,
          error: `Agente "${agentName}" não encontrado entre os agentes disponíveis desta escola`,
        };
      }

      // Extrair descrição detalhada do fluxo
      let flowDescription = data.flow || '';
      let flowSteps: string[] = [];
      
      if (data.workflow?.nodes && Array.isArray(data.workflow.nodes)) {
        flowSteps = data.workflow.nodes.map((n: any, idx: number) => {
          const label = n.data?.label || n.type || 'Nó';
          const desc = n.data?.description || '';
          const category = n.data?.category || '';
          return `${idx + 1}. **${label}** ${category ? `(${category})` : ''}: ${desc}`;
        });
        flowDescription = `Fluxo com ${data.workflow.nodes.length} etapas`;
      }

      return {
        success: true,
        data: {
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
          flowDescription,
          flowSteps,
          categoryTags: data.category_tags,
          // Dados para renderização do modal
          canRenderFlow: !!(data.workflow?.nodes && data.workflow?.edges),
          nodes: data.workflow?.nodes || [],
          edges: data.workflow?.edges || [],
        },
      };
    } catch (error) {
      this.logger.error('Error in getAgentDetails: ' + error);
      return { success: false, error: 'Erro ao buscar detalhes do agente' };
    }
  }
}

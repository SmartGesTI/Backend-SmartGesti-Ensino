import { Agent, tool } from '@openai/agents';
import { CoreAgent, CoreAgentConfig } from '../agent.types';
import { CoreTool } from '../../tool/tool.types';
import { CoreContext } from '../../context/context.types';

/**
 * Estratégia Manager: Agentes como tools (padrão Manager)
 * Um agente central orquestra outros agentes especialistas expostos como tools
 */
export class ManagerStrategy {
  /**
   * Aplica a estratégia manager a um agente
   */
  static apply<TContext extends CoreContext = CoreContext>(
    config: CoreAgentConfig<TContext>,
  ): Agent<TContext> {
    // Converter agentes handoffs em tools
    const tools: any[] = [];

    // Adicionar tools normais
    if (config.tools) {
      for (const coreTool of config.tools) {
        tools.push(
          tool({
            name: coreTool.name,
            description: coreTool.description,
            parameters: coreTool.parameters as any,
            execute: async (params, runContext) => {
              return await coreTool.execute(params, runContext as any);
            },
          }),
        );
      }
    }

    // Converter agentes handoffs em tools (agents as tools)
    if (config.handoffs) {
      for (const handoffAgent of config.handoffs) {
        const agentInstance = handoffAgent as any;
        if (agentInstance.asTool) {
          tools.push(
            agentInstance.asTool({
              toolName: `${agentInstance.name.toLowerCase().replace(/\s+/g, '_')}_agent`,
              toolDescription: `Delegate to ${agentInstance.name} for specialized tasks`,
            }),
          );
        } else {
          // Fallback: criar tool wrapper manualmente
          tools.push(
            tool({
              name: `${agentInstance.name.toLowerCase().replace(/\s+/g, '_')}_agent`,
              description: `Delegate to ${agentInstance.name} for specialized tasks`,
              parameters: {} as any,
              execute: async (params, runContext) => {
                // Esta execução será feita pelo runner
                return { delegated: true, agent: agentInstance.name };
              },
            }),
          );
        }
      }
    }

    // Criar agente com tools
    return new Agent<TContext>({
      name: config.name,
      instructions: config.instructions,
      model: config.model,
      tools: tools.length > 0 ? tools : undefined,
      modelSettings: {
        ...config.modelSettings,
        parallelToolCalls: config.modelSettings?.parallelToolCalls ?? true,
      },
      inputGuardrails: config.guardrails?.input,
      outputGuardrails: config.guardrails?.output as any,
    });
  }
}

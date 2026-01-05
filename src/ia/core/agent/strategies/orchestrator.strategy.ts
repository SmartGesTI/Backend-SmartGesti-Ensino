import { Agent, tool } from '@openai/agents';
import { CoreAgent, CoreAgentConfig } from '../agent.types';
import { CoreTool } from '../../tool/tool.types';
import { CoreContext } from '../../context/context.types';

/**
 * Estratégia Orchestrator: Orquestração complexa multi-agente
 * Combina manager e handoff para casos complexos
 */
export class OrchestratorStrategy {
  /**
   * Aplica a estratégia orchestrator a um agente
   */
  static apply<TContext extends CoreContext = CoreContext>(
    config: CoreAgentConfig<TContext>,
  ): Agent<TContext> {
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

    // Converter agentes em tools (manager pattern)
    if (config.handoffs) {
      for (const handoffAgent of config.handoffs) {
        const agentInstance = handoffAgent as any;
        if (agentInstance.asTool) {
          tools.push(
            agentInstance.asTool({
              toolName: `${agentInstance.name.toLowerCase().replace(/\s+/g, '_')}_agent`,
              toolDescription: `Orchestrate with ${agentInstance.name} for specialized tasks`,
            }),
          );
        }
      }
    }

    // Criar agente orchestrator
    return new Agent<TContext>({
      name: config.name,
      instructions: this.buildOrchestratorInstructions(config),
      model: config.model,
      tools: tools.length > 0 ? tools : undefined,
      modelSettings: {
        ...config.modelSettings,
        parallelToolCalls: config.modelSettings?.parallelToolCalls ?? true,
        temperature: config.modelSettings?.temperature ?? 0.7,
      },
      inputGuardrails: config.guardrails?.input,
      outputGuardrails: config.guardrails?.output as any,
    });
  }

  /**
   * Constrói instruções para orchestrator
   */
  private static buildOrchestratorInstructions<TContext extends CoreContext>(
    config: CoreAgentConfig<TContext>,
  ): string {
    const baseInstructions =
      typeof config.instructions === 'string'
        ? config.instructions
        : 'You are an orchestrator agent.';

    const orchestratorInstructions = `
${baseInstructions}

## Orchestration Guidelines

You are an orchestrator that coordinates multiple specialized agents and tools.

1. Analyze the user's request to determine which agents or tools are needed
2. Use parallel tool calls when multiple independent operations are required
3. Combine results from multiple agents/tools into a coherent response
4. If a task requires a complete handoff, delegate to the appropriate specialist agent
5. Always provide a comprehensive final answer that synthesizes all information gathered

Available agents and tools:
${config.handoffs?.map((a) => `- ${a.name}`).join('\n') || 'None'}
${config.tools?.map((t) => `- ${t.name}: ${t.description}`).join('\n') || 'None'}
`;

    return orchestratorInstructions;
  }
}

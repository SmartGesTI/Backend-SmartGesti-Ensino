import { Agent, tool } from '@openai/agents';
import { CoreAgent, CoreAgentConfig } from '../agent.types';
import { CoreTool } from '../../tool/tool.types';
import { CoreContext } from '../../context/context.types';

/**
 * Estratégia Simple: Agente simples sem multi-agente
 */
export class SimpleStrategy {
  /**
   * Aplica a estratégia simple a um agente
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

    // Criar agente simples
    return new Agent<TContext>({
      name: config.name,
      instructions: config.instructions,
      model: config.model,
      tools: tools.length > 0 ? tools : undefined,
      modelSettings: config.modelSettings,
      inputGuardrails: config.guardrails?.input,
      outputGuardrails: config.guardrails?.output as any,
    });
  }
}

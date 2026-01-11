import { Agent, handoff } from '@openai/agents';
import { CoreAgent, CoreAgentConfig } from '../agent.types';
import { CoreTool } from '../../tool/tool.types';
import { CoreContext } from '../../context/context.types';
import { tool } from '@openai/agents';
import { filterModelSettings } from './model-settings.helper';

/**
 * Estratégia Handoff: Delegação completa de conversa
 * O agente inicial delega a conversa inteira para um especialista
 */
export class HandoffStrategy {
  /**
   * Aplica a estratégia handoff a um agente
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

    // Adicionar handoffs
    if (config.handoffs && config.handoffs.length > 0) {
      for (const handoffAgent of config.handoffs) {
        tools.push(handoff(handoffAgent as any));
      }
    }

    // Criar agente com handoffs
    // Filtrar modelSettings para remover temperature se o modelo for GPT-5
    const filteredModelSettings = filterModelSettings(
      config.model,
      config.modelSettings,
    );

    return new Agent<TContext>({
      name: config.name,
      instructions: config.instructions,
      model: config.model,
      tools: tools.length > 0 ? tools : undefined,
      modelSettings: filteredModelSettings,
      inputGuardrails: config.guardrails?.input,
      outputGuardrails: config.guardrails?.output as any,
    });
  }
}

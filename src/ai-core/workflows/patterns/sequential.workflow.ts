import {
  WorkflowConfig,
  WorkflowContext,
  WorkflowResult,
} from '../workflow.types';
import { AgentRegistry } from '../../agents/agent.registry';

export class SequentialWorkflow {
  async execute(
    config: WorkflowConfig,
    context: WorkflowContext,
  ): Promise<WorkflowResult> {
    const results: Record<string, any> = {};
    const errors: Record<string, Error> = {};

    for (const step of config.steps) {
      try {
        // Verificar condição se houver
        if (step.condition && !step.condition(context)) {
          continue;
        }

        // Executar step
        let stepResult: any;

        if (step.agent) {
          // Executar agente
          // Por enquanto, apenas placeholder - será implementado com AgentRegistry
          stepResult = { agent: step.agent, input: step.input };
        } else if (step.tool) {
          // Executar tool
          stepResult = { tool: step.tool, input: step.input };
        } else {
          throw new Error(`Step ${step.id} has no agent or tool`);
        }

        results[step.id] = stepResult;

        // Callback onSuccess
        if (step.onSuccess) {
          step.onSuccess(stepResult, context);
        }

        // Adicionar resultado ao contexto
        context.results[step.id] = stepResult;
      } catch (error) {
        errors[step.id] = error as Error;

        // Callback onError
        if (step.onError) {
          step.onError(error as Error, context);
        }

        // Se não há tratamento de erro, parar execução
        if (!step.onError) {
          break;
        }
      }
    }

    return {
      success: Object.keys(errors).length === 0,
      results,
      errors,
      executionTime: 0, // Será preenchido pelo executor
    };
  }
}

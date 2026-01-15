import {
  WorkflowConfig,
  WorkflowContext,
  WorkflowResult,
} from '../workflow.types';

export class ParallelWorkflow {
  async execute(
    config: WorkflowConfig,
    context: WorkflowContext,
  ): Promise<WorkflowResult> {
    const results: Record<string, any> = {};
    const errors: Record<string, Error> = {};

    // Executar todos os steps em paralelo
    const promises = config.steps.map(async (step) => {
      try {
        // Verificar condição se houver
        if (step.condition && !step.condition(context)) {
          return { stepId: step.id, result: null, skipped: true };
        }

        // Executar step
        let stepResult: any;

        if (step.agent) {
          stepResult = { agent: step.agent, input: step.input };
        } else if (step.tool) {
          stepResult = { tool: step.tool, input: step.input };
        } else {
          throw new Error(`Step ${step.id} has no agent or tool`);
        }

        // Callback onSuccess
        if (step.onSuccess) {
          step.onSuccess(stepResult, context);
        }

        return { stepId: step.id, result: stepResult };
      } catch (error) {
        // Callback onError
        if (step.onError) {
          step.onError(error as Error, context);
        }

        return { stepId: step.id, error: error as Error };
      }
    });

    const stepResults = await Promise.all(promises);

    // Processar resultados
    stepResults.forEach(({ stepId, result, error, skipped }) => {
      if (skipped) {
        return;
      }

      if (error) {
        errors[stepId] = error;
      } else {
        results[stepId] = result;
        context.results[stepId] = result;
      }
    });

    return {
      success: Object.keys(errors).length === 0,
      results,
      errors,
      executionTime: 0,
    };
  }
}

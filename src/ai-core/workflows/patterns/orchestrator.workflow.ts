import {
  WorkflowConfig,
  WorkflowContext,
  WorkflowResult,
} from '../workflow.types';

export class OrchestratorWorkflow {
  async execute(
    config: WorkflowConfig,
    context: WorkflowContext,
  ): Promise<WorkflowResult> {
    const results: Record<string, any> = {};
    const errors: Record<string, Error> = {};

    // Primeiro step deve ser o orchestrator
    const orchestratorStep = config.steps[0];
    if (!orchestratorStep) {
      throw new Error('Orchestrator workflow requires at least one step');
    }

    try {
      // Executar orchestrator
      let orchestratorResult: any;
      if (orchestratorStep.agent) {
        orchestratorResult = {
          agent: orchestratorStep.agent,
          input: orchestratorStep.input,
        };
      } else {
        throw new Error('Orchestrator step must have an agent');
      }

      results[orchestratorStep.id] = orchestratorResult;
      context.results[orchestratorStep.id] = orchestratorResult;

      // Executar workers em paralelo
      const workerSteps = config.steps.slice(1);
      const workerPromises = workerSteps.map(async (step) => {
        try {
          if (step.condition && !step.condition(context)) {
            return { stepId: step.id, result: null, skipped: true };
          }

          let stepResult: any;
          if (step.agent) {
            stepResult = { agent: step.agent, input: step.input };
          } else if (step.tool) {
            stepResult = { tool: step.tool, input: step.input };
          } else {
            throw new Error(`Step ${step.id} has no agent or tool`);
          }

          if (step.onSuccess) {
            step.onSuccess(stepResult, context);
          }

          return { stepId: step.id, result: stepResult };
        } catch (error) {
          if (step.onError) {
            step.onError(error as Error, context);
          }
          return { stepId: step.id, error: error as Error };
        }
      });

      const workerResults = await Promise.all(workerPromises);
      workerResults.forEach(({ stepId, result, error, skipped }) => {
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
    } catch (error) {
      errors[orchestratorStep.id] = error as Error;
    }

    return {
      success: Object.keys(errors).length === 0,
      results,
      errors,
      executionTime: 0,
    };
  }
}

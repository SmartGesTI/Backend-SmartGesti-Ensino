import {
  WorkflowConfig,
  WorkflowContext,
  WorkflowResult,
} from '../workflow.types';

export class EvaluatorOptimizerWorkflow {
  async execute(
    config: WorkflowConfig,
    context: WorkflowContext,
  ): Promise<WorkflowResult> {
    const results: Record<string, any> = {};
    const errors: Record<string, Error> = {};

    // Primeiro step deve ser o gerador
    const generatorStep = config.steps[0];
    if (!generatorStep) {
      throw new Error(
        'Evaluator-optimizer workflow requires at least one step',
      );
    }

    const maxIterations = 5; // Limite de iterações
    let iteration = 0;
    let currentResult: any;

    try {
      // Loop de avaliação e otimização
      while (iteration < maxIterations) {
        iteration++;

        // Gerar/otimizar
        if (generatorStep.agent) {
          currentResult = {
            agent: generatorStep.agent,
            input: generatorStep.input,
            iteration,
          };
        } else {
          throw new Error('Generator step must have an agent');
        }

        results[`${generatorStep.id}_iteration_${iteration}`] = currentResult;

        // Avaliar (segundo step deve ser o avaliador)
        const evaluatorStep = config.steps[1];
        if (evaluatorStep) {
          let evaluation: any;
          if (evaluatorStep.agent) {
            evaluation = {
              agent: evaluatorStep.agent,
              input: { ...evaluatorStep.input, currentResult },
            };
          } else {
            throw new Error('Evaluator step must have an agent');
          }

          results[`${evaluatorStep.id}_iteration_${iteration}`] = evaluation;

          // Se avaliação for satisfatória, parar
          if (evaluation.satisfactory) {
            break;
          }
        } else {
          // Sem avaliador, parar após primeira iteração
          break;
        }
      }

      results[generatorStep.id] = currentResult;
    } catch (error) {
      errors[generatorStep.id] = error as Error;
    }

    return {
      success: Object.keys(errors).length === 0,
      results,
      errors,
      executionTime: 0,
    };
  }
}

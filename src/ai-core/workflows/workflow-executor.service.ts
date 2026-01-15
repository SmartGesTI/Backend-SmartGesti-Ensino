import { Injectable, Logger } from '@nestjs/common';
import {
  WorkflowConfig,
  WorkflowContext,
  WorkflowResult,
} from './workflow.types';
import { SequentialWorkflow } from './patterns/sequential.workflow';
import { ParallelWorkflow } from './patterns/parallel.workflow';
import { OrchestratorWorkflow } from './patterns/orchestrator.workflow';
import { EvaluatorOptimizerWorkflow } from './patterns/evaluator-optimizer.workflow';

@Injectable()
export class WorkflowExecutorService {
  private readonly logger = new Logger(WorkflowExecutorService.name);

  async execute(
    config: WorkflowConfig,
    context: WorkflowContext,
  ): Promise<WorkflowResult> {
    const startTime = Date.now();
    this.logger.debug(`Executing workflow: ${config.name} (${config.pattern})`);

    try {
      let result: WorkflowResult;

      switch (config.pattern) {
        case 'sequential':
          result = await new SequentialWorkflow().execute(config, context);
          break;
        case 'parallel':
          result = await new ParallelWorkflow().execute(config, context);
          break;
        case 'orchestrator':
          result = await new OrchestratorWorkflow().execute(config, context);
          break;
        case 'evaluator-optimizer':
          result = await new EvaluatorOptimizerWorkflow().execute(
            config,
            context,
          );
          break;
        default:
          throw new Error(`Unknown workflow pattern: ${config.pattern}`);
      }

      result.executionTime = Date.now() - startTime;
      this.logger.debug(
        `Workflow ${config.name} completed in ${result.executionTime}ms`,
      );

      return result;
    } catch (error) {
      this.logger.error(
        `Workflow ${config.name} failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}

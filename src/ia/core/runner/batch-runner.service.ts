import { Injectable, Logger } from '@nestjs/common';
import { CoreAgent, AgentRunOptions } from '../agent/agent.types';
import { CoreContext } from '../context/context.types';
import { AgentRunnerService } from './agent-runner.service';
import { RunResult } from '@openai/agents';

/**
 * Configuração para execução em lote
 */
export interface BatchRunConfig<TContext extends CoreContext = CoreContext>
  extends AgentRunOptions<TContext> {
  maxConcurrency?: number;
  retryAttempts?: number;
  retryDelay?: number;
}

/**
 * Resultado de execução em lote
 */
export interface BatchRunResult<TContext extends CoreContext = CoreContext> {
  results: Array<{
    input: string | any[];
    result?: RunResult<TContext, CoreAgent<TContext>>;
    error?: Error;
    success: boolean;
  }>;
  total: number;
  successful: number;
  failed: number;
}

/**
 * Serviço para execução de agentes em lote
 */
@Injectable()
export class BatchRunnerService {
  private readonly logger = new Logger(BatchRunnerService.name);

  constructor(private readonly agentRunner: AgentRunnerService) {}

  /**
   * Executa múltiplos agentes em lote
   */
  async runBatch<TContext extends CoreContext = CoreContext>(
    agent: CoreAgent<TContext>,
    inputs: Array<string | any[]>,
    config?: BatchRunConfig<TContext>,
  ): Promise<BatchRunResult<TContext>> {
    const maxConcurrency = config?.maxConcurrency || 5;
    const results: BatchRunResult<TContext>['results'] = [];
    let successful = 0;
    let failed = 0;

    this.logger.log(
      `Executando batch: ${inputs.length} inputs, concorrência: ${maxConcurrency}`,
    );

    // Processar em lotes com limite de concorrência
    for (let i = 0; i < inputs.length; i += maxConcurrency) {
      const batch = inputs.slice(i, i + maxConcurrency);
      const batchPromises = batch.map((input, index) =>
        this.runWithRetry(
          agent,
          input,
          config,
          i + index,
        ),
      );

      const batchResults = await Promise.allSettled(batchPromises);

      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
          if (result.value.success) {
            successful++;
          } else {
            failed++;
          }
        } else {
          results.push({
            input: batch[batchResults.indexOf(result)],
            error: result.reason,
            success: false,
          });
          failed++;
        }
      }
    }

    return {
      results,
      total: inputs.length,
      successful,
      failed,
    };
  }

  /**
   * Executa com retry
   */
  private async runWithRetry<TContext extends CoreContext = CoreContext>(
    agent: CoreAgent<TContext>,
    input: string | any[],
    config: BatchRunConfig<TContext> | undefined,
    index: number,
  ): Promise<BatchRunResult<TContext>['results'][0]> {
    const retryAttempts = config?.retryAttempts || 3;
    const retryDelay = config?.retryDelay || 1000;

    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        const result = await this.agentRunner.run(agent, input, config);
        return {
          input,
          result,
          success: true,
        };
      } catch (error: any) {
        if (attempt === retryAttempts) {
          this.logger.error(
            `Falha após ${retryAttempts} tentativas para input ${index}: ${error.message}`,
          );
          return {
            input,
            error: error as Error,
            success: false,
          };
        }

        this.logger.warn(
          `Tentativa ${attempt}/${retryAttempts} falhou para input ${index}, tentando novamente...`,
        );
        await this.delay(retryDelay * attempt);
      }
    }

    return {
      input,
      error: new Error('Max retry attempts exceeded'),
      success: false,
    };
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

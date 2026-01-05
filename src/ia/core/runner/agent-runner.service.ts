import { Injectable, Logger } from '@nestjs/common';
import { run, RunResult } from '@openai/agents';
import { CoreAgent, AgentRunOptions } from '../agent/agent.types';
import { CoreContext } from '../context/context.types';

/**
 * Serviço para execução de agentes
 */
@Injectable()
export class AgentRunnerService {
  private readonly logger = new Logger(AgentRunnerService.name);

  /**
   * Executa um agente de forma síncrona
   */
  async run<TContext extends CoreContext = CoreContext>(
    agent: CoreAgent<TContext>,
    input: string | any[],
    options?: AgentRunOptions<TContext>,
  ): Promise<RunResult<TContext, CoreAgent<TContext>>> {
    try {
      this.logger.log(`Executando agente: ${agent.name}`);

      const runOptions: any = {
        context: options?.context,
        session: options?.session,
      };

      if (options?.stream === true) {
        throw new Error('Use StreamRunnerService para streaming');
      }

      if (options?.modelSettings) {
        runOptions.modelSettings = options.modelSettings;
      }

      const result = await run(agent, input, runOptions);

      this.logger.log(
        `Agente ${agent.name} executado com sucesso. Output: ${result.finalOutput?.substring(0, 100)}...`,
      );

      return result as unknown as RunResult<TContext, CoreAgent<TContext>>;
    } catch (error: any) {
      this.logger.error(
        `Erro ao executar agente ${agent.name}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Executa um agente de forma assíncrona (não bloqueante)
   */
  async runAsync<TContext extends CoreContext = CoreContext>(
    agent: CoreAgent<TContext>,
    input: string | any[],
    options?: AgentRunOptions<TContext>,
  ): Promise<Promise<RunResult<TContext, CoreAgent<TContext>>>> {
    return this.run(agent, input, options);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { run, StreamedRunResult } from '@openai/agents';
import { Observable } from 'rxjs';
import { CoreAgent, AgentRunOptions } from '../agent/agent.types';
import { CoreContext } from '../context/context.types';

/**
 * Serviço para execução de agentes com streaming
 */
@Injectable()
export class StreamRunnerService {
  private readonly logger = new Logger(StreamRunnerService.name);

  /**
   * Executa um agente com streaming
   */
  async *stream<TContext extends CoreContext = CoreContext>(
    agent: CoreAgent<TContext>,
    input: string | any[],
    options?: AgentRunOptions<TContext>,
  ): AsyncGenerator<any, void, unknown> {
    try {
      this.logger.log(`Executando agente com streaming: ${agent.name}`);

      const runOptions: any = {
        context: options?.context,
        session: options?.session,
        stream: true as const,
      };

      if (options?.modelSettings) {
        runOptions.modelSettings = options.modelSettings;
      }

      const streamResult = run(agent, input, runOptions);
      const stream = streamResult as unknown as AsyncIterable<StreamedRunResult<TContext, CoreAgent<TContext>>>;

      for await (const event of stream) {
        yield event;
      }
    } catch (error: any) {
      this.logger.error(
        `Erro ao executar agente com streaming ${agent.name}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Executa um agente com streaming retornando Observable
   */
  streamAsObservable<TContext extends CoreContext = CoreContext>(
    agent: CoreAgent<TContext>,
    input: string | any[],
    options?: AgentRunOptions<TContext>,
  ): Observable<any> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          for await (const event of this.stream(agent, input, options)) {
            subscriber.next(event);
          }
          subscriber.complete();
        } catch (error: any) {
          subscriber.error(error);
        }
      })();
    });
  }
}

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
   * Baseado na documentação: https://openai.github.io/openai-agents-js/guides/streaming/
   * run() com stream: true retorna um StreamedRunResult que é AsyncIterable
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

      // run() com stream: true retorna uma Promise que resolve para um StreamedRunResult
      // Segundo a documentação: https://openai.github.io/openai-agents-js/guides/streaming/
      // const result = await run(agent, input, { stream: true });
      // for await (const event of result) { ... }
      const streamResult = await run(agent, input, runOptions) as unknown as StreamedRunResult<TContext, CoreAgent<TContext>>;

      // Verificar se é async iterable
      if (!streamResult || typeof streamResult[Symbol.asyncIterator] !== 'function') {
        this.logger.error(
          `streamResult não é async iterable. Tipo: ${typeof streamResult}, constructor: ${streamResult?.constructor?.name}`,
        );
        this.logger.error(`streamResult keys: ${Object.keys(streamResult || {}).join(', ')}`);
        throw new Error(
          `streamResult não é async iterable. O resultado de run() com stream: true deve ser um StreamedRunResult iterável.`,
        );
      }

      // StreamedRunResult implementa AsyncIterable, então podemos iterar diretamente
      for await (const event of streamResult) {
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

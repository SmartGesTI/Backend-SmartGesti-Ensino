import { Injectable, Logger } from '@nestjs/common';
import { streamText, Output } from 'ai';
import { ModelMessage } from '@ai-sdk/provider-utils';
import { Observable } from 'rxjs';
import { ModelProviderFactory } from '../providers/model-provider.factory';
import { ModelProviderConfigService } from '../config/model-provider.config';
import { AiCoreConfigService } from '../config/ai-core.config';
import { StreamEvent, StreamOptions, StreamResult } from './stream.types';

@Injectable()
export class StreamService {
  private readonly logger = new Logger(StreamService.name);

  constructor(
    private readonly providerFactory: ModelProviderFactory,
    private readonly modelConfig: ModelProviderConfigService,
    private readonly aiConfig: AiCoreConfigService,
  ) {}

  async streamText(
    prompt: string | ModelMessage[],
    options: StreamOptions = {},
  ): Promise<Observable<StreamEvent>> {
    const provider = options.provider || this.aiConfig.getDefaultProvider();
    const modelName = options.model || this.modelConfig.getProvider(provider)?.defaultModel;

    if (!modelName) {
      throw new Error(`No model specified for provider ${provider}`);
    }

    const model = this.providerFactory.getModel(provider, modelName);
    if (!model) {
      throw new Error(`Model ${modelName} not available for provider ${provider}`);
    }

        const modelConfig = this.modelConfig.getModel(modelName);
        const messages = Array.isArray(prompt) ? prompt : [{ role: 'user' as const, content: prompt }];
        const isGpt5 = modelName.includes('gpt-5');

        // Apply timeout and retries from config
        const timeout = this.aiConfig.getTimeout();
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => {
          abortController.abort();
          this.logger.warn(`Stream timeout after ${timeout}ms`);
        }, timeout);

        const streamOptions: any = {
          model,
          messages,
          maxOutputTokens: options.maxTokens ?? modelConfig?.maxTokens,
          maxRetries: this.aiConfig.getMaxRetries(),
          abortSignal: abortController.signal,
        };

        // GPT-5 não suporta temperature, topP, frequencyPenalty, presencePenalty, stopSequences
        if (!isGpt5) {
          if (options.temperature !== undefined || modelConfig?.temperature !== undefined) {
            streamOptions.temperature = options.temperature ?? modelConfig?.temperature ?? 0.7;
          }
          if (options.topP !== undefined || modelConfig?.topP !== undefined) {
            streamOptions.topP = options.topP ?? modelConfig?.topP;
          }
          if (options.frequencyPenalty !== undefined || modelConfig?.frequencyPenalty !== undefined) {
            streamOptions.frequencyPenalty = options.frequencyPenalty ?? modelConfig?.frequencyPenalty;
          }
          if (options.presencePenalty !== undefined || modelConfig?.presencePenalty !== undefined) {
            streamOptions.presencePenalty = options.presencePenalty ?? modelConfig?.presencePenalty;
          }
          if (options.stopSequences !== undefined || modelConfig?.stopSequences !== undefined) {
            streamOptions.stopSequences = options.stopSequences ?? modelConfig?.stopSequences;
          }
        }

    // Configurar provider options (se necessário para outros recursos)
    if (!streamOptions.providerOptions) {
      streamOptions.providerOptions = {};
    }
    
    if (!streamOptions.providerOptions.openai) {
      streamOptions.providerOptions.openai = {};
    }

    // Se schema for fornecido, usar Output.object() para structured output
    if (options.schema) {
      streamOptions.output = Output.object({ schema: options.schema });
      this.logger.debug(`Streaming structured object with model ${modelName}`);
    }

    return new Observable<StreamEvent>((subscriber) => {
      let fullText = '';
      
      const result = streamText(streamOptions);

      (async () => {
        let startTime = Date.now();
        try {
          const hasStructuredOutput = !!options.schema;

          // Se houver structured output, usar fullStream para processar partialOutputStream
          if (hasStructuredOutput) {
            // Processar fullStream incluindo reasoning se disponível
                for await (const part of result.fullStream) {
                    const partAny = part as any;
              const partType = partAny.type as string;

              // Processar text-delta e reasoning
              if (partType === 'text-delta') {
                const delta = partAny.textDelta || '';
                    if (delta) {
                      fullText += delta;
                      subscriber.next({
                        type: 'text',
                        data: { text: delta, fullText },
                        timestamp: Date.now(),
                      });
                    }
              } else if (partType === 'reasoning') {
                // Forward reasoning parts to UI
                subscriber.next({
                  type: 'reasoning',
                  data: { 
                    reasoning: partAny.reasoning || '',
                    reasoningText: partAny.reasoningText || '',
                  },
                  timestamp: Date.now(),
                });
                  }
                }

            // Processar partialOutputStream para structured output
                for await (const partialObject of result.partialOutputStream) {
                  subscriber.next({
                    type: 'partial-object',
                    data: { partialObject },
                    timestamp: Date.now(),
                  });
            }
          } else {
            // Streaming normal de texto (sem structured output)
            for await (const chunk of result.textStream) {
              fullText += chunk;
              subscriber.next({
                type: 'text',
                data: { text: chunk, fullText },
                timestamp: Date.now(),
              });
            }
          }

          // Aguardar finishResult
          const finishResult = await result;
          const usageResult = await finishResult.usage;
          const elapsedTime = Date.now() - startTime;
          
          // Log telemetry
          const tokenCount = usageResult
            ? (usageResult.inputTokens ?? 0) + (usageResult.outputTokens ?? 0)
            : undefined;
          this.logger.debug(
            `Stream completed: ${elapsedTime}ms, tokens: ${tokenCount ?? 'N/A'}`,
          );

          const usage = usageResult
            ? {
                promptTokens: usageResult.inputTokens || 0,
                completionTokens: usageResult.outputTokens || 0,
                totalTokens:
                  (usageResult.inputTokens || 0) +
                  (usageResult.outputTokens || 0),
              }
            : undefined;

          // Preparar resultado final
          let streamResult: StreamResult;
          if (options.schema) {
            const finalObject = await finishResult.output;
            streamResult = {
              text: fullText,
              finishReason: finishResult.finishReason as any,
              usage,
              object: finalObject,
            };
          } else {
            streamResult = {
              text: fullText,
              finishReason: finishResult.finishReason as any,
              usage,
            };
          }

          subscriber.next({
            type: 'finish',
            data: streamResult,
            timestamp: Date.now(),
          });

          if (options.onFinish) {
            options.onFinish(streamResult);
          }

          clearTimeout(timeoutId);
          subscriber.complete();
        } catch (error) {
          clearTimeout(timeoutId);
          const elapsedTime = Date.now() - startTime;
          this.logger.error(
            `Stream error after ${elapsedTime}ms: ${error.message}`,
            error.stack,
          );
          subscriber.next({
            type: 'error',
            data: { error: error.message },
            timestamp: Date.now(),
          });

          if (options.onError) {
            options.onError(error as Error);
          }

          subscriber.error(error);
        }
      })();
    });
  }
}

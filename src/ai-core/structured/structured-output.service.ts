import { Injectable, Logger } from '@nestjs/common';
import { generateObject } from 'ai';
import { ModelMessage } from '@ai-sdk/provider-utils';
import { z } from 'zod';
import { ModelProviderFactory } from '../providers/model-provider.factory';
import { ModelProviderConfigService } from '../config/model-provider.config';
import { AiCoreConfigService } from '../config/ai-core.config';
import {
  StructuredOutputOptions,
  StructuredOutputResult,
} from './structured.types';

@Injectable()
export class StructuredOutputService {
  private readonly logger = new Logger(StructuredOutputService.name);

  constructor(
    private readonly providerFactory: ModelProviderFactory,
    private readonly modelConfig: ModelProviderConfigService,
    private readonly aiConfig: AiCoreConfigService,
  ) {}

  async generateObject<T extends z.ZodSchema>(
    prompt: string | ModelMessage[],
    schema: T,
    options: Omit<StructuredOutputOptions, 'schema'> = {},
  ): Promise<StructuredOutputResult<z.infer<T>>> {
    const provider = options.provider || this.aiConfig.getDefaultProvider();
    const modelName =
      options.model || this.modelConfig.getProvider(provider)?.defaultModel;

    if (!modelName) {
      throw new Error(`No model specified for provider ${provider}`);
    }

    const model = this.providerFactory.getModel(provider, modelName);
    if (!model) {
      throw new Error(
        `Model ${modelName} not available for provider ${provider}`,
      );
    }

    const modelConfig = this.modelConfig.getModel(modelName);
    const messages = Array.isArray(prompt)
      ? prompt
      : [{ role: 'user' as const, content: prompt }];

    this.logger.debug(
      `Generating structured object with model ${modelName} from provider ${provider}`,
    );

    try {
      const result = await generateObject({
        model,
        schema,
        messages,
        temperature: options.temperature ?? modelConfig?.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens ?? modelConfig?.maxTokens,
      });

      const usage = result.usage
        ? {
            promptTokens: result.usage.inputTokens || 0,
            completionTokens: result.usage.outputTokens || 0,
            totalTokens:
              (result.usage.inputTokens || 0) +
              (result.usage.outputTokens || 0),
          }
        : undefined;

      return {
        object: result.object as z.infer<T>,
        usage,
        finishReason: result.finishReason as 'stop' | 'length' | 'error',
      };
    } catch (error) {
      this.logger.error(
        `Error generating structured object: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}

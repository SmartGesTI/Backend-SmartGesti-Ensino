import { Injectable, Logger } from '@nestjs/common';
import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { LanguageModel } from 'ai';
import type {
  IModelProvider,
  ModelProviderOptions,
} from './model-provider.interface';

@Injectable()
export class AnthropicProvider implements IModelProvider {
  private readonly logger = new Logger(AnthropicProvider.name);
  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor(options: ModelProviderOptions) {
    this.apiKey = options.apiKey;
    this.defaultModel = options.defaultModel || 'claude-3-5-sonnet-20241022';

    if (!this.apiKey) {
      this.logger.warn('Anthropic API key not provided');
    }
  }

  getModel(modelName?: string): LanguageModel {
    const model = modelName || this.defaultModel;
    this.logger.debug(`Getting Anthropic model: ${model}`);

    // Se apiKey foi fornecida, usar createAnthropic para configurar explicitamente
    if (this.apiKey) {
      const provider = createAnthropic({
        apiKey: this.apiKey,
      });
      return provider(model);
    }

    // Caso contrário, usar função global que lê de ANTHROPIC_API_KEY
    return anthropic(model);
  }

  getProviderName(): 'anthropic' {
    return 'anthropic';
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }
}

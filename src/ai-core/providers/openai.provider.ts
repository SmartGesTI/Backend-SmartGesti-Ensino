import { Injectable, Logger } from '@nestjs/common';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { LanguageModel } from 'ai';
import type {
  IModelProvider,
  ModelProviderOptions,
} from './model-provider.interface';

@Injectable()
export class OpenAIProvider implements IModelProvider {
  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor(options: ModelProviderOptions) {
    this.apiKey = options.apiKey;
    this.defaultModel = options.defaultModel || 'gpt-4.1-nano';

    if (!this.apiKey) {
      this.logger.warn('OpenAI API key not provided');
    }
  }

  getModel(modelName?: string): LanguageModel {
    const model = modelName || this.defaultModel;
    this.logger.debug(`Getting OpenAI model: ${model}`);

    // Desde AI SDK 5, o Responses API é usado por padrão
    // Mas para garantir suporte a reasoning, vamos usar explicitamente para GPT-5
    const useResponsesAPI = model.includes('gpt-5');

    // Se apiKey foi fornecida, usar createOpenAI para configurar explicitamente
    if (this.apiKey) {
      const provider = createOpenAI({
        apiKey: this.apiKey,
      });

      // Para GPT-5, usar .responses() explicitamente para garantir reasoning support
      // Para outros modelos, usar provider() que já usa Responses API por padrão desde SDK 5
      if (useResponsesAPI) {
        this.logger.debug(`Using Responses API for GPT-5 model: ${model}`);
        return provider.responses(model);
      }

      return provider(model);
    }

    // Caso contrário, usar função global que lê de OPENAI_API_KEY
    if (useResponsesAPI) {
      this.logger.debug(
        `Using Responses API (global) for GPT-5 model: ${model}`,
      );
      return openai.responses(model);
    }

    return openai(model);
  }

  getProviderName(): 'openai' {
    return 'openai';
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }
}

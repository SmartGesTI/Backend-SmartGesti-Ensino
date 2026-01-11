import { Injectable, Logger } from '@nestjs/common';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import { LanguageModel } from 'ai';
import type {
  IModelProvider,
  ModelProviderOptions,
} from './model-provider.interface';

@Injectable()
export class GoogleProvider implements IModelProvider {
  private readonly logger = new Logger(GoogleProvider.name);
  private readonly apiKey: string;
  private readonly defaultModel: string;

  constructor(options: ModelProviderOptions) {
    this.apiKey = options.apiKey;
    this.defaultModel = options.defaultModel || 'gemini-1.5-pro';

    if (!this.apiKey) {
      this.logger.warn('Google API key not provided');
    }
  }

  getModel(modelName?: string): LanguageModel {
    const model = modelName || this.defaultModel;
    this.logger.debug(`Getting Google model: ${model}`);

    // Se apiKey foi fornecida, usar createGoogleGenerativeAI para configurar explicitamente
    if (this.apiKey) {
      const provider = createGoogleGenerativeAI({
        apiKey: this.apiKey,
      });
      return provider(model);
    }

    // Caso contrário, usar função global que lê de GOOGLE_API_KEY
    return google(model);
  }

  getProviderName(): 'google' {
    return 'google';
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }
}

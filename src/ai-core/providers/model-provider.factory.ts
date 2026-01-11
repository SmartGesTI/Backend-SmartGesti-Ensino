import { Injectable, Logger } from '@nestjs/common';
import { LanguageModel } from 'ai';
import { ModelProviderConfigService } from '../config/model-provider.config';
import { IModelProvider } from './model-provider.interface';
import { OpenAIProvider } from './openai.provider';
import { AnthropicProvider } from './anthropic.provider';
import { GoogleProvider } from './google.provider';

@Injectable()
export class ModelProviderFactory {
  private readonly logger = new Logger(ModelProviderFactory.name);
  private readonly providers: Map<string, IModelProvider> = new Map();

  constructor(private readonly modelConfig: ModelProviderConfigService) {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Initialize OpenAI
    const openaiConfig = this.modelConfig.getProvider('openai');
    if (openaiConfig) {
      const provider = new OpenAIProvider({
        apiKey: openaiConfig.apiKey,
        defaultModel: openaiConfig.defaultModel,
      });
      this.providers.set('openai', provider);
      this.logger.log('OpenAI provider initialized');
    }

    // Initialize Anthropic
    const anthropicConfig = this.modelConfig.getProvider('anthropic');
    if (anthropicConfig) {
      const provider = new AnthropicProvider({
        apiKey: anthropicConfig.apiKey,
        defaultModel: anthropicConfig.defaultModel,
      });
      this.providers.set('anthropic', provider);
      this.logger.log('Anthropic provider initialized');
    }

    // Initialize Google
    const googleConfig = this.modelConfig.getProvider('google');
    if (googleConfig) {
      const provider = new GoogleProvider({
        apiKey: googleConfig.apiKey,
        defaultModel: googleConfig.defaultModel,
      });
      this.providers.set('google', provider);
      this.logger.log('Google provider initialized');
    }
  }

  getProvider(providerName: 'openai' | 'anthropic' | 'google'): IModelProvider | undefined {
    return this.providers.get(providerName);
  }

  getModel(
    providerName: 'openai' | 'anthropic' | 'google',
    modelName?: string,
  ): LanguageModel | undefined {
    const provider = this.getProvider(providerName);
    if (!provider) {
      this.logger.warn(`Provider ${providerName} not available`);
      return undefined;
    }

    if (!provider.isAvailable()) {
      this.logger.warn(`Provider ${providerName} is not available (missing API key)`);
      return undefined;
    }

    return provider.getModel(modelName);
  }

  getAvailableProviders(): string[] {
    return Array.from(this.providers.keys()).filter((key) => {
      const provider = this.providers.get(key as 'openai' | 'anthropic' | 'google');
      return provider?.isAvailable();
    });
  }

  isProviderAvailable(providerName: 'openai' | 'anthropic' | 'google'): boolean {
    const provider = this.getProvider(providerName);
    return provider?.isAvailable() || false;
  }
}

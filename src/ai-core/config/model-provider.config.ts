import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ModelConfig {
  name: string;
  provider: 'openai' | 'anthropic' | 'google';
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel: string;
  models: ModelConfig[];
}

@Injectable()
export class ModelProviderConfigService {
  private readonly providers: Map<string, ProviderConfig> = new Map();
  private readonly models: Map<string, ModelConfig> = new Map();

  constructor(private readonly configService: ConfigService) {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // OpenAI
    const openaiApiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (openaiApiKey) {
      this.providers.set('openai', {
        apiKey: openaiApiKey,
        defaultModel: this.configService.get<string>('OPENAI_DEFAULT_MODEL') || 'gpt-5-mini',
        models: [
          {
            name: 'gpt-5-mini',
            provider: 'openai',
            temperature: 0.7,
            maxTokens: 128000, // GPT-5-mini suporta até 128k tokens de saída
          },
          {
            name: 'gpt-5',
            provider: 'openai',
            temperature: 0.7,
            maxTokens: 128000,
          },
          {
            name: 'gpt-4.1-nano',
            provider: 'openai',
            temperature: 0.7,
            maxTokens: 16384,
          },
          {
            name: 'gpt-4o',
            provider: 'openai',
            temperature: 0.7,
            maxTokens: 4096,
          },
          {
            name: 'gpt-4o-mini',
            provider: 'openai',
            temperature: 0.7,
            maxTokens: 16384,
          },
          {
            name: 'gpt-4-turbo',
            provider: 'openai',
            temperature: 0.7,
            maxTokens: 4096,
          },
        ],
      });

      this.providers.get('openai')?.models.forEach((model) => {
        this.models.set(model.name, model);
      });
    }

    // Anthropic
    const anthropicApiKey = this.configService.get<string>('ANTHROPIC_API_KEY');
    if (anthropicApiKey) {
      this.providers.set('anthropic', {
        apiKey: anthropicApiKey,
        defaultModel: this.configService.get<string>('ANTHROPIC_DEFAULT_MODEL') || 'claude-3-5-sonnet-20241022',
        models: [
          {
            name: 'claude-3-5-sonnet-20241022',
            provider: 'anthropic',
            temperature: 0.7,
            maxTokens: 8192,
          },
          {
            name: 'claude-3-opus-20240229',
            provider: 'anthropic',
            temperature: 0.7,
            maxTokens: 4096,
          },
          {
            name: 'claude-3-haiku-20240307',
            provider: 'anthropic',
            temperature: 0.7,
            maxTokens: 4096,
          },
        ],
      });

      this.providers.get('anthropic')?.models.forEach((model) => {
        this.models.set(model.name, model);
      });
    }

    // Google
    const googleApiKey = this.configService.get<string>('GOOGLE_API_KEY');
    if (googleApiKey) {
      this.providers.set('google', {
        apiKey: googleApiKey,
        defaultModel: this.configService.get<string>('GOOGLE_DEFAULT_MODEL') || 'gemini-1.5-pro',
        models: [
          {
            name: 'gemini-1.5-pro',
            provider: 'google',
            temperature: 0.7,
            maxTokens: 8192,
          },
          {
            name: 'gemini-1.5-flash',
            provider: 'google',
            temperature: 0.7,
            maxTokens: 8192,
          },
          {
            name: 'gemini-pro',
            provider: 'google',
            temperature: 0.7,
            maxTokens: 4096,
          },
        ],
      });

      this.providers.get('google')?.models.forEach((model) => {
        this.models.set(model.name, model);
      });
    }
  }

  getProvider(provider: 'openai' | 'anthropic' | 'google'): ProviderConfig | undefined {
    return this.providers.get(provider);
  }

  getModel(modelName: string): ModelConfig | undefined {
    return this.models.get(modelName);
  }

  getAllProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  getAllModels(provider?: 'openai' | 'anthropic' | 'google'): ModelConfig[] {
    if (provider) {
      return this.providers.get(provider)?.models || [];
    }
    return Array.from(this.models.values());
  }

  getApiKey(provider: 'openai' | 'anthropic' | 'google'): string | undefined {
    return this.providers.get(provider)?.apiKey;
  }

  isProviderAvailable(provider: 'openai' | 'anthropic' | 'google'): boolean {
    return this.providers.has(provider);
  }
}

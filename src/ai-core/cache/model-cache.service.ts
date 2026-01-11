import { Injectable, Logger } from '@nestjs/common';
import { ModelConfig } from '../config/model-provider.config';
import { AiCacheService } from './ai-cache.service';

@Injectable()
export class ModelCacheService {
  private readonly logger = new Logger(ModelCacheService.name);
  private readonly CACHE_TTL = 3600; // 1 hora

  constructor(private readonly cache: AiCacheService) {}

  /**
   * Cache de modelos disponíveis por provider
   */
  getModels(provider: 'openai' | 'anthropic' | 'google'): ModelConfig[] | undefined {
    return this.cache.get<ModelConfig[]>(`models:${provider}`);
  }

  setModels(provider: 'openai' | 'anthropic' | 'google', models: ModelConfig[]): void {
    this.cache.set(`models:${provider}`, models, { ttl: this.CACHE_TTL });
  }

  /**
   * Cache de configuração de modelo específico
   */
  getModelConfig(modelName: string): ModelConfig | undefined {
    return this.cache.get<ModelConfig>(`model:${modelName}`);
  }

  setModelConfig(modelName: string, config: ModelConfig): void {
    this.cache.set(`model:${modelName}`, config, { ttl: this.CACHE_TTL });
  }

  /**
   * Limpa cache de modelos
   */
  clear(provider?: 'openai' | 'anthropic' | 'google'): void {
    if (provider) {
      this.cache.delete(`models:${provider}`);
    } else {
      // Limpar todos os modelos
      ['openai', 'anthropic', 'google'].forEach((p) => {
        this.cache.delete(`models:${p}`);
      });
    }
  }
}

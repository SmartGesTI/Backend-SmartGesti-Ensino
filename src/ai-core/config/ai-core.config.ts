import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface AiCoreConfig {
  defaultProvider: 'openai' | 'anthropic' | 'google';
  defaultModel: string;
  enableStreaming: boolean;
  enableStructuredOutput: boolean;
  enableCache: boolean;
  cacheTtl: number;
  maxRetries: number;
  timeout: number;
}

@Injectable()
export class AiCoreConfigService {
  private readonly config: AiCoreConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      defaultProvider:
        (this.configService.get<string>('AI_DEFAULT_PROVIDER') as
          | 'openai'
          | 'anthropic'
          | 'google') || 'openai',
      defaultModel:
        this.configService.get<string>('AI_DEFAULT_MODEL') || 'gpt-5-mini',
      enableStreaming:
        this.configService.get<string>('AI_ENABLE_STREAMING') !== 'false',
      enableStructuredOutput:
        this.configService.get<string>('AI_ENABLE_STRUCTURED_OUTPUT') !==
        'false',
      enableCache:
        this.configService.get<string>('AI_ENABLE_CACHE') !== 'false',
      cacheTtl: parseInt(
        this.configService.get<string>('AI_CACHE_TTL') || '3600',
        10,
      ),
      maxRetries: parseInt(
        this.configService.get<string>('AI_MAX_RETRIES') || '3',
        10,
      ),
      timeout: parseInt(
        this.configService.get<string>('AI_TIMEOUT') || '60000',
        10,
      ),
    };
  }

  getConfig(): AiCoreConfig {
    return this.config;
  }

  getDefaultProvider(): 'openai' | 'anthropic' | 'google' {
    return this.config.defaultProvider;
  }

  getDefaultModel(): string {
    return this.config.defaultModel;
  }

  isStreamingEnabled(): boolean {
    return this.config.enableStreaming;
  }

  isStructuredOutputEnabled(): boolean {
    return this.config.enableStructuredOutput;
  }

  isCacheEnabled(): boolean {
    return this.config.enableCache;
  }

  getCacheTtl(): number {
    return this.config.cacheTtl;
  }

  getMaxRetries(): number {
    return this.config.maxRetries;
  }

  getTimeout(): number {
    return this.config.timeout;
  }
}

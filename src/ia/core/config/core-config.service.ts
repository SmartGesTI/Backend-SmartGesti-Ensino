import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setDefaultOpenAIKey } from '@openai/agents';

/**
 * Serviço de configuração central do core IA
 */
@Injectable()
export class CoreConfigService {
  private readonly logger = new Logger(CoreConfigService.name);
  private readonly openaiApiKey: string;
  private readonly defaultModel: string;

  constructor(private readonly configService: ConfigService) {
    this.openaiApiKey =
      this.configService.get<string>('OPENAI_API_KEY') || '';
    this.defaultModel =
      this.configService.get<string>('OPENAI_DEFAULT_MODEL') ||
      'gpt-4.1-mini';

    if (!this.openaiApiKey) {
      this.logger.warn(
        'OPENAI_API_KEY não configurada. Execuções de IA falharão.',
      );
    } else {
      setDefaultOpenAIKey(this.openaiApiKey);
      this.logger.log(
        `OpenAI API Key configurada. Modelo padrão: ${this.defaultModel}`,
      );
    }
  }

  /**
   * Obtém a chave da API OpenAI
   */
  getOpenAIApiKey(): string {
    return this.openaiApiKey;
  }

  /**
   * Obtém o modelo padrão
   */
  getDefaultModel(): string {
    return this.defaultModel;
  }

  /**
   * Obtém uma configuração do ambiente
   */
  get<T = any>(key: string, defaultValue?: T): T | undefined {
    return this.configService.get<T>(key) ?? defaultValue;
  }

  /**
   * Verifica se uma feature está habilitada
   */
  isFeatureEnabled(feature: string): boolean {
    return (
      this.configService.get<string>(`FEATURE_${feature.toUpperCase()}`) ===
      'true'
    );
  }
}

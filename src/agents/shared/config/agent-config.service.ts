import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../common/logger/logger.service';

/**
 * ============================================
 * CONFIGURAÇÃO DO MODELO PADRÃO DO ASSISTENTE
 * ============================================
 *
 * Para alterar o modelo padrão do Assistente IA, modifique a constante abaixo.
 *
 * Modelos disponíveis (conforme definidos no frontend em openaiModels.ts):
 * - gpt-5-nano (recomendado - rápido, econômico, com raciocínio básico)
 * - gpt-5.2 (mais poderoso, mais caro, raciocínio profundo)
 * - gpt-5-mini (equilibrado, raciocínio médio)
 * - gpt-4.1-nano (legado - mais rápido, sem raciocínio)
 *
 * IMPORTANTE:
 * - Esta constante é específica para o Assistente IA
 * - A variável de ambiente OPENAI_DEFAULT_MODEL é usada como fallback geral
 *   para outros serviços (Workflow Executor, etc)
 * - O Assistente usa gpt-5-nano por padrão, mas pode ser sobrescrito
 *   pela variável OPENAI_ASSISTANT_MODEL se definida
 * - Use modelos que existem no frontend (openaiModels.ts) para garantir compatibilidade
 */
const ASSISTANT_DEFAULT_MODEL = 'gpt-5-nano';
const GENERAL_FALLBACK_MODEL = 'gpt-4.1-nano'; // Fallback geral para outros serviços

@Injectable()
export class AgentConfigService {
  private readonly openaiApiKey: string;
  private readonly defaultModel: string;
  private readonly maxRetries: number;
  private readonly timeout: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {
    this.openaiApiKey = this.configService.get<string>('OPENAI_API_KEY') || '';

    // Prioridade para o Assistente:
    // 1. OPENAI_ASSISTANT_MODEL (específico do assistente, se definido)
    // 2. ASSISTANT_DEFAULT_MODEL (constante gpt-5.2-nano)
    // 3. OPENAI_DEFAULT_MODEL (fallback geral, geralmente gpt-4.1-nano)
    // 4. GENERAL_FALLBACK_MODEL (último recurso)
    const assistantSpecificModel = this.configService.get<string>(
      'OPENAI_ASSISTANT_MODEL',
    );
    const generalEnvModel = this.configService.get<string>(
      'OPENAI_DEFAULT_MODEL',
    );

    if (assistantSpecificModel) {
      this.defaultModel = assistantSpecificModel;
    } else {
      // Usar o modelo padrão do assistente (gpt-5.2-nano), não o fallback geral
      this.defaultModel = ASSISTANT_DEFAULT_MODEL;
    }

    this.maxRetries = this.configService.get<number>('LLM_MAX_RETRIES') || 3;
    this.timeout = this.configService.get<number>('LLM_TIMEOUT') || 60000; // 60 segundos

    if (!this.openaiApiKey) {
      this.logger.warn(
        'OPENAI_API_KEY não configurada. Execuções de LLM falharão.',
        'AgentConfigService',
      );
    } else {
      let source: string;
      if (assistantSpecificModel) {
        source = 'variável de ambiente OPENAI_ASSISTANT_MODEL';
      } else {
        source = `constante ASSISTANT_DEFAULT_MODEL (${ASSISTANT_DEFAULT_MODEL})`;
        if (generalEnvModel) {
          source += ` [NOTA: OPENAI_DEFAULT_MODEL=${generalEnvModel} existe mas não é usada pelo Assistente]`;
        }
      }
      this.logger.log(
        `[AgentConfigService] Modelo Assistente IA: ${this.defaultModel} (fonte: ${source})`,
        'AgentConfigService',
      );

      // Validar se o modelo existe na lista de modelos disponíveis
      const validModels = [
        'gpt-4.1',
        'gpt-4.1-mini',
        'gpt-4.1-nano',
        'gpt-5.2',
        'gpt-5',
        'gpt-5-mini',
        'gpt-5-nano',
      ];
      if (!validModels.includes(this.defaultModel)) {
        this.logger.warn(
          `[AgentConfigService] ATENÇÃO: Modelo ${this.defaultModel} pode não estar disponível na API OpenAI. Modelos válidos: ${validModels.join(', ')}`,
          'AgentConfigService',
        );
      }
    }
  }

  /**
   * Obtém a chave da API do OpenAI
   */
  getApiKey(): string {
    if (!this.openaiApiKey) {
      throw new Error('OPENAI_API_KEY não configurada');
    }
    return this.openaiApiKey;
  }

  /**
   * Obtém o modelo padrão
   */
  getDefaultModel(): string {
    return this.defaultModel;
  }

  /**
   * Obtém configuração de modelo específica
   */
  getModelConfig(model?: string): {
    model: string;
    maxTokens: number;
    temperature: number;
  } {
    const modelToUse = model || this.defaultModel;

    // Configurações por modelo (maxTokens = completion tokens limit)
    // GPT-4.1: max output tokens = 32,768
    // GPT-5.2: max output tokens = 128,000 (assumindo similar ao GPT-5.1)
    // GPT-5: max output tokens = 128,000
    // GPT-5-mini/nano: usando valores conservadores
    const modelConfigs: Record<
      string,
      { maxTokens: number; temperature: number }
    > = {
      'gpt-4.1': { maxTokens: 32768, temperature: 0.7 },
      'gpt-4.1-mini': { maxTokens: 32768, temperature: 0.7 },
      'gpt-4.1-nano': { maxTokens: 32768, temperature: 0.7 },
      'gpt-5.2': { maxTokens: 128000, temperature: 0.7 },
      'gpt-5': { maxTokens: 128000, temperature: 0.7 },
      'gpt-5-mini': { maxTokens: 128000, temperature: 0.7 },
      'gpt-5-nano': { maxTokens: 128000, temperature: 0.7 },
    };

    return {
      model: modelToUse,
      ...(modelConfigs[modelToUse] || { maxTokens: 4096, temperature: 0.7 }),
    };
  }

  /**
   * Obtém configuração de retry
   */
  getRetryConfig(): { maxRetries: number; retryDelay: number } {
    return {
      maxRetries: this.maxRetries,
      retryDelay: 1000, // 1 segundo
    };
  }

  /**
   * Obtém timeout para requisições
   */
  getTimeout(): number {
    return this.timeout;
  }

  /**
   * Verifica se a API key está configurada
   */
  isConfigured(): boolean {
    return !!this.openaiApiKey;
  }
}

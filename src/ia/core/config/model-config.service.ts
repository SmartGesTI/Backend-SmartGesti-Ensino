import { Injectable, Logger } from '@nestjs/common';
import { CoreConfigService } from './core-config.service';

/**
 * Informações sobre um modelo
 */
export interface ModelInfo {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'other';
  maxTokens: number;
  supportsStreaming: boolean;
  supportsFunctions: boolean;
  supportsStructuredOutputs: boolean;
  costPer1kTokens?: {
    input: number;
    output: number;
  };
}

/**
 * Serviço de configuração de modelos
 */
@Injectable()
export class ModelConfigService {
  private readonly logger = new Logger(ModelConfigService.name);
  private readonly models: Map<string, ModelInfo> = new Map();
  private readonly defaultModel: string;

  constructor(private readonly coreConfig: CoreConfigService) {
    this.defaultModel = coreConfig.getDefaultModel();
    this.initializeModels();
  }

  private initializeModels() {
    // Modelos OpenAI
    this.models.set('gpt-4.1', {
      id: 'gpt-4.1',
      name: 'GPT-4.1',
      provider: 'openai',
      maxTokens: 32768,
      supportsStreaming: true,
      supportsFunctions: true,
      supportsStructuredOutputs: true,
      costPer1kTokens: {
        input: 2.0,
        output: 8.0,
      },
    });

    this.models.set('gpt-4.1-mini', {
      id: 'gpt-4.1-mini',
      name: 'GPT-4.1 Mini',
      provider: 'openai',
      maxTokens: 32768,
      supportsStreaming: true,
      supportsFunctions: true,
      supportsStructuredOutputs: true,
      costPer1kTokens: {
        input: 0.4,
        output: 1.6,
      },
    });

    this.models.set('gpt-4.1-nano', {
      id: 'gpt-4.1-nano',
      name: 'GPT-4.1 Nano',
      provider: 'openai',
      maxTokens: 32768,
      supportsStreaming: true,
      supportsFunctions: true,
      supportsStructuredOutputs: true,
      costPer1kTokens: {
        input: 0.1,
        output: 0.4,
      },
    });

    this.models.set('gpt-5.2', {
      id: 'gpt-5.2',
      name: 'GPT-5.2',
      provider: 'openai',
      maxTokens: 128000,
      supportsStreaming: true,
      supportsFunctions: true,
      supportsStructuredOutputs: true,
      costPer1kTokens: {
        input: 2.5,
        output: 10.0,
      },
    });

    this.models.set('gpt-5', {
      id: 'gpt-5',
      name: 'GPT-5',
      provider: 'openai',
      maxTokens: 128000,
      supportsStreaming: true,
      supportsFunctions: true,
      supportsStructuredOutputs: true,
      costPer1kTokens: {
        input: 1.25,
        output: 10.0,
      },
    });

    this.models.set('gpt-5-mini', {
      id: 'gpt-5-mini',
      name: 'GPT-5 Mini',
      provider: 'openai',
      maxTokens: 128000,
      supportsStreaming: true,
      supportsFunctions: true,
      supportsStructuredOutputs: true,
      costPer1kTokens: {
        input: 0.25,
        output: 2.0,
      },
    });

    this.models.set('gpt-5-nano', {
      id: 'gpt-5-nano',
      name: 'GPT-5 Nano',
      provider: 'openai',
      maxTokens: 128000,
      supportsStreaming: true,
      supportsFunctions: true,
      supportsStructuredOutputs: true,
      costPer1kTokens: {
        input: 0.05,
        output: 0.4,
      },
    });

    this.logger.log(
      `Modelos inicializados: ${this.models.size} modelos disponíveis`,
    );
  }

  /**
   * Obtém informações sobre um modelo
   */
  getModelInfo(modelId: string): ModelInfo | null {
    return this.models.get(modelId) || null;
  }

  /**
   * Obtém o modelo padrão
   */
  getDefaultModel(): string {
    return this.defaultModel;
  }

  /**
   * Verifica se o modelo suporta streaming
   */
  supportsStreaming(modelId: string): boolean {
    const model = this.models.get(modelId);
    return model?.supportsStreaming || false;
  }

  /**
   * Verifica se o modelo suporta function calling
   */
  supportsFunctions(modelId: string): boolean {
    const model = this.models.get(modelId);
    return model?.supportsFunctions || false;
  }

  /**
   * Verifica se o modelo suporta structured outputs
   */
  supportsStructuredOutputs(modelId: string): boolean {
    const model = this.models.get(modelId);
    return model?.supportsStructuredOutputs || false;
  }

  /**
   * Lista todos os modelos disponíveis
   */
  listModels(): ModelInfo[] {
    return Array.from(this.models.values());
  }

  /**
   * Lista modelos por provedor
   */
  listModelsByProvider(
    provider: 'openai' | 'anthropic' | 'other',
  ): ModelInfo[] {
    return Array.from(this.models.values()).filter(
      (m) => m.provider === provider,
    );
  }

  /**
   * Obtém o modelo recomendado para um tipo de agente
   */
  getRecommendedModel(agentType: 'simple' | 'complex' | 'multi-agent'): string {
    switch (agentType) {
      case 'simple':
        return 'gpt-4.1-mini';
      case 'complex':
        return 'gpt-5-mini';
      case 'multi-agent':
        return 'gpt-5-nano';
      default:
        return this.defaultModel;
    }
  }
}

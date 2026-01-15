import { Injectable } from '@nestjs/common';
import { ModelInfo } from './llm.types';

@Injectable()
export class ModelConfigService {
  private readonly models: Map<string, ModelInfo> = new Map();

  constructor() {
    this.initializeModels();
  }

  private initializeModels() {
    // Modelos OpenAI do sistema (conforme definido no frontend)
    // maxTokens = maximum completion tokens (output tokens)
    // Context window é maior, mas max_tokens limita apenas a saída

    // === GPT-4.1 Family ===
    // Context: 1,047,576 tokens | Max Output: 32,768 tokens
    this.models.set('gpt-4.1', {
      id: 'gpt-4.1',
      name: 'GPT-4.1',
      provider: 'openai',
      maxTokens: 32768, // Maximum completion tokens
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
      maxTokens: 32768, // Maximum completion tokens
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
      maxTokens: 32768, // Maximum completion tokens
      supportsStreaming: true,
      supportsFunctions: true,
      supportsStructuredOutputs: true,
      costPer1kTokens: {
        input: 0.1,
        output: 0.4,
      },
    });

    // === GPT-5 Family ===
    // Context: 400,000 tokens | Max Output: 128,000 tokens (GPT-5.1)
    // Assumindo valores similares para GPT-5.2 e variantes
    this.models.set('gpt-5.2', {
      id: 'gpt-5.2',
      name: 'GPT-5.2',
      provider: 'openai',
      maxTokens: 128000, // Maximum completion tokens
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
      maxTokens: 128000, // Maximum completion tokens
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
      maxTokens: 128000, // Maximum completion tokens (conservador)
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
      maxTokens: 128000, // Maximum completion tokens (conservador)
      supportsStreaming: true,
      supportsFunctions: true,
      supportsStructuredOutputs: true,
      costPer1kTokens: {
        input: 0.05,
        output: 0.4,
      },
    });

    // NOTA: gpt-5.2-nano não existe na API OpenAI
    // O modelo correto é gpt-5-nano (versão compacta do GPT-5)
  }

  /**
   * Obtém informações sobre um modelo
   */
  getModelInfo(modelId: string): ModelInfo | null {
    return this.models.get(modelId) || null;
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
}

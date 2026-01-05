import { Injectable, Logger } from '@nestjs/common';
import { ModelConfigService } from './model-config.service';
import { AgentStrategy } from '../agent/agent.types';

/**
 * Configuração padrão para um tipo de agente
 */
export interface AgentTypeConfig {
  defaultModel: string;
  defaultTemperature: number;
  defaultMaxTokens?: number;
  defaultStrategy: AgentStrategy;
  defaultInstructions?: string;
}

/**
 * Serviço de configuração de agentes
 */
@Injectable()
export class AgentConfigService {
  private readonly logger = new Logger(AgentConfigService.name);
  private readonly typeConfigs: Map<string, AgentTypeConfig> = new Map();

  constructor(private readonly modelConfig: ModelConfigService) {
    this.initializeTypeConfigs();
  }

  private initializeTypeConfigs() {
    // Configuração para agentes simples
    this.typeConfigs.set('simple', {
      defaultModel: this.modelConfig.getRecommendedModel('simple'),
      defaultTemperature: 0.7,
      defaultStrategy: 'simple',
      defaultInstructions: 'You are a helpful assistant.',
    });

    // Configuração para agentes RAG
    this.typeConfigs.set('rag', {
      defaultModel: this.modelConfig.getRecommendedModel('simple'),
      defaultTemperature: 0.7,
      defaultStrategy: 'manager',
      defaultInstructions:
        'You are a helpful assistant that answers questions using the knowledge base.',
    });

    // Configuração para agentes de workflow
    this.typeConfigs.set('workflow', {
      defaultModel: this.modelConfig.getRecommendedModel('simple'),
      defaultTemperature: 0.7,
      defaultStrategy: 'simple',
      defaultInstructions:
        'You are a workflow executor that processes tasks step by step.',
    });

    // Configuração para agentes multi-agente
    this.typeConfigs.set('multi-agent', {
      defaultModel: this.modelConfig.getRecommendedModel('multi-agent'),
      defaultTemperature: 0.7,
      defaultMaxTokens: 4096,
      defaultStrategy: 'manager',
      defaultInstructions:
        'You are a manager agent that orchestrates specialized agents.',
    });

    // Configuração para agentes de assistente
    this.typeConfigs.set('assistant', {
      defaultModel: this.modelConfig.getRecommendedModel('complex'),
      defaultTemperature: 0.7,
      defaultStrategy: 'manager',
      defaultInstructions:
        'You are an intelligent assistant that helps users with their tasks.',
    });

    this.logger.log(
      `Configurações de tipos de agente inicializadas: ${this.typeConfigs.size} tipos`,
    );
  }

  /**
   * Obtém configuração para um tipo de agente
   */
  getTypeConfig(type: string): AgentTypeConfig | null {
    return this.typeConfigs.get(type) || null;
  }

  /**
   * Obtém modelo padrão para um tipo de agente
   */
  getDefaultModelForType(type: string): string {
    const config = this.getTypeConfig(type);
    return config?.defaultModel || this.modelConfig.getDefaultModel();
  }

  /**
   * Obtém temperatura padrão para um tipo de agente
   */
  getDefaultTemperatureForType(type: string): number {
    const config = this.getTypeConfig(type);
    return config?.defaultTemperature || 0.7;
  }

  /**
   * Obtém estratégia padrão para um tipo de agente
   */
  getDefaultStrategyForType(type: string): AgentStrategy {
    const config = this.getTypeConfig(type);
    return config?.defaultStrategy || 'simple';
  }

  /**
   * Obtém instruções padrão para um tipo de agente
   */
  getDefaultInstructionsForType(type: string): string | undefined {
    const config = this.getTypeConfig(type);
    return config?.defaultInstructions;
  }

  /**
   * Registra uma nova configuração de tipo
   */
  registerTypeConfig(type: string, config: AgentTypeConfig): void {
    this.typeConfigs.set(type, config);
    this.logger.log(`Configuração de tipo registrada: ${type}`);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { Agent } from '@openai/agents';
import { CoreAgent, CoreAgentConfig } from './agent.types';
import { CoreContext } from '../context/context.types';
import { AgentConfigService } from '../config/agent-config.service';
import { ModelConfigService } from '../config/model-config.service';
import { ManagerStrategy } from './strategies/manager.strategy';
import { HandoffStrategy } from './strategies/handoff.strategy';
import { OrchestratorStrategy } from './strategies/orchestrator.strategy';
import { SimpleStrategy } from './strategies/simple.strategy';
import { AgentRegistry } from './agent.registry';

/**
 * Factory para criar agentes de forma padronizada
 */
@Injectable()
export class AgentFactory {
  private readonly logger = new Logger(AgentFactory.name);

  constructor(
    private readonly agentConfig: AgentConfigService,
    private readonly modelConfig: ModelConfigService,
    private readonly agentRegistry: AgentRegistry,
  ) {}

  /**
   * Cria um agente com configuração padronizada
   */
  async create<TContext extends CoreContext = CoreContext>(
    config: CoreAgentConfig<TContext>,
  ): Promise<CoreAgent<TContext>> {
    // Aplicar configurações padrão se não fornecidas
    const finalConfig = this.applyDefaults(config);

    // Resolver instruções dinâmicas se necessário
    const instructions = await this.resolveInstructions(finalConfig);

    // Criar agente usando a estratégia apropriada
    const strategy = finalConfig.strategy || 'simple';
    let agent: Agent<TContext>;

    switch (strategy) {
      case 'manager':
        agent = ManagerStrategy.apply(finalConfig);
        break;
      case 'handoff':
        agent = HandoffStrategy.apply(finalConfig);
        break;
      case 'orchestrator':
        agent = OrchestratorStrategy.apply(finalConfig);
        break;
      case 'simple':
      default:
        agent = SimpleStrategy.apply(finalConfig);
        break;
    }

    // Adicionar metadados ao agente
    const coreAgent = agent as CoreAgent<TContext>;
    coreAgent.strategy = strategy;
    coreAgent.category = finalConfig.category;
    coreAgent.tags = finalConfig.tags;

    // Registrar agente se configurado
    if (finalConfig.category || finalConfig.tags) {
      this.agentRegistry.register(coreAgent);
    }

    this.logger.log(`Agente criado: ${finalConfig.name} (estratégia: ${strategy})`);

    return coreAgent;
  }

  /**
   * Aplica configurações padrão baseadas no tipo de agente
   */
  private applyDefaults<TContext extends CoreContext>(
    config: CoreAgentConfig<TContext>,
  ): CoreAgentConfig<TContext> {
    const type = config.category || 'simple';
    const typeConfig = this.agentConfig.getTypeConfig(type);

    return {
      ...config,
      model: config.model || typeConfig?.defaultModel || this.modelConfig.getDefaultModel(),
      strategy: config.strategy || typeConfig?.defaultStrategy || 'simple',
      modelSettings: {
        temperature: config.modelSettings?.temperature ?? typeConfig?.defaultTemperature ?? 0.7,
        maxTokens: config.modelSettings?.maxTokens ?? typeConfig?.defaultMaxTokens,
        parallelToolCalls: config.modelSettings?.parallelToolCalls ?? (config.strategy === 'manager' || config.strategy === 'orchestrator'),
        toolChoice: config.modelSettings?.toolChoice,
      },
      instructions: config.instructions || typeConfig?.defaultInstructions || 'You are a helpful assistant.',
    };
  }

  /**
   * Resolve instruções dinâmicas (funções) para strings
   */
  private async resolveInstructions<TContext extends CoreContext>(
    config: CoreAgentConfig<TContext>,
  ): Promise<string> {
    if (typeof config.instructions === 'string') {
      return config.instructions;
    }

    // Se for função, precisa ser resolvida no momento da execução
    // Por enquanto, retornamos uma string placeholder
    // A resolução real será feita pelo Agent do SDK
    return typeof config.instructions === 'function'
      ? 'You are a helpful assistant.' // Placeholder
      : config.instructions;
  }
}

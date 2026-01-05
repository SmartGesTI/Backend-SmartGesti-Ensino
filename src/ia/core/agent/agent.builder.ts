import { Injectable } from '@nestjs/common';
import { CoreAgent, CoreAgentConfig } from './agent.types';
import { CoreContext } from '../context/context.types';
import { CoreTool } from '../tool/tool.types';
import { InputGuardrail, OutputGuardrail } from '@openai/agents-core';
import { AgentFactory } from './agent.factory';

/**
 * Builder para construção fluente de agentes
 */
@Injectable()
export class AgentBuilder<TContext extends CoreContext = CoreContext> {
  private config: Partial<CoreAgentConfig<TContext>> = {};

  constructor(private readonly agentFactory: AgentFactory) {}

  /**
   * Define o nome do agente
   */
  withName(name: string): this {
    this.config.name = name;
    return this;
  }

  /**
   * Define as instruções do agente
   */
  withInstructions(
    instructions: string | ((context: any) => string | Promise<string>),
  ): this {
    this.config.instructions = instructions;
    return this;
  }

  /**
   * Define o modelo a ser usado
   */
  withModel(model: string): this {
    this.config.model = model;
    return this;
  }

  /**
   * Define a estratégia do agente
   */
  withStrategy(strategy: 'manager' | 'handoff' | 'orchestrator' | 'simple'): this {
    this.config.strategy = strategy;
    return this;
  }

  /**
   * Adiciona uma tool
   */
  withTool(tool: CoreTool<TContext>): this {
    if (!this.config.tools) {
      this.config.tools = [];
    }
    this.config.tools.push(tool);
    return this;
  }

  /**
   * Adiciona múltiplas tools
   */
  withTools(tools: CoreTool<TContext>[]): this {
    if (!this.config.tools) {
      this.config.tools = [];
    }
    this.config.tools.push(...tools);
    return this;
  }

  /**
   * Adiciona um handoff (agente especialista)
   */
  withHandoff(agent: CoreAgent<TContext>): this {
    if (!this.config.handoffs) {
      this.config.handoffs = [];
    }
    this.config.handoffs.push(agent);
    return this;
  }

  /**
   * Adiciona múltiplos handoffs
   */
  withHandoffs(agents: CoreAgent<TContext>[]): this {
    if (!this.config.handoffs) {
      this.config.handoffs = [];
    }
    this.config.handoffs.push(...agents);
    return this;
  }

  /**
   * Adiciona input guardrails
   */
  withInputGuardrails(guardrails: InputGuardrail[]): this {
    if (!this.config.guardrails) {
      this.config.guardrails = {};
    }
    this.config.guardrails.input = guardrails;
    return this;
  }

  /**
   * Adiciona output guardrails
   */
  withOutputGuardrails(guardrails: OutputGuardrail<'text'>[]): this {
    if (!this.config.guardrails) {
      this.config.guardrails = {};
    }
    this.config.guardrails.output = guardrails;
    return this;
  }

  /**
   * Define a categoria do agente
   */
  withCategory(category: string): this {
    this.config.category = category;
    return this;
  }

  /**
   * Adiciona tags
   */
  withTags(tags: string[]): this {
    this.config.tags = tags;
    return this;
  }

  /**
   * Define configurações do modelo
   */
  withModelSettings(settings: {
    temperature?: number;
    maxTokens?: number;
    parallelToolCalls?: boolean;
    toolChoice?: 'auto' | 'required' | 'none' | string;
  }): this {
    this.config.modelSettings = settings;
    return this;
  }

  /**
   * Constrói e retorna o agente
   */
  async build(): Promise<CoreAgent<TContext>> {
    if (!this.config.name) {
      throw new Error('Nome do agente é obrigatório');
    }

    if (!this.config.instructions) {
      throw new Error('Instruções do agente são obrigatórias');
    }

    return await this.agentFactory.create(this.config as CoreAgentConfig<TContext>);
  }

  /**
   * Reseta o builder para criar um novo agente
   */
  reset(): this {
    this.config = {};
    return this;
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { AgentConfig } from './agent.interface';
import { BaseAgent } from './base.agent';
import { AgentFactory } from './agent.factory';

@Injectable()
export class AgentRegistry {
  private readonly logger = new Logger(AgentRegistry.name);
  private readonly agents: Map<string, BaseAgent> = new Map();

  constructor(private readonly agentFactory: AgentFactory) {}

  /**
   * Registra um agente
   */
  register(config: AgentConfig): void {
    if (this.agents.has(config.name)) {
      this.logger.warn(`Agent ${config.name} already registered, overwriting`);
    }

    const agent = this.agentFactory.createAgent(config);
    this.agents.set(config.name, agent);
    this.logger.debug(`Registered agent: ${config.name}`);
  }

  /**
   * Obtém um agente registrado
   */
  get(name: string): BaseAgent | undefined {
    return this.agents.get(name);
  }

  /**
   * Obtém todos os agentes registrados
   */
  getAll(): BaseAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Remove um agente
   */
  unregister(name: string): void {
    this.agents.delete(name);
    this.logger.debug(`Unregistered agent: ${name}`);
  }

  /**
   * Lista todos os agentes registrados
   */
  list(): string[] {
    return Array.from(this.agents.keys());
  }

  /**
   * Verifica se um agente está registrado
   */
  has(name: string): boolean {
    return this.agents.has(name);
  }
}

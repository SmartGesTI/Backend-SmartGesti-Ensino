import { Injectable, Logger } from '@nestjs/common';
import { CoreAgent, AgentMetadata } from './agent.types';
import { CoreContext } from '../context/context.types';

/**
 * Registry para registro e descoberta de agentes
 */
@Injectable()
export class AgentRegistry {
  private readonly logger = new Logger(AgentRegistry.name);
  private readonly agents: Map<string, CoreAgent> = new Map();
  private readonly metadata: Map<string, AgentMetadata> = new Map();

  /**
   * Registra um agente
   */
  register<TContext extends CoreContext = CoreContext>(
    agent: CoreAgent<TContext>,
  ): void {
    if (this.agents.has(agent.name)) {
      this.logger.warn(
        `Agente ${agent.name} já está registrado. Substituindo...`,
      );
    }

    this.agents.set(agent.name, agent as CoreAgent);
    this.metadata.set(agent.name, {
      name: agent.name,
      strategy: agent.strategy,
      category: agent.category,
      tags: agent.tags,
      registeredAt: new Date(),
      toolsCount: 0, // Será atualizado se necessário
      handoffsCount: 0, // Será atualizado se necessário
    });

    this.logger.log(`Agente registrado: ${agent.name}`);
  }

  /**
   * Obtém um agente por nome
   */
  get(name: string): CoreAgent | null {
    return this.agents.get(name) || null;
  }

  /**
   * Verifica se um agente está registrado
   */
  has(name: string): boolean {
    return this.agents.has(name);
  }

  /**
   * Lista todos os agentes registrados
   */
  list(): CoreAgent[] {
    return Array.from(this.agents.values());
  }

  /**
   * Busca agentes por categoria
   */
  findByCategory(category: string): CoreAgent[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.category === category,
    );
  }

  /**
   * Busca agentes por tag
   */
  findByTag(tag: string): CoreAgent[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.tags?.includes(tag),
    );
  }

  /**
   * Busca agentes por estratégia
   */
  findByStrategy(strategy: string): CoreAgent[] {
    return Array.from(this.agents.values()).filter(
      (agent) => agent.strategy === strategy,
    );
  }

  /**
   * Obtém metadados de um agente
   */
  getMetadata(name: string): AgentMetadata | null {
    return this.metadata.get(name) || null;
  }

  /**
   * Remove um agente do registro
   */
  unregister(name: string): boolean {
    const removed = this.agents.delete(name);
    this.metadata.delete(name);
    if (removed) {
      this.logger.log(`Agente removido do registro: ${name}`);
    }
    return removed;
  }

  /**
   * Limpa todos os agentes registrados
   */
  clear(): void {
    this.agents.clear();
    this.metadata.clear();
    this.logger.log('Todos os agentes foram removidos do registro');
  }

  /**
   * Obtém contagem de agentes registrados
   */
  count(): number {
    return this.agents.size;
  }
}

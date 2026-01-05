import { Injectable, Logger } from '@nestjs/common';
import { CoreTool, ToolMetadata } from './tool.types';

/**
 * Registry para registro centralizado de tools
 */
@Injectable()
export class ToolRegistry {
  private readonly logger = new Logger(ToolRegistry.name);
  private readonly tools: Map<string, CoreTool> = new Map();
  private readonly metadata: Map<string, ToolMetadata> = new Map();

  /**
   * Registra uma tool
   */
  register(tool: CoreTool): void {
    if (this.tools.has(tool.name)) {
      this.logger.warn(`Tool ${tool.name} já está registrada. Substituindo...`);
    }

    this.tools.set(tool.name, tool);
    this.metadata.set(tool.name, {
      name: tool.name,
      description: tool.description,
      category: tool.category,
      tags: tool.tags,
      version: tool.version,
      registeredAt: new Date(),
    });

    this.logger.log(`Tool registrada: ${tool.name}`);
  }

  /**
   * Registra múltiplas tools
   */
  registerMany(tools: CoreTool[]): void {
    tools.forEach((tool) => this.register(tool));
  }

  /**
   * Obtém uma tool por nome
   */
  get(name: string): CoreTool | null {
    return this.tools.get(name) || null;
  }

  /**
   * Verifica se uma tool está registrada
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Lista todas as tools registradas
   */
  list(): CoreTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Busca tools por categoria
   */
  findByCategory(category: string): CoreTool[] {
    return Array.from(this.tools.values()).filter(
      (tool) => tool.category === category,
    );
  }

  /**
   * Busca tools por tag
   */
  findByTag(tag: string): CoreTool[] {
    return Array.from(this.tools.values()).filter((tool) =>
      tool.tags?.includes(tag),
    );
  }

  /**
   * Obtém metadados de uma tool
   */
  getMetadata(name: string): ToolMetadata | null {
    return this.metadata.get(name) || null;
  }

  /**
   * Remove uma tool do registro
   */
  unregister(name: string): boolean {
    const removed = this.tools.delete(name);
    this.metadata.delete(name);
    if (removed) {
      this.logger.log(`Tool removida do registro: ${name}`);
    }
    return removed;
  }

  /**
   * Limpa todas as tools registradas
   */
  clear(): void {
    this.tools.clear();
    this.metadata.clear();
    this.logger.log('Todas as tools foram removidas do registro');
  }

  /**
   * Obtém contagem de tools registradas
   */
  count(): number {
    return this.tools.size;
  }

  /**
   * Obtém nomes de todas as tools
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}

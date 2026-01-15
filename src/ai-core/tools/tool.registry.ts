import { Injectable, Logger } from '@nestjs/common';
import { Tool } from '@ai-sdk/provider-utils';
import { ToolDefinition } from './tool.interface';
import { ToolFactory } from './tool.factory';

@Injectable()
export class ToolRegistry {
  private readonly logger = new Logger(ToolRegistry.name);
  private readonly tools: Map<string, ToolDefinition> = new Map();
  private readonly toolInstances: Map<string, Tool> = new Map();

  constructor(private readonly toolFactory: ToolFactory) {}

  /**
   * Registra uma tool
   */
  register(definition: ToolDefinition): void {
    if (this.tools.has(definition.name)) {
      this.logger.warn(
        `Tool ${definition.name} already registered, overwriting`,
      );
    }

    this.tools.set(definition.name, definition);
    this.toolInstances.set(
      definition.name,
      this.toolFactory.createTool(definition),
    );
    this.logger.debug(`Registered tool: ${definition.name}`);
  }

  /**
   * Registra múltiplas tools
   */
  registerMany(definitions: ToolDefinition[]): void {
    definitions.forEach((def) => this.register(def));
  }

  /**
   * Obtém uma tool registrada
   */
  get(name: string): Tool | undefined {
    return this.toolInstances.get(name);
  }

  /**
   * Obtém todas as tools registradas como objeto (ToolSet)
   */
  getAll(): Record<string, Tool> {
    const tools: Record<string, Tool> = {};
    this.toolInstances.forEach((tool, name) => {
      tools[name] = tool;
    });
    return tools;
  }

  /**
   * Obtém tools por categoria (se implementado)
   */
  getByCategory(category: string): Record<string, Tool> {
    // Por enquanto retorna todas, pode ser estendido
    return this.getAll();
  }

  /**
   * Remove uma tool
   */
  unregister(name: string): void {
    this.tools.delete(name);
    this.toolInstances.delete(name);
    this.logger.debug(`Unregistered tool: ${name}`);
  }

  /**
   * Lista todas as tools registradas
   */
  list(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Verifica se uma tool está registrada
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }
}

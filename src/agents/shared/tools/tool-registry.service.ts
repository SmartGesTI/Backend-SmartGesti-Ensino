import { Injectable } from '@nestjs/common';
import { Tool, ToolContext } from './tool.interface';
import { LLMTool } from '../llm/llm.types';
import { LoggerService } from '../../../common/logger/logger.service';

@Injectable()
export class ToolRegistryService {
  private readonly tools: Map<string, Tool> = new Map();
  private readonly logger = new LoggerService();

  /**
   * Registra uma tool
   */
  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      this.logger.warn(`Tool ${tool.name} já está registrada. Substituindo...`, 'ToolRegistryService');
    }
    this.tools.set(tool.name, tool);
    this.logger.log(`Tool registrada: ${tool.name}`, 'ToolRegistryService');
  }

  /**
   * Registra múltiplas tools
   */
  registerMany(tools: Tool[]): void {
    tools.forEach((tool) => this.register(tool));
  }

  /**
   * Remove uma tool
   */
  unregister(name: string): void {
    this.tools.delete(name);
  }

  /**
   * Obtém uma tool por nome
   */
  getTool(name: string): Tool | null {
    return this.tools.get(name) || null;
  }

  /**
   * Lista todas as tools registradas
   */
  listTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Converte tools para formato LLM (OpenAI function calling)
   */
  getToolsForLLM(): LLMTool[] {
    return Array.from(this.tools.values()).map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Verifica se uma tool está registrada
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Obtém nomes de todas as tools
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }
}

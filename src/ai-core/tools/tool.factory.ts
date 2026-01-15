import { Injectable, Logger } from '@nestjs/common';
import { tool } from 'ai';
import { z } from 'zod';
import { ToolDefinition, ToolContext } from './tool.interface';
import { Tool } from '@ai-sdk/provider-utils';

@Injectable()
export class ToolFactory {
  private readonly logger = new Logger(ToolFactory.name);

  /**
   * Cria uma tool do AI SDK a partir de uma definição
   */
  createTool(definition: ToolDefinition): Tool {
    this.logger.debug(`Creating tool: ${definition.name}`);

    return tool({
      description: definition.description,
      inputSchema: definition.parameters,
      execute: async (args: any) => {
        try {
          // Validar argumentos
          const validatedArgs = definition.parameters.parse(args);

          // Criar contexto básico (pode ser estendido)
          const context: ToolContext = {};

          // Executar tool
          const result = await definition.execute(validatedArgs, context);

          return result;
        } catch (error) {
          this.logger.error(
            `Error executing tool ${definition.name}: ${error.message}`,
            error.stack,
          );
          throw error;
        }
      },
    });
  }

  /**
   * Cria múltiplas tools de uma vez e retorna como objeto (ToolSet)
   */
  createTools(definitions: ToolDefinition[]): Record<string, Tool> {
    const tools: Record<string, Tool> = {};
    definitions.forEach((def) => {
      tools[def.name] = this.createTool(def);
    });
    return tools;
  }
}

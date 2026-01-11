import { z } from 'zod';
import { ITool, ToolContext } from './tool.interface';

export abstract class BaseTool implements ITool {
  abstract name: string;
  abstract description: string;
  abstract parameters: z.ZodSchema;

  abstract execute(args: any, context?: ToolContext): Promise<any>;

  /**
   * Valida argumentos usando o schema Zod
   */
  protected validateArgs(args: any): any {
    return this.parameters.parse(args);
  }

  /**
   * Tratamento de erros padronizado
   */
  protected handleError(error: Error, context?: ToolContext): never {
    throw new Error(`Tool ${this.name} error: ${error.message}`);
  }
}

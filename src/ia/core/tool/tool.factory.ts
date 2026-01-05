import { Injectable, Logger } from '@nestjs/common';
import { tool } from '@openai/agents';
import { CoreTool, CoreToolConfig } from './tool.types';
import { CoreContext } from '../context/context.types';
import { ToolRegistry } from './tool.registry';

/**
 * Factory para criar tools padronizadas
 */
@Injectable()
export class ToolFactory {
  private readonly logger = new Logger(ToolFactory.name);

  constructor(private readonly toolRegistry: ToolRegistry) {}

  /**
   * Cria uma tool a partir de uma configuração
   */
  create<TContext extends CoreContext = CoreContext>(
    config: CoreToolConfig<TContext>,
  ): CoreTool<TContext> {
    // Validar configuração
    this.validateConfig(config);

    // Criar tool do SDK
    const sdkTool = tool({
      name: config.name,
      description: config.description,
      parameters: config.parameters as any,
      execute: async (params, runContext) => {
        return await config.execute(params, runContext as any);
      },
    });

    // Criar tool do core
    const coreTool: CoreTool<TContext> = {
      name: config.name,
      description: config.description,
      parameters: config.parameters,
      execute: config.execute,
      category: config.category,
      tags: config.tags,
      version: config.version,
    };

    // Registrar tool se tiver categoria ou tags
    if (config.category || config.tags) {
      this.toolRegistry.register(coreTool);
    }

    this.logger.log(`Tool criada: ${config.name}`);

    return coreTool;
  }

  /**
   * Cria uma tool a partir de uma função TypeScript
   */
  createFromFunction<TContext extends CoreContext = CoreContext>(
    name: string,
    description: string,
    parameters: any,
    fn: (params: any, context: any) => Promise<any>,
    options?: {
      category?: string;
      tags?: string[];
      version?: string;
    },
  ): CoreTool<TContext> {
    return this.create({
      name,
      description,
      parameters,
      execute: fn,
      category: options?.category,
      tags: options?.tags,
      version: options?.version,
    });
  }

  /**
   * Valida configuração de tool
   */
  private validateConfig<TContext extends CoreContext>(
    config: CoreToolConfig<TContext>,
  ): void {
    if (!config.name || config.name.trim().length === 0) {
      throw new Error('Nome da tool é obrigatório');
    }

    if (!config.description || config.description.trim().length === 0) {
      throw new Error('Descrição da tool é obrigatória');
    }

    if (!config.parameters) {
      throw new Error('Parâmetros da tool são obrigatórios');
    }

    if (!config.execute || typeof config.execute !== 'function') {
      throw new Error('Função execute da tool é obrigatória');
    }
  }
}

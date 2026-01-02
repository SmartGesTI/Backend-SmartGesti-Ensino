import { Injectable } from '@nestjs/common';
import { ToolRegistryService } from './tool-registry.service';
import { ToolContext, ToolExecutionResult } from './tool.interface';
import { LoggerService } from '../../../common/logger/logger.service';

@Injectable()
export class ToolExecutorService {
  constructor(
    private readonly toolRegistry: ToolRegistryService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Executa uma tool com validação e tratamento de erros
   */
  async executeTool(
    name: string,
    params: any,
    context: ToolContext,
  ): Promise<ToolExecutionResult> {
    const tool = this.toolRegistry.getTool(name);

    if (!tool) {
      return {
        success: false,
        error: `Tool ${name} não encontrada`,
      };
    }

    try {
      // Validar parâmetros básicos
      if (!this.validateBasicParams(params, tool.parameters)) {
        return {
          success: false,
          error: `Parâmetros inválidos para tool ${name}`,
        };
      }

      this.logger.log(`Executando tool: ${name}`, 'ToolExecutorService', {
        params,
        userId: context.userId,
      });

      // Executar tool
      const result = await tool.execute(params, context);

      this.logger.log(`Tool ${name} executada com sucesso`, 'ToolExecutorService');

      return {
        success: true,
        data: result,
      };
    } catch (error: any) {
      this.logger.error(`Erro ao executar tool ${name}: ${error.message}`, 'ToolExecutorService');
      return {
        success: false,
        error: error.message || 'Erro desconhecido ao executar tool',
      };
    }
  }

  /**
   * Executa múltiplas tools em paralelo
   */
  async executeTools(
    toolCalls: Array<{ name: string; arguments: any }>,
    context: ToolContext,
  ): Promise<Map<string, ToolExecutionResult>> {
    const results = new Map<string, ToolExecutionResult>();

    await Promise.all(
      toolCalls.map(async (toolCall) => {
        try {
          // Parsear arguments se for string
          let params: any = {};
          if (toolCall.arguments) {
            if (typeof toolCall.arguments === 'string') {
              try {
                // Tentar parsear como JSON
                const parsed = JSON.parse(toolCall.arguments);
                params = parsed;
                this.logger.log(`Arguments parseados para ${toolCall.name}:`, 'ToolExecutorService', { parsed });
              } catch (parseError: any) {
                this.logger.warn(`Erro ao parsear arguments da tool ${toolCall.name}: ${parseError.message}. Arguments raw: ${toolCall.arguments}`, 'ToolExecutorService');
                // Se falhar o parse, tentar usar como objeto vazio e deixar a tool lidar
                params = {};
              }
            } else if (typeof toolCall.arguments === 'object') {
              params = toolCall.arguments;
            } else {
              this.logger.warn(`Arguments com tipo inesperado para ${toolCall.name}: ${typeof toolCall.arguments}`, 'ToolExecutorService');
              params = {};
            }
          } else {
            this.logger.warn(`Tool ${toolCall.name} chamada sem arguments!`, 'ToolExecutorService');
          }
          
          this.logger.log(`Executando tool ${toolCall.name} com params:`, 'ToolExecutorService', { params, paramsKeys: Object.keys(params) });
          const result = await this.executeTool(toolCall.name, params, context);
          this.logger.log(`Resultado da tool ${toolCall.name}:`, 'ToolExecutorService', { success: result.success });
          results.set(toolCall.name, result);
        } catch (error: any) {
          this.logger.error(`Erro ao executar tool ${toolCall.name}: ${error.message}`, error.stack, 'ToolExecutorService');
          results.set(toolCall.name, {
            success: false,
            error: error.message || 'Erro desconhecido',
          });
        }
      }),
    );

    return results;
  }

  /**
   * Validação básica de parâmetros (validação completa seria com biblioteca de JSON Schema)
   */
  private validateBasicParams(params: any, schema: Record<string, any>): boolean {
    if (!schema.properties) {
      return true; // Sem validação se não houver schema
    }

    const required = schema.required || [];
    
    // Verificar campos obrigatórios
    for (const field of required) {
      if (params[field] === undefined || params[field] === null) {
        return false;
      }
    }

    return true;
  }

  /**
   * Verifica se o usuário tem permissão para executar uma tool
   * (pode ser sobrescrito por tools específicas)
   */
  async checkPermissions(toolName: string, context: ToolContext): Promise<boolean> {
    // Por padrão, permite se o usuário está autenticado
    // Tools específicas podem implementar validações adicionais
    return !!context.userId && !!context.tenantId;
  }
}

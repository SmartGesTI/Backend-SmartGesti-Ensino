import { Injectable } from '@nestjs/common';
import { ToolExecutorService } from '../../shared/tools/tool-executor.service';
import { ToolContext, ToolExecutionResult } from '../../shared/tools/tool.interface';
import { LLMService } from '../../shared/llm/llm.service';
import { LLMMessage } from '../../shared/llm/llm.types';
import { LoggerService } from '../../../common/logger/logger.service';
import { UserContext } from './message-processor.service';

/**
 * Resultado da execução de uma tool com links extraídos
 */
export interface ToolExecutionWithLinks {
  toolName: string;
  success: boolean;
  data?: any;
  error?: string;
  links: Array<{ label: string; url: string; type: 'navigation' | 'external' }>;
}

/**
 * Resultado completo da orquestração de tools
 */
export interface ToolOrchestrationResult {
  toolMessages: LLMMessage[];
  results: Map<string, ToolExecutionResult>;
  links: Array<{ label: string; url: string; type: 'navigation' | 'external' }>;
  toolsUsed: string[];
}

/**
 * ToolOrchestratorService
 * 
 * Responsável por orquestrar a execução de tools, incluindo:
 * - Execução paralela de tools
 * - Extração de links das respostas
 * - Criação de mensagens de tool para o LLM
 */
@Injectable()
export class ToolOrchestratorService {
  constructor(
    private readonly toolExecutor: ToolExecutorService,
    private readonly llmService: LLMService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Converte UserContext para ToolContext
   */
  private createToolContext(userContext: UserContext): ToolContext {
    return {
      userId: userContext.userId,
      tenantId: userContext.tenantId,
      schoolId: userContext.schoolId,
      supabaseId: userContext.supabaseId,
      schoolSlug: userContext.schoolSlug,
      tenantSubdomain: userContext.tenantSubdomain,
      requestOrigin: userContext.requestOrigin,
    };
  }

  /**
   * Extrai links de uma resposta de tool
   */
  private extractLinksFromResult(
    toolName: string,
    data: any,
  ): Array<{ label: string; url: string; type: 'navigation' | 'external' }> {
    const links: Array<{ label: string; url: string; type: 'navigation' | 'external' }> = [];

    if (!data) return links;

    // Extrair links de get_route
    if (toolName === 'get_route' && data.route) {
      links.push({
        label: `Abrir ${data.pageName || 'página'}`,
        url: data.fullUrl || data.route,
        type: 'navigation',
      });
    }

    // Extrair links de get_sitemap_info
    if (toolName === 'get_sitemap_info') {
      // BestMatch (busca por query)
      if (data.bestMatch?.page?.route) {
        links.push({
          label: `Abrir ${data.bestMatch.page.name}`,
          url: data.bestMatch.page.route,
          type: 'navigation',
        });
      }
      // Page (busca por pageId)
      else if (data.page?.route) {
        links.push({
          label: `Abrir ${data.page.name}`,
          url: data.page.route,
          type: 'navigation',
        });
      }

      // Páginas relacionadas
      if (data.relatedPages) {
        for (const relatedPage of data.relatedPages) {
          if (relatedPage.route) {
            links.push({
              label: `Abrir ${relatedPage.name}`,
              url: relatedPage.route,
              type: 'navigation',
            });
          }
        }
      }
    }

    return links;
  }

  /**
   * Executa múltiplas tool calls e retorna os resultados formatados
   */
  async executeToolCalls(
    toolCalls: Array<{ id: string; name: string; arguments: string }>,
    userContext: UserContext,
    requestId?: string,
  ): Promise<ToolOrchestrationResult> {
    const reqId = requestId || `tool-${Date.now()}`;
    this.logger.log(
      `[${reqId}] Iniciando execução de ${toolCalls.length} tools`,
      'ToolOrchestratorService',
    );

    const toolContext = this.createToolContext(userContext);
    const toolMessages: LLMMessage[] = [];
    const allLinks: Array<{ label: string; url: string; type: 'navigation' | 'external' }> = [];
    const toolsUsed: string[] = [];

    // Executar todas as tools
    const results = await this.toolExecutor.executeTools(
      toolCalls.map((tc) => ({
        name: tc.name,
        arguments: tc.arguments,
      })),
      toolContext,
    );

    // Processar resultados
    for (const toolCall of toolCalls) {
      const result = results.get(toolCall.name);
      toolsUsed.push(toolCall.name);

      if (result?.success) {
        // Criar mensagem de tool com resultado
        toolMessages.push(
          this.llmService.createToolMessage(
            toolCall.id,
            JSON.stringify(result.data),
            toolCall.name,
          ),
        );

        // Extrair links
        const links = this.extractLinksFromResult(toolCall.name, result.data);
        allLinks.push(...links);

        this.logger.log(
          `[${reqId}] Tool ${toolCall.name} executada com sucesso`,
          'ToolOrchestratorService',
        );
      } else {
        // Criar mensagem de erro para o LLM
        this.logger.warn(
          `[${reqId}] Tool ${toolCall.name} falhou: ${result?.error}`,
          'ToolOrchestratorService',
        );

        toolMessages.push(
          this.llmService.createToolMessage(
            toolCall.id,
            JSON.stringify({
              error: result?.error || 'Erro ao executar tool',
              message: 'Não foi possível obter informações através desta ferramenta.',
            }),
            toolCall.name,
          ),
        );
      }
    }

    this.logger.log(
      `[${reqId}] Tools executadas: ${toolsUsed.join(', ')}. Links extraídos: ${allLinks.length}`,
      'ToolOrchestratorService',
    );

    return {
      toolMessages,
      results,
      links: allLinks,
      toolsUsed,
    };
  }
}

import { Injectable } from '@nestjs/common';
import { LLMService } from '../../shared/llm/llm.service';
import { LLMMessage, LLMTool, ReasoningEffort } from '../../shared/llm/llm.types';
import { ToolRegistryService } from '../../shared/tools/tool-registry.service';
import { ConversationService } from '../conversation/conversation.service';
import { LoggerService } from '../../../common/logger/logger.service';

/**
 * Contexto do usuário para processamento de mensagens
 */
export interface UserContext {
  userId: string;
  tenantId: string;
  schoolId?: string;
  supabaseId: string;
  schoolSlug?: string;
  tenantSubdomain?: string;
  requestOrigin?: string;
}

/**
 * Opções de processamento de mensagem
 */
export interface ProcessingOptions {
  reasoningEffort?: ReasoningEffort;
  showReasoning?: boolean;
  model?: string;
}

/**
 * Resultado da preparação de mensagens
 */
export interface PreparedMessages {
  messages: LLMMessage[];
  tools: LLMTool[];
  requiresTools: boolean;
  isFirstMessage: boolean;
  history: LLMMessage[];
}

/**
 * MessageProcessorService
 * 
 * Responsável por preparar mensagens para o LLM, incluindo:
 * - Criação do system prompt
 * - Carregamento do histórico
 * - Detecção de necessidade de tools
 * - Formatação das mensagens
 */
@Injectable()
export class MessageProcessorService {
  constructor(
    private readonly llmService: LLMService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly conversationService: ConversationService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * System prompt do assistente
   */
  getSystemPrompt(isFirstMessage: boolean): string {
    return `Você é o Assistente Virtual do SmartGesti, um sistema de gestão escolar.

# Objetivo
Auxilie usuários com dúvidas sobre o SmartGesti, explicando funcionalidades, navegação, uso de páginas, consultas de dados e APIs disponíveis.

# ⚠️ REGRA ABSOLUTA - PROIBIÇÃO DE INVENTAR INFORMAÇÕES ⚠️

**VOCÊ ESTÁ PROIBIDO DE:**
- Inventar ou supor informações sobre funcionalidades, menus, rotas ou páginas do sistema
- Fornecer respostas genéricas ou hipotéticas
- Listar opções que você não tem certeza se existem
- Criar links ou rotas que você não verificou usando as ferramentas

**VOCÊ DEVE SEMPRE:**
- **PREFERIR FERRAMENTAS SOBRE CONHECIMENTO INTERNO**: Use ferramentas sempre que precisar de dados específicos do sistema
- Para QUALQUER pergunta sobre navegação, localização, funcionalidades ou "onde encontrar" → USE \`get_sitemap_info\` PRIMEIRO
- Responder APENAS com informações obtidas das ferramentas
- Se a ferramenta não encontrar resultados, tente termos alternativos antes de dizer que não encontrou

**PALAVRAS-CHAVE QUE EXIGEM USO OBRIGATÓRIO DE \`get_sitemap_info\`:**
"onde", "como acessar", "como ver", "como criar", "quais são", "listar", "existe", "adicionar", "criar", "ver", "encontrar", "menu", "página", "rota", "funcionalidade", "escolas", "dashboards", "relatórios", "agentes"

# Suas Funções
- Responda perguntas sobre o sistema
- Explique como utilizar funcionalidades e páginas
- Forneça links completos ao citar páginas
- Consulte o banco de dados quando necessário usando a ferramenta \`query_database\`
- Ajude na navegação pelo sistema
- Explique as APIs e endpoints disponíveis

${isFirstMessage ? 'IMPORTANTE: Esta é a PRIMEIRA mensagem da conversa. Você DEVE retornar um título curto e descritivo (máximo 40 caracteres) para esta conversa no campo "conversation_title" da sua resposta.' : ''}

# Ferramentas Disponíveis

1. **get_sitemap_info:** Busca informações sobre páginas do sistema. Use para perguntas sobre localização, navegação ou "onde encontrar".
2. **search_knowledge:** Pesquisa informações sobre documentação, APIs ou funcionalidades.
3. **query_database:** Consulta dados específicos quando solicitado.
4. **get_route:** Obtém o link completo de uma página quando já tiver o ID dela.

# Regras Importantes

- **PROIBIÇÃO TOTAL**: NUNCA invente informações. SEMPRE use as ferramentas primeiro.
- Use o campo \`route\` retornado pela ferramenta para fornecer links completos.
- Seja claro e objetivo nas respostas.
- Use Markdown para formatação.
- Inclua links clicáveis quando relevante.
- Use listas para estruturar as informações.
${isFirstMessage ? '- Se esta for a primeira mensagem, inclua um campo "conversation_title" com um título curto (máximo 40 caracteres) para a conversa' : ''}`;
  }

  /**
   * Detecta se a mensagem requer uso obrigatório de tools
   */
  detectToolRequirement(message: string): boolean {
    const toolTriggerPattern = /(onde|como (ver|acessar|criar|encontrar|listar|adicionar)|quais são|existe|adicionar|criar|ver|encontrar|listar|dashboards?|relatórios?|menu|página|rota|funcionalidade|escolas?|agentes?)/i;
    return toolTriggerPattern.test(message);
  }

  /**
   * Prepara todas as mensagens para enviar ao LLM
   */
  async prepareMessages(
    userMessage: string,
    conversationId: string | null,
    context: UserContext,
    options?: ProcessingOptions,
  ): Promise<PreparedMessages> {
    // Verificar se é primeira mensagem
    const isFirstMessage = !conversationId || (typeof conversationId === 'string' && conversationId.trim() === '');
    
    // Carregar histórico se existir conversa
    let history: LLMMessage[] = [];
    if (conversationId && !isFirstMessage) {
      try {
        history = await this.conversationService.getHistory(conversationId);
        this.logger.log(
          `Histórico carregado: ${history.length} mensagens`,
          'MessageProcessorService',
        );
      } catch (error: any) {
        this.logger.warn(
          `Erro ao carregar histórico: ${error.message}`,
          'MessageProcessorService',
        );
      }
    }

    // Preparar mensagens
    const messages: LLMMessage[] = [
      this.llmService.createSystemMessage(this.getSystemPrompt(isFirstMessage)),
      ...history,
      this.llmService.createUserMessage(userMessage),
    ];

    // Obter tools disponíveis
    const tools = this.toolRegistry.getToolsForLLM();

    // Detectar se precisa de tools
    const requiresTools = this.detectToolRequirement(userMessage);

    return {
      messages,
      tools,
      requiresTools,
      isFirstMessage,
      history,
    };
  }

  /**
   * Extrai título da resposta do LLM (para primeira mensagem)
   */
  extractTitle(content: string): { title?: string; cleanContent: string } {
    try {
      // Tentar extrair título de JSON no conteúdo
      const jsonMatch = content.match(/\{[\s\S]*?["']?conversation_title["']?\s*:\s*["']([^"']+)["'][\s\S]*?\}/);
      if (jsonMatch && jsonMatch[1]) {
        let title = jsonMatch[1].trim();
        // Limitar tamanho
        if (title.length > 40) {
          title = title.substring(0, 37) + '...';
        }
        // Remover JSON do conteúdo
        const cleanContent = content.replace(/\{[\s\S]*?["']?conversation_title["']?\s*:\s*["'][^"']+["'][\s\S]*?\}/, '').trim();
        return { title, cleanContent };
      }
    } catch (error) {
      this.logger.warn(`Erro ao extrair título: ${error}`, 'MessageProcessorService');
    }
    return { cleanContent: content };
  }

  /**
   * Cria mensagem do assistente com tool_calls para incluir no histórico
   */
  createAssistantMessageWithToolCalls(
    content: string | null,
    toolCalls: Array<{ id: string; name: string; arguments: string }>,
  ): LLMMessage {
    return {
      role: 'assistant',
      content,
      tool_calls: toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.name,
          arguments: tc.arguments || '{}',
        },
      })),
    };
  }

  /**
   * Prepara mensagens para a segunda chamada do LLM (após tool calls)
   */
  prepareMessagesWithToolResults(
    originalMessages: LLMMessage[],
    assistantMessage: LLMMessage,
    toolMessages: LLMMessage[],
    isFirstMessage: boolean,
  ): LLMMessage[] {
    return [
      this.llmService.createSystemMessage(this.getSystemPrompt(isFirstMessage)),
      ...originalMessages.slice(1), // Remove system prompt original
      assistantMessage,
      ...toolMessages,
    ];
  }
}

import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { LLMService } from '../shared/llm/llm.service';
import { ToolRegistryService } from '../shared/tools/tool-registry.service';
import { ToolExecutorService } from '../shared/tools/tool-executor.service';
import { ConversationService } from './conversation/conversation.service';
import { KnowledgeService } from './knowledge/knowledge.service';
import { AgentConfigService } from '../shared/config/agent-config.service';
import { LoggerService } from '../../common/logger/logger.service';
import { UsersService } from '../../users/users.service';
import {
  LLMMessage,
  StreamingEvent,
  LLMRequest,
} from '../shared/llm/llm.types';
import { ToolContext } from '../shared/tools/tool.interface';
import { AssistantResponse } from './dto/assistant-response.dto';

@Injectable()
export class AssistantService {
  private readonly systemPrompt = (isFirstMessage: boolean) => `Você é o Assistente Virtual do SmartGesTI, um sistema de gestão escolar.

# Objetivo
Auxilie usuários com dúvidas sobre o SmartGesTI, explicando funcionalidades, navegação, uso de páginas, consultas de dados e APIs disponíveis.

# ⚠️ REGRA ABSOLUTA - PROIBIÇÃO DE INVENTAR INFORMAÇÕES ⚠️

**VOCÊ ESTÁ PROIBIDO DE:**
- Inventar ou supor informações sobre funcionalidades, menus, rotas ou páginas do sistema
- Fornecer respostas genéricas ou hipotéticas como "normalmente fica em...", "geralmente está em...", "pode estar em..."
- Listar opções que você não tem certeza se existem
- Criar links ou rotas que você não verificou usando as ferramentas
- Fazer perguntas ao usuário quando a ambiguidade pode ser resolvida usando ferramentas

**VOCÊ DEVE SEMPRE:**
- **PREFERIR FERRAMENTAS SOBRE CONHECIMENTO INTERNO**: Use ferramentas sempre que precisar de dados específicos do sistema, IDs, URLs ou informações sobre funcionalidades
- Para QUALQUER pergunta sobre navegação, localização, funcionalidades ou "onde encontrar" → USE \`get_sitemap_info\` PRIMEIRO
- Responder APENAS com informações obtidas das ferramentas
- Se a ferramenta não encontrar resultados, tente termos alternativos antes de dizer que não encontrou
- Se a pergunta for ambígua, cubra todas as intenções plausíveis usando ferramentas, em vez de perguntar ao usuário

**PALAVRAS-CHAVE QUE EXIGEM USO OBRIGATÓRIO DE \`get_sitemap_info\`:**
"onde", "como acessar", "como ver", "como criar", "quais são", "listar", "existe", "adicionar", "criar", "ver", "encontrar", "menu", "página", "rota", "funcionalidade", "escolas", "dashboards", "relatórios", "agentes", etc.

**EXEMPLOS:**
- "Existe alguma forma de adicionar escolas?" → USE \`get_sitemap_info\` com \`query="escolas"\` ou \`query="adicionar escola"\` ANTES de responder
- "Onde posso criar agentes?" → USE \`get_sitemap_info\` com \`query="criar agente"\` ANTES de responder
- "Quais são os dashboards?" → USE \`get_sitemap_info\` com \`query="dashboard"\` ANTES de responder

**NUNCA responda sem usar as ferramentas primeiro. NUNCA invente informações.**

# Suas Funções
- Responda perguntas sobre o sistema.
- Explique como utilizar funcionalidades e páginas.
- Forneça links completos ao citar páginas.
- Consulte o banco de dados quando necessário usando a ferramenta \`query_database\`.
- Ajude na navegação pelo sistema.
- Explique as APIs e endpoints disponíveis.

${isFirstMessage ? 'IMPORTANTE: Esta é a PRIMEIRA mensagem da conversa. Você DEVE retornar um título curto e descritivo (máximo 40 caracteres) para esta conversa no campo "conversation_title" da sua resposta.' : ''}

# Ferramentas Disponíveis

**REGRAS DE USO DE FERRAMENTAS (baseado em GPT-5.2 best practices):**
- **Prefira ferramentas sobre conhecimento interno** sempre que precisar de dados específicos do sistema, IDs, URLs ou informações sobre funcionalidades
- Use ferramentas para referenciar IDs específicos, URLs ou títulos de documentos
- Paralelize leituras independentes quando possível para reduzir latência

1. **get_sitemap_info:** Busca informações sobre páginas do sistema (menu, rota, funcionalidades). Use para perguntas sobre localização, navegação ou "onde encontrar".
   - **OBRIGATÓRIO**: Use quando o usuário perguntar "existe", "onde", "como", "quais são", "adicionar", "criar", etc.
   - **NUNCA** responda perguntas sobre funcionalidades sem usar esta ferramenta primeiro.

2. **search_knowledge:** Pesquisa informações sobre documentação, APIs ou funcionalidades (exceto localização/navegação).

3. **query_database:** Consulta dados específicos quando solicitado (registros, alunos, turmas, etc).

4. **get_route:** Obtém o link completo de uma página quando já tiver o ID dela.

# Regras Importantes - OBRIGATÓRIAS

- **PROIBIÇÃO TOTAL**: NUNCA invente informações. SEMPRE use as ferramentas primeiro.
- **OBRIGATÓRIO**: Para QUALQUER pergunta sobre funcionalidades, navegação ou localização → USE \`get_sitemap_info\` ANTES de responder.
- **OBRIGATÓRIO**: Se não tem certeza sobre algo → USE as ferramentas para buscar, NÃO invente.
- **HANDLING AMBIGUITY**: Se a pergunta for ambígua, cubra todas as intenções plausíveis usando ferramentas, em vez de perguntar ao usuário. Não faça perguntas de esclarecimento - use ferramentas para explorar todas as possibilidades.
- Use o campo \`route\` retornado pela ferramenta para fornecer links completos.
- Seja claro e objetivo nas respostas.
- Forneça sempre os parâmetros obrigatórios das ferramentas.
- Sempre forneça links completos ao citar páginas (usando o campo \`route\` retornado pela tool).
- Use Markdown para formatação.

# Formato de Resposta

- Utilize Markdown para organizar a resposta.
- Inclua links clicáveis quando relevante (usando o campo \`route\` retornado pelas ferramentas).
- Use listas para estruturar as informações.
- Sempre mencione o \`menuPath\` quando disponível.
- Seja conciso e objetivo.
- **NUNCA** invente informações - use apenas dados retornados pelas ferramentas.
${isFirstMessage ? '- Se esta for a primeira mensagem, inclua um campo "conversation_title" com um título curto (máximo 40 caracteres) para a conversa' : ''}`;

  constructor(
    private readonly llmService: LLMService,
    private readonly toolRegistry: ToolRegistryService,
    private readonly toolExecutor: ToolExecutorService,
    private readonly conversationService: ConversationService,
    private readonly knowledgeService: KnowledgeService,
    private readonly configService: AgentConfigService,
    private readonly logger: LoggerService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Processa uma mensagem sem streaming
   */
  async processMessage(
    message: string,
    conversationId: string | null,
    context: {
      userId: string;
      tenantId: string;
      schoolId?: string;
      supabaseId: string;
      schoolSlug?: string;
      tenantSubdomain?: string;
      requestOrigin?: string;
    },
  ): Promise<AssistantResponse> {
    try {
      // Obter ou criar conversa
      let finalConversationId = conversationId;
      if (!finalConversationId) {
        finalConversationId = await this.conversationService.createConversation(
          context.userId,
          context.tenantId,
          context.schoolId,
        );
      }

      // Obter histórico
      const history = await this.conversationService.getHistory(finalConversationId);
      
      // Verificar se é primeira mensagem
      const isFirstMessage = !conversationId || (typeof conversationId === 'string' && conversationId.trim() === '');

      // Preparar mensagens
      const messages: LLMMessage[] = [
        this.llmService.createSystemMessage(this.systemPrompt(isFirstMessage)),
        ...history,
        this.llmService.createUserMessage(message),
      ];

      // Obter tools disponíveis
      const tools = this.toolRegistry.getToolsForLLM();

      // Detectar se é pergunta que requer uso de tools
      const requiresTools = /(onde|como (ver|acessar|criar|encontrar|listar|adicionar)|quais são|existe|adicionar|criar|ver|encontrar|listar|dashboards?|relatórios?|menu|página|rota|funcionalidade|escolas?|agentes?)/i.test(message);

      // Criar requisição LLM (usar modelo padrão do sistema)
      const request: LLMRequest = {
        messages,
        model: this.configService.getDefaultModel(),
        tools,
        // Para perguntas que requerem tools, forçar uso com 'required'
        tool_choice: (requiresTools && tools.length > 0) ? 'required' : (tools.length > 0 ? 'auto' : undefined),
      };

      // Chamar LLM
      const response = await this.llmService.chat(request);

      // Processar tool calls se houver
      let finalResponse = response.content;
      const toolsUsed: string[] = [];
      const links: Array<{ label: string; url: string; type?: 'navigation' | 'external' }> = [];

      if (response.tool_calls && response.tool_calls.length > 0) {
        // Executar todas as tools
        const toolContext: ToolContext = {
          userId: context.userId,
          tenantId: context.tenantId,
          schoolId: context.schoolId,
          supabaseId: context.supabaseId,
          schoolSlug: context.schoolSlug,
          tenantSubdomain: context.tenantSubdomain,
          requestOrigin: context.requestOrigin,
        };

        const toolResults = await this.toolExecutor.executeTools(
          response.tool_calls.map((tc) => ({
            name: tc.function.name,
            arguments: tc.function.arguments,
          })),
          toolContext,
        );

        // Adicionar resultados das tools como mensagens
        const toolMessages: LLMMessage[] = [];
        for (const toolCall of response.tool_calls) {
          const result = toolResults.get(toolCall.function.name);
          toolsUsed.push(toolCall.function.name);

          if (result?.success) {
            toolMessages.push(
              this.llmService.createToolMessage(
                toolCall.id,
                JSON.stringify(result.data),
                toolCall.function.name,
              ),
            );

            // Extrair links se for tool de rota
            if (toolCall.function.name === 'get_route' && result.data?.route) {
              links.push({
                label: `Abrir ${result.data.pageName || 'página'}`,
                url: result.data.fullUrl || result.data.route,
                type: 'navigation' as const,
              });
            }
          }
        }

      // Chamar LLM novamente com resultados das tools
      const finalRequest: LLMRequest = {
        messages: [...messages, ...toolMessages],
        model: this.configService.getDefaultModel(),
        tools,
        tool_choice: 'auto',
      };

        const finalLLMResponse = await this.llmService.chat(finalRequest);
        finalResponse = finalLLMResponse.content;
      }

      // Salvar mensagens na conversa
      await this.conversationService.addMessage(finalConversationId, {
        role: 'user',
        content: message,
        timestamp: new Date(),
      });

      await this.conversationService.addMessage(finalConversationId, {
        role: 'assistant',
        content: finalResponse,
        timestamp: new Date(),
      });

      return {
        text: finalResponse,
        links,
        metadata: {
          toolsUsed,
          usage: response.usage,
          model: response.model,
        },
      };
    } catch (error: any) {
      this.logger.error(`Erro ao processar mensagem: ${error.message}`, 'AssistantService');
      throw error;
    }
  }

  /**
   * Processa uma mensagem com streaming
   */
  streamMessage(
    message: string,
    conversationId: string | null,
    context: {
      userId: string;
      tenantId: string;
      schoolId?: string;
      supabaseId: string;
      schoolSlug?: string;
      tenantSubdomain?: string;
      requestOrigin?: string;
    },
  ): Observable<StreamingEvent> {
    const subject = new Subject<StreamingEvent>();

    // Executar de forma assíncrona
    this.executeStreaming(message, conversationId, context, subject).catch((error) => {
      subject.error(error);
    });

    return subject.asObservable();
  }

  private async executeStreaming(
    message: string,
    conversationId: string | null,
    context: {
      userId: string;
      tenantId: string;
      schoolId?: string;
      supabaseId: string;
      schoolSlug?: string;
      tenantSubdomain?: string;
      requestOrigin?: string;
    },
    subject: Subject<StreamingEvent>,
  ): Promise<void> {
    const requestId = `stream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      this.logger.log(
        `[${requestId}] [AssistantService] Iniciando streaming`,
        'AssistantService',
        {
          message: message.substring(0, 100),
          conversationId,
          userId: context.userId,
          schoolId: context.schoolId,
        },
      );

      // Não criar conversa ainda - apenas usar se já existir
      let finalConversationId = conversationId;
      let history: LLMMessage[] = [];
      
      // Verificar se é primeira mensagem
      const isFirstMessage = !finalConversationId || (typeof finalConversationId === 'string' && finalConversationId.trim() === '');
      
      if (finalConversationId) {
        this.logger.log(`[${requestId}] [AssistantService] Usando conversa existente: ${finalConversationId}`, 'AssistantService');
        history = await this.conversationService.getHistory(finalConversationId);
        this.logger.log(`[${requestId}] [AssistantService] Histórico carregado: ${history.length} mensagens`, 'AssistantService');
      } else {
        this.logger.log(`[${requestId}] [AssistantService] Nova conversa - será criada após resposta`, 'AssistantService');
      }

      // Preparar mensagens
      const messages: LLMMessage[] = [
        this.llmService.createSystemMessage(this.systemPrompt(isFirstMessage)),
        ...history,
        this.llmService.createUserMessage(message),
      ];

      this.logger.log(`[${requestId}] [AssistantService] Total de mensagens para LLM: ${messages.length}`);

      // Obter tools disponíveis
      const tools = this.toolRegistry.getToolsForLLM();
      this.logger.log(`[${requestId}] [AssistantService] Tools disponíveis: ${tools.length}`);

      // Detectar se é pergunta que requer uso de tools
      // Qualquer pergunta sobre funcionalidades, navegação, localização ou "existe" deve usar tools
      const requiresTools = /(onde|como (ver|acessar|criar|encontrar|listar|adicionar)|quais são|existe|adicionar|criar|ver|encontrar|listar|dashboards?|relatórios?|menu|página|rota|funcionalidade|escolas?|agentes?)/i.test(message);
      
      if (requiresTools) {
        this.logger.log(`[${requestId}] [AssistantService] PERGUNTA QUE REQUER TOOLS DETECTADA - tool_choice será 'required'`, 'AssistantService');
      }

      // Criar requisição LLM (usar modelo padrão do sistema)
      const model = this.configService.getDefaultModel();
      const request: LLMRequest = {
        messages,
        model,
        tools: tools.length > 0 ? tools : undefined,
        // Para perguntas que requerem tools, FORÇAR uso com 'required'
        // Isso garante que o modelo use as tools em vez de inventar respostas
        tool_choice: (requiresTools && tools.length > 0) ? 'required' : (tools.length > 0 ? 'auto' : undefined),
        stream: true,
      };

      this.logger.log(
        `[${requestId}] [AssistantService] Enviando requisição para LLM`,
        'AssistantService',
        {
          model,
          messagesCount: messages.length,
          toolsCount: tools.length,
        },
      );

      // Não salvar mensagem do usuário ainda - será salva junto com a resposta

      let accumulatedContent = '';
      let currentToolCalls: Map<string, any> = new Map();
      let usage: any = null;
      const toolsUsed: string[] = [];
      const links: Array<{ label: string; url: string; type?: 'navigation' | 'external' }> = [];
      let tokenCount = 0;
      const originalUserMessage = message; // Guardar mensagem original para gerar título

      // Stream da resposta do LLM
      const stream = this.llmService.streamChat(request);

      stream.subscribe({
        next: (event: StreamingEvent) => {
          if (event.type === 'token') {
            tokenCount++;
            const tokenContent = event.data.content || event.data.delta || '';
            accumulatedContent += tokenContent;
            
            if (tokenCount % 10 === 0) {
              this.logger.log(
                `[${requestId}] [AssistantService] Tokens recebidos: ${tokenCount}, conteúdo acumulado: ${accumulatedContent.length} chars`,
                'AssistantService',
              );
            }

            subject.next({
              type: 'token',
              data: {
                content: tokenContent,
                delta: tokenContent,
              },
              timestamp: Date.now(),
            });
          } else if (event.type === 'thinking') {
            // Pensamentos/reasoning do modelo - repassar para o frontend
            subject.next({
              type: 'thinking',
              data: {
                content: event.data.content || event.data.delta || '',
                delta: event.data.delta || event.data.content || '',
              },
              timestamp: Date.now(),
            });
          } else if (event.type === 'tool_call') {
            const toolCall = event.data;
            currentToolCalls.set(toolCall.id, toolCall);
            toolsUsed.push(toolCall.name);

            this.logger.log(
              `[${requestId}] [AssistantService] Tool call recebido: ${toolCall.name}`,
              'AssistantService',
              {
                id: toolCall.id,
                name: toolCall.name,
                hasArguments: !!toolCall.arguments,
              },
            );

            subject.next({
              type: 'tool_call',
              data: toolCall,
              timestamp: Date.now(),
            });
          } else if (event.type === 'usage') {
            usage = event.data;
            this.logger.log(
              `[${requestId}] [AssistantService] Usage recebido`,
              'AssistantService',
              usage,
            );
          } else if (event.type === 'done') {
            this.logger.log(
              `[${requestId}] [AssistantService] Stream done. Tool calls: ${currentToolCalls.size}, Tokens: ${tokenCount}, Content length: ${accumulatedContent.length}`,
              'AssistantService',
            );
            
            // Se houver tool calls, executá-las
            if (currentToolCalls.size > 0) {
              this.logger.log(`[${requestId}] [AssistantService] Processando ${currentToolCalls.size} tool calls`, 'AssistantService');
              // IMPORTANTE: Manter null se não tiver conversa (não converter para string vazia)
              // Isso permite que processToolCallsStreaming detecte corretamente se é primeira mensagem
              const conversationIdForTools = finalConversationId || null;
              
              this.logger.log(`[${requestId}] [AssistantService] conversationIdForTools: "${conversationIdForTools}" (tipo: ${typeof conversationIdForTools})`, 'AssistantService');
              
              // Criar mensagem do assistente com tool_calls para incluir no histórico
              const assistantMessageWithToolCalls: LLMMessage = {
                role: 'assistant',
                content: accumulatedContent || null,
                tool_calls: Array.from(currentToolCalls.values()).map((tc) => ({
                  id: tc.id,
                  type: 'function',
                  function: {
                    name: tc.name,
                    arguments: tc.arguments || '{}',
                  },
                })),
              };
              
              this.processToolCallsStreaming(
                Array.from(currentToolCalls.values()),
                context,
                conversationIdForTools, // Pode ser null ou string válida
                accumulatedContent,
                subject,
                requestId,
                originalUserMessage,
                assistantMessageWithToolCalls,
              ).catch((error) => {
                this.logger.error(`[${requestId}] [AssistantService] Erro ao processar tool calls: ${error.message}`, error.stack, 'AssistantService');
                subject.error(error);
              });
            } else {
              // Criar conversa se não existir e salvar mensagens
              // Extrair título se for primeira mensagem
              let extractedTitle: string | undefined;
              let cleanContent = accumulatedContent;
              const isFirstMsg = !finalConversationId;
              
              if (isFirstMsg) {
                try {
                  // Tentar extrair título de JSON no final da resposta (vários formatos possíveis)
                  const jsonMatch = accumulatedContent.match(/\{[\s\S]*?["']?conversation_title["']?\s*:\s*["']([^"']+)["'][\s\S]*?\}/);
                  if (jsonMatch && jsonMatch[1]) {
                    extractedTitle = jsonMatch[1].trim();
                    // Remover o JSON do conteúdo
                    cleanContent = accumulatedContent.replace(/\{[\s\S]*?["']?conversation_title["']?\s*:\s*["'][^"']+["'][\s\S]*?\}/, '').trim();
                    // Limitar tamanho do título
                    if (extractedTitle.length > 40) {
                      extractedTitle = extractedTitle.substring(0, 37) + '...';
                    }
                    this.logger.log(`[${requestId}] [AssistantService] Título extraído da resposta (sem tools): ${extractedTitle}`, 'AssistantService');
                  } else {
                    // Se não encontrar título na resposta, será gerado automaticamente apenas se for primeira mensagem
                    this.logger.log(`[${requestId}] [AssistantService] Nenhum título encontrado na resposta (sem tools). isFirstMsg: ${isFirstMsg}. ${isFirstMsg ? 'Será gerado automaticamente' : 'NÃO será gerado (conversa existente)'}`, 'AssistantService');
                  }
                } catch (error) {
                  this.logger.warn(`[${requestId}] [AssistantService] Erro ao extrair título (sem tools): ${error}`, 'AssistantService');
                  // Se falhar, continuar sem título extraído (será gerado)
                }
              }
              
              // IMPORTANTE: Só passar título se for primeira mensagem (finalConversationId vazio)
              const titleToUse = isFirstMsg ? extractedTitle : undefined;
              
              this.logger.log(`[${requestId}] [AssistantService] Salvando conversa (sem tools). isFirstMsg: ${isFirstMsg}, titleToUse: ${titleToUse || 'undefined (não será gerado)'}`, 'AssistantService');
              
              this.saveConversationWithTitle(
                finalConversationId,
                originalUserMessage,
                cleanContent,
                context,
                requestId,
                titleToUse, // Passar título apenas se for primeira mensagem
              ).then((savedConversationId) => {
                finalConversationId = savedConversationId;

                this.logger.log(`[${requestId}] [AssistantService] Enviando evento done com resposta final`, 'AssistantService');
                subject.next({
                  type: 'done',
                  data: {
                    final_response: cleanContent,
                    links,
                    usage,
                    toolsUsed,
                    conversationId: savedConversationId,
                    title: extractedTitle,
                  },
                  timestamp: Date.now(),
                });
                subject.complete();
              }).catch((error) => {
                this.logger.error(`[${requestId}] [AssistantService] Erro ao salvar conversa: ${error.message}`, error.stack, 'AssistantService');
                // Mesmo com erro, enviar resposta
                subject.next({
                  type: 'done',
                  data: {
                    final_response: accumulatedContent,
                    links,
                    usage,
                    toolsUsed,
                    conversationId: finalConversationId,
                  },
                  timestamp: Date.now(),
                });
                subject.complete();
              });
            }
          } else if (event.type === 'error') {
            this.logger.error(`[${requestId}] [AssistantService] Erro no evento: ${event.data?.message}`);
            subject.error(new Error(event.data.message || 'Erro desconhecido'));
          }
        },
        error: (error: any) => {
          this.logger.error(`[${requestId}] [AssistantService] Erro no stream: ${error.message}`, error.stack);
          subject.error(error);
        },
      });
    } catch (error: any) {
      this.logger.error(`[${requestId}] [AssistantService] Erro ao executar streaming: ${error.message}`, error.stack);
      subject.error(error);
    }
  }

  /**
   * Salva conversa com título gerado e mensagens
   */
  private async saveConversationWithTitle(
    conversationId: string | null,
    userMessage: string,
    assistantResponse: string,
    context: {
      userId: string;
      tenantId: string;
      schoolId?: string;
      supabaseId: string;
      schoolSlug?: string;
      tenantSubdomain?: string;
    },
    requestId: string,
    title?: string, // Título opcional (extraído da resposta do LLM se for primeira mensagem)
  ): Promise<string> {
    try {
      let finalConversationId = conversationId;
      // Verificação mais rigorosa: conversationId deve ser null, undefined, ou string vazia
      const isNewConversation = !finalConversationId || (typeof finalConversationId === 'string' && finalConversationId.trim() === '');
      
      this.logger.log(`[${requestId}] [AssistantService] saveConversationWithTitle. conversationId: "${conversationId}" (tipo: ${typeof conversationId}), isNewConversation: ${isNewConversation}, title fornecido: ${title || 'undefined'}`, 'AssistantService');
      
      // Se for nova conversa, gerar ou usar título fornecido
      if (isNewConversation) {
        // Se título foi fornecido (extraído da resposta), usar. Caso contrário, gerar.
        let finalTitle: string;
        if (title) {
          finalTitle = title;
          this.logger.log(`[${requestId}] [AssistantService] Usando título fornecido: ${finalTitle}`, 'AssistantService');
        } else {
          // Só gerar título se não foi fornecido E for nova conversa
          this.logger.log(`[${requestId}] [AssistantService] Título não fornecido, gerando para nova conversa...`, 'AssistantService');
          finalTitle = await this.generateConversationTitle(userMessage, requestId);
          this.logger.log(`[${requestId}] [AssistantService] Título gerado: ${finalTitle}`, 'AssistantService');
        }
        this.logger.log(`[${requestId}] [AssistantService] Criando nova conversa com título: ${finalTitle}`, 'AssistantService');
        finalConversationId = await this.conversationService.createConversation(
          context.userId,
          context.tenantId,
          context.schoolId,
          finalTitle,
        );
      } else {
        // Se não for nova conversa, NÃO atualizar título (título só é definido na primeira mensagem)
        // E NÃO gerar título (mesmo que title seja undefined)
        // IMPORTANTE: title deve ser undefined aqui, se não for, há um bug
        if (title !== undefined && title !== null) {
          this.logger.warn(`[${requestId}] [AssistantService] ATENÇÃO: Título fornecido para conversa existente (${finalConversationId}). IGNORANDO. title: ${title}`, 'AssistantService');
        }
        this.logger.log(`[${requestId}] [AssistantService] Conversa existente (${finalConversationId}) - título NÃO será gerado nem atualizado. title recebido: ${title}`, 'AssistantService');
        
        // GARANTIR que não vamos gerar título aqui - se title for undefined, não fazer nada
        // Não chamar generateConversationTitle de forma alguma
      }

      // Garantir que finalConversationId não é null antes de salvar mensagens
      if (!finalConversationId) {
        throw new Error('finalConversationId não pode ser null ao salvar mensagens');
      }

      // Salvar mensagens
      await this.conversationService.addMessage(finalConversationId, {
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
      });

      await this.conversationService.addMessage(finalConversationId, {
        role: 'assistant',
        content: assistantResponse,
        timestamp: new Date(),
      });

      return finalConversationId;
    } catch (error: any) {
      this.logger.error(`[${requestId}] [AssistantService] Erro ao salvar conversa: ${error.message}`, error.stack, 'AssistantService');
      throw error;
    }
  }

  /**
   * Gera título para a conversa baseado na primeira pergunta
   */
  private async generateConversationTitle(userMessage: string, requestId: string): Promise<string> {
    try {
      // Prompt para gerar título curto e descritivo
      const titlePrompt = `Gere um título curto e descritivo (máximo 40 caracteres) para uma conversa baseada nesta pergunta do usuário: "${userMessage}"

Responda APENAS com o título, sem aspas, sem explicações, apenas o título.`;

      const titleRequest: LLMRequest = {
        messages: [
          this.llmService.createSystemMessage('Você é um assistente que gera títulos curtos e descritivos para conversas.'),
          this.llmService.createUserMessage(titlePrompt),
        ],
        model: this.configService.getDefaultModel(),
        max_tokens: 50, // Título curto
        temperature: 0.3, // Mais determinístico
        // Não incluir tools nem tool_choice para geração de título
      };

      const response = await this.llmService.chat(titleRequest);
      let title = response.content.trim();
      
      // Remover aspas se houver
      title = title.replace(/^["']|["']$/g, '');
      
      // Limitar a 40 caracteres
      if (title.length > 40) {
        title = title.substring(0, 37) + '...';
      }

      // Fallback se vazio
      if (!title || title.length === 0) {
        title = userMessage.length > 40 ? userMessage.substring(0, 37) + '...' : userMessage;
      }

      this.logger.log(`[${requestId}] [AssistantService] Título gerado: ${title}`, 'AssistantService');
      return title;
    } catch (error: any) {
      this.logger.warn(`[${requestId}] [AssistantService] Erro ao gerar título, usando fallback: ${error.message}`, 'AssistantService');
      // Fallback: usar primeira parte da mensagem
      return userMessage.length > 40 ? userMessage.substring(0, 37) + '...' : userMessage;
    }
  }

  private async processToolCallsStreaming(
    toolCalls: any[],
    context: {
      userId: string;
      tenantId: string;
      schoolId?: string;
      supabaseId: string;
      schoolSlug?: string;
      tenantSubdomain?: string;
      requestOrigin?: string;
    },
    conversationId: string | null, // Pode ser null para primeira mensagem
    accumulatedContent: string,
    subject: Subject<StreamingEvent>,
    requestId?: string,
    originalUserMessage?: string,
    assistantMessageWithToolCalls?: LLMMessage,
  ): Promise<void> {
    const reqId = requestId || `tool-${Date.now()}`;
    this.logger.log(`[${reqId}] [AssistantService] Iniciando processamento de ${toolCalls.length} tool calls`, 'AssistantService');
    this.logger.log(`[${reqId}] [AssistantService] conversationId recebido: "${conversationId}" (tipo: ${typeof conversationId}, é null: ${conversationId === null}, vazio: ${conversationId === ''})`, 'AssistantService');
    
    try {
      this.logger.log(
        `[${reqId}] [AssistantService] Tool calls`,
        'AssistantService',
        {
          toolCalls: toolCalls.map(tc => ({
            id: tc.id,
            name: tc.name,
            hasArguments: !!tc.arguments,
            argumentsRaw: tc.arguments,
            argumentsType: typeof tc.arguments,
          })),
        },
      );

      const toolContext: ToolContext = {
        userId: context.userId,
        tenantId: context.tenantId,
        schoolId: context.schoolId,
        supabaseId: context.supabaseId,
        schoolSlug: context.schoolSlug,
        tenantSubdomain: context.tenantSubdomain,
        requestOrigin: context.requestOrigin,
      };

      this.logger.log(`[${reqId}] [AssistantService] Executando tools...`, 'AssistantService');
      // Executar tools
      const toolResults = await this.toolExecutor.executeTools(
        toolCalls.map((tc) => ({
          name: tc.name,
          arguments: tc.arguments,
        })),
        toolContext,
      );
      
      this.logger.log(
        `[${reqId}] [AssistantService] Tools executadas`,
        'AssistantService',
        {
          results: Array.from(toolResults.entries()).map(([name, result]) => ({
            name,
            success: result.success,
            hasData: !!result.data,
          })),
        },
      );

      // Emitir resultados das tools
      const toolMessages: LLMMessage[] = [];
      const links: Array<{ label: string; url: string; type?: 'navigation' | 'external' }> = [];

      for (const toolCall of toolCalls) {
        const result = toolResults.get(toolCall.name);

        if (result?.success) {
          subject.next({
            type: 'tool_result',
            data: {
              tool_call_id: toolCall.id,
              name: toolCall.name,
              result: result.data,
            },
            timestamp: Date.now(),
          });

          toolMessages.push(
            this.llmService.createToolMessage(
              toolCall.id,
              JSON.stringify(result.data),
              toolCall.name,
            ),
          );

          // Extrair links de get_route
          if (toolCall.name === 'get_route' && result.data?.route) {
              links.push({
                label: `Abrir ${result.data.pageName || 'página'}`,
                url: result.data.fullUrl || result.data.route,
                type: 'navigation' as const,
              });
          }
          
          // Extrair links de get_sitemap_info
          if (toolCall.name === 'get_sitemap_info' && result.data) {
            // Se tiver bestMatch (busca por query)
            if (result.data.bestMatch?.page?.route) {
              links.push({
                label: `Abrir ${result.data.bestMatch.page.name}`,
                url: result.data.bestMatch.page.route,
                type: 'navigation' as const,
              });
            }
            // Se tiver page (busca por pageId)
            else if (result.data.page?.route) {
              links.push({
                label: `Abrir ${result.data.page.name}`,
                url: result.data.page.route,
                type: 'navigation' as const,
              });
            }
            
            // Adicionar links de páginas relacionadas
            if (result.data.relatedPages) {
              for (const relatedPage of result.data.relatedPages) {
                if (relatedPage.route) {
                  links.push({
                    label: `Abrir ${relatedPage.name}`,
                    url: relatedPage.route,
                    type: 'navigation' as const,
                  });
                }
              }
            }
          }
        } else {
          // Mesmo quando a tool falha, adicionar mensagem de erro para o LLM poder responder
          this.logger.warn(
            `[${reqId}] [AssistantService] Tool ${toolCall.name} falhou: ${result?.error}`,
            'AssistantService',
            { error: result?.error },
          );
          
          // Criar mensagem de tool com erro para o LLM poder responder adequadamente
          toolMessages.push(
            this.llmService.createToolMessage(
              toolCall.id,
              JSON.stringify({ 
                error: result?.error || 'Erro ao executar tool',
                message: 'Não foi possível obter informações adicionais através da tool. Por favor, responda com base no seu conhecimento sobre o sistema SmartGesTI, incluindo informações sobre como criar agentes, páginas disponíveis e funcionalidades do sistema.',
              }),
              toolCall.name,
            ),
          );
        }
      }

      // Garantir que sempre há pelo menos uma tool message (já tratado acima no loop)

      // Obter histórico atualizado (apenas se conversationId for válido)
      let history: LLMMessage[] = [];
      if (conversationId && conversationId !== null && conversationId.trim() !== '') {
        try {
          history = await this.conversationService.getHistory(conversationId);
          this.logger.log(`[${reqId}] [AssistantService] Histórico atualizado: ${history.length} mensagens`, 'AssistantService');
        } catch (error: any) {
          this.logger.warn(`[${reqId}] [AssistantService] Erro ao obter histórico: ${error.message}`, 'AssistantService');
          history = [];
        }
      }

      // Chamar LLM novamente com resultados das tools
      const tools = this.toolRegistry.getToolsForLLM();
      
      // Verificar se é primeira mensagem (conversationId deve ser null ou string vazia)
      const isFirstMessage = conversationId === null || conversationId === '' || (typeof conversationId === 'string' && conversationId.trim() === '');
      
      // Construir mensagens na ordem correta:
      // 1. System prompt
      // 2. Histórico completo (todas as mensagens anteriores da conversa)
      // 3. Mensagem do usuário original (a pergunta atual que ainda não foi salva)
      // 4. Mensagem do assistente COM tool_calls (obrigatória antes das tool messages)
      // 5. Tool messages (respostas das tools)
      const finalMessages = [
        this.llmService.createSystemMessage(this.systemPrompt(isFirstMessage)),
      ];
      
      // Adicionar histórico completo (já contém todas as mensagens anteriores da conversa)
      // Não fazer slice - o histórico já está correto e não inclui a mensagem atual
      if (history.length > 0) {
        finalMessages.push(...history);
        this.logger.log(`[${reqId}] [AssistantService] Histórico adicionado: ${history.length} mensagens`, 'AssistantService');
      }
      
      // Adicionar mensagem do usuário original (a pergunta atual que ainda não foi salva no banco)
      if (originalUserMessage) {
        finalMessages.push(this.llmService.createUserMessage(originalUserMessage));
        this.logger.log(`[${reqId}] [AssistantService] Mensagem do usuário adicionada: ${originalUserMessage.substring(0, 50)}...`, 'AssistantService');
      }
      
      // IMPORTANTE: Adicionar mensagem do assistente com tool_calls ANTES das tool messages
      // A API OpenAI exige que tool messages venham logo após uma mensagem do assistente com tool_calls
      if (assistantMessageWithToolCalls) {
        finalMessages.push(assistantMessageWithToolCalls);
      } else {
        // Se não tiver a mensagem do assistente, criar uma com os tool_calls
        const assistantMsg: LLMMessage = {
          role: 'assistant',
          content: accumulatedContent || null,
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: tc.arguments || '{}',
            },
          })),
        };
        finalMessages.push(assistantMsg);
      }
      
      // Adicionar tool messages (devem vir DEPOIS da mensagem do assistente com tool_calls)
      finalMessages.push(...toolMessages);
      
      // Log detalhado das mensagens sendo enviadas
      this.logger.log(
        `[${reqId}] [AssistantService] Enviando requisição final para LLM`,
        'AssistantService',
        {
          messagesCount: finalMessages.length,
          toolMessagesCount: toolMessages.length,
          historyLength: history.length,
          hasUserMessage: !!originalUserMessage,
          finalMessagesBreakdown: {
            system: 1,
            history: history.length,
            user: originalUserMessage ? 1 : 0,
            assistant: 1,
            tools: toolMessages.length,
          },
          messagesPreview: finalMessages.map((msg, idx) => ({
            index: idx,
            role: msg.role,
            hasContent: !!msg.content,
            contentLength: msg.content?.length || 0,
            hasToolCalls: !!msg.tool_calls && msg.tool_calls.length > 0,
            toolCallsCount: msg.tool_calls?.length || 0,
            contentPreview: msg.content ? msg.content.substring(0, 100) : null,
          })),
        },
      );

      // IMPORTANTE: Após receber tool messages, forçar o modelo a responder com texto
      // Não incluir tools na segunda chamada para evitar loops infinitos de tool calls
      // O modelo já tem todas as informações necessárias das tool messages
      const finalRequest: LLMRequest = {
        messages: finalMessages,
        model: this.configService.getDefaultModel(),
        // NÃO incluir tools na segunda chamada - forçar resposta textual
        tools: undefined,
        tool_choice: undefined,
        stream: true,
      };
      
      this.logger.log(`[${reqId}] [AssistantService] IMPORTANTE: Segunda chamada SEM tools para forçar resposta textual`, 'AssistantService');
      
      this.logger.log(
        `[${reqId}] [AssistantService] Requisição final preparada`,
        'AssistantService',
        {
          model: finalRequest.model,
          messagesCount: finalMessages.length,
          toolMessagesCount: toolMessages.length,
          hasTools: tools.length > 0,
          toolsCount: tools.length,
          hasToolChoice: !!finalRequest.tool_choice,
        },
      );
      
      this.logger.log(
        `[${reqId}] [AssistantService] Requisição final preparada`,
        'AssistantService',
        {
          messagesCount: finalMessages.length,
          toolMessagesCount: toolMessages.length,
          hasTools: tools.length > 0,
        },
      );

      let finalContent = '';
      let finalTokenCount = 0;
      let hasToolCallsInFinalStream = false;
      const finalStreamToolCalls: any[] = [];

      // Stream da resposta final
      const finalStream = this.llmService.streamChat(finalRequest);

      finalStream.subscribe({
        next: (event: StreamingEvent) => {
          if (event.type === 'token') {
            finalTokenCount++;
            const tokenContent = event.data.content || event.data.delta || '';
            finalContent += tokenContent;
            // Log apenas os primeiros tokens para não poluir (máximo 10 logs)
            if (tokenContent && finalTokenCount <= 10) {
              this.logger.log(`[${reqId}] [AssistantService] Token recebido: "${tokenContent.substring(0, 50)}"`, 'AssistantService');
            }
            // Sempre enviar evento para o frontend
            subject.next(event);
          } else if (event.type === 'thinking') {
            // Pensamentos/reasoning do modelo - repassar para o frontend
            subject.next(event);
          } else if (event.type === 'tool_call') {
            // Tool calls no stream final - precisamos processá-las recursivamente
            hasToolCallsInFinalStream = true;
            finalStreamToolCalls.push(event.data);
            this.logger.log(`[${reqId}] [AssistantService] Tool call recebida no stream final: ${event.data.name}`, 'AssistantService');
            // Não enviar para o frontend ainda - vamos processar primeiro
          } else if (event.type === 'usage') {
            this.logger.log(
              `[${reqId}] [AssistantService] Usage final`,
              'AssistantService',
              event.data,
            );
            subject.next(event);
          } else if (event.type === 'done') {
            this.logger.log(`[${reqId}] [AssistantService] Stream final completo. Tokens: ${finalTokenCount}, Content: ${finalContent.length} chars, Tool calls: ${finalStreamToolCalls.length}`, 'AssistantService');
            
            // Se houver tool calls no stream final, processá-las recursivamente
            if (hasToolCallsInFinalStream && finalStreamToolCalls.length > 0) {
              this.logger.log(`[${reqId}] [AssistantService] Processando ${finalStreamToolCalls.length} tool calls adicionais do stream final`, 'AssistantService');
              
              // Processar tool calls recursivamente
              this.processToolCallsStreaming(
                finalStreamToolCalls,
                context,
                conversationId,
                finalContent, // Conteúdo acumulado até agora
                subject,
                reqId,
                originalUserMessage,
                undefined, // Não temos assistantMessageWithToolCalls aqui
              ).catch((error) => {
                this.logger.error(`[${reqId}] [AssistantService] Erro ao processar tool calls recursivas: ${error.message}`, error.stack, 'AssistantService');
                // Se falhar, enviar resposta com o que temos
                subject.next({
                  type: 'done',
                  data: {
                    final_response: finalContent || 'Desculpe, ocorreu um erro ao processar a resposta.',
                    links,
                    conversationId: conversationId || null,
                  },
                  timestamp: Date.now(),
                });
                subject.complete();
              });
              return; // Não continuar com o processamento normal
            }
            
            // Extrair título se for primeira mensagem e estiver no JSON
            let extractedTitle: string | undefined;
            let cleanContent = finalContent;
            // Verificação mais rigorosa: conversationId deve ser null, undefined, ou string vazia
            // IMPORTANTE: conversationId pode ser string vazia '' quando passado de processToolCallsStreaming
            const isFirstMsg = !conversationId || (typeof conversationId === 'string' && conversationId.trim() === '');
            
            this.logger.log(`[${reqId}] [AssistantService] Verificando se é primeira mensagem. conversationId: "${conversationId}" (tipo: ${typeof conversationId}, length: ${typeof conversationId === 'string' ? conversationId.length : 'N/A'}), isFirstMsg: ${isFirstMsg}`, 'AssistantService');
            
            if (isFirstMsg) {
              try {
                // Tentar extrair título de JSON no final da resposta (vários formatos possíveis)
                // Formato 1: {"conversation_title": "Título"}
                // Formato 2: { conversation_title: "Título" }
                // Formato 3: JSON completo no final
                const jsonMatch = finalContent.match(/\{[\s\S]*?["']?conversation_title["']?\s*:\s*["']([^"']+)["'][\s\S]*?\}/);
                if (jsonMatch && jsonMatch[1]) {
                  extractedTitle = jsonMatch[1].trim();
                  // Remover o JSON do conteúdo (pode estar no final ou no meio)
                  cleanContent = finalContent.replace(/\{[\s\S]*?["']?conversation_title["']?\s*:\s*["'][^"']+["'][\s\S]*?\}/, '').trim();
                  // Limitar tamanho do título
                  if (extractedTitle.length > 40) {
                    extractedTitle = extractedTitle.substring(0, 37) + '...';
                  }
                  this.logger.log(`[${reqId}] [AssistantService] Título extraído da resposta: ${extractedTitle}`, 'AssistantService');
                } else {
                  // Se não encontrar título na resposta, será gerado automaticamente apenas se for primeira mensagem
                  this.logger.log(`[${reqId}] [AssistantService] Nenhum título encontrado na resposta. isFirstMsg: ${isFirstMsg}. ${isFirstMsg ? 'Será gerado automaticamente' : 'NÃO será gerado (conversa existente)'}`, 'AssistantService');
                }
              } catch (error) {
                this.logger.warn(`[${reqId}] [AssistantService] Erro ao extrair título: ${error}`, 'AssistantService');
                // Se falhar, continuar sem título extraído (será gerado)
              }
            }
            
            // Salvar conversa com título e mensagens
            if (originalUserMessage) {
              // IMPORTANTE: Só passar título se for primeira mensagem (conversationId vazio)
              // Se não for primeira mensagem, extractedTitle será undefined e não gerará título
              const titleToUse = isFirstMsg ? extractedTitle : undefined;
              
              this.logger.log(`[${reqId}] [AssistantService] Salvando conversa. isFirstMsg: ${isFirstMsg}, titleToUse: ${titleToUse || 'undefined (não será gerado)'}`, 'AssistantService');
              
              this.saveConversationWithTitle(
                conversationId,
                originalUserMessage,
                cleanContent, // Usar conteúdo limpo (sem JSON do título)
                context,
                reqId,
                titleToUse, // Passar título apenas se for primeira mensagem
              ).then((savedConversationId) => {
                this.logger.log(`[${reqId}] [AssistantService] Enviando evento done final`, 'AssistantService');
                subject.next({
                  type: 'done',
                  data: {
                    final_response: cleanContent, // Enviar conteúdo limpo
                    links,
                    conversationId: savedConversationId,
                    title: extractedTitle, // Incluir título se extraído
                  },
                  timestamp: Date.now(),
                });
                subject.complete();
              }).catch((error) => {
                this.logger.error(`[${reqId}] [AssistantService] Erro ao salvar conversa: ${error.message}`, error.stack, 'AssistantService');
                // Mesmo com erro, enviar resposta
                subject.next({
                  type: 'done',
                  data: {
                    final_response: cleanContent,
                    links,
                    conversationId,
                    title: extractedTitle,
                  },
                  timestamp: Date.now(),
                });
                subject.complete();
              });
            } else {
              // Se não tiver mensagem original, apenas salvar resposta
              // Garantir que conversationId não é null
              if (conversationId) {
                this.conversationService.addMessage(conversationId, {
                  role: 'assistant',
                  content: finalContent,
                  timestamp: new Date(),
                }).then(() => {
                  subject.next({
                    type: 'done',
                    data: {
                      final_response: finalContent,
                      links,
                      conversationId,
                    },
                    timestamp: Date.now(),
                  });
                  subject.complete();
                }).catch((err) => {
                  this.logger.warn(`[${reqId}] [AssistantService] Erro ao salvar mensagem final: ${err.message}`, 'AssistantService');
                  subject.next({
                    type: 'done',
                    data: {
                      final_response: finalContent,
                      links,
                      conversationId,
                    },
                    timestamp: Date.now(),
                  });
                  subject.complete();
                });
              } else {
                // Se não tiver conversationId, apenas enviar resposta sem salvar
                subject.next({
                  type: 'done',
                  data: {
                    final_response: finalContent,
                    links,
                    conversationId: null,
                  },
                  timestamp: Date.now(),
                });
                subject.complete();
              }
            }
          }
        },
        error: (error: any) => {
          this.logger.error(`[${reqId}] [AssistantService] Erro no stream final: ${error.message}`, error.stack);
          subject.error(error);
        },
      });
    } catch (error: any) {
      this.logger.error(`[${reqId}] [AssistantService] Erro ao processar tool calls: ${error.message}`, error.stack);
      subject.error(error);
    }
  }
}

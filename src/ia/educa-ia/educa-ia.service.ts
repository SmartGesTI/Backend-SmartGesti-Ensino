import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import {
  streamText,
  convertToModelMessages,
  pipeUIMessageStreamToResponse,
  stepCountIs,
  type UIMessage,
} from 'ai';
import { EducaIAAgent, detectComplexity, supportsReasoning, type ResponseMode } from '../../ai-core/agents/educa-ia.agent';
import { ModelProviderFactory } from '../../ai-core/providers/model-provider.factory';
import { ModelProviderConfigService } from '../../ai-core/config/model-provider.config';
import { AiCoreConfigService } from '../../ai-core/config/ai-core.config';
import { MemoryService } from '../../ai-core/memory/memory.service';
import { SupabaseService } from '../../supabase/supabase.service';
import { RAGTool } from '../../ai-core/tools/rag.tool';
import { DatabaseTool } from '../../ai-core/tools/database.tool';
import { NavigationTool } from '../../ai-core/tools/navigation.tool';
import { UserDataTool } from '../../ai-core/tools/user-data.tool';
import { AgentsTool } from '../../ai-core/tools/agents.tool';

export interface EducaIAStreamOptions {
  tenantId: string;
  supabaseId: string;
  schoolId?: string;
  model?: string;
  provider?: 'openai' | 'anthropic' | 'google';
  responseMode: ResponseMode;
  sendReasoning?: boolean;
  conversationId?: string;
  temperature?: number;
  maxTokens?: number;
}

@Injectable()
export class EducaIAService {
  private readonly logger = new Logger(EducaIAService.name);

  constructor(
    private readonly educaIAAgent: EducaIAAgent,
    private readonly providerFactory: ModelProviderFactory,
    private readonly modelConfig: ModelProviderConfigService,
    private readonly aiConfig: AiCoreConfigService,
    private readonly memoryService: MemoryService,
    private readonly supabase: SupabaseService,
    private readonly ragTool: RAGTool,
    private readonly databaseTool: DatabaseTool,
    private readonly navigationTool: NavigationTool,
    private readonly userDataTool: UserDataTool,
    private readonly agentsTool: AgentsTool,
  ) {}

  /**
   * Stream chat using EducaIA agent
   */
  async streamChat(
    messages: UIMessage[],
    res: Response,
    options: EducaIAStreamOptions,
  ): Promise<void> {
    // Get user data from database
    const userId = await this.getUserId(options.supabaseId);
    const userData = await this.getUserData(userId);
    const schoolData = options.schoolId
      ? await this.getSchoolData(options.schoolId)
      : null;

    // Determine model and provider
    const provider = options.provider || this.aiConfig.getDefaultProvider();
    const modelName =
      options.model || this.modelConfig.getProvider(provider)?.defaultModel;

    if (!modelName) {
      throw new Error(`No model specified for provider ${provider}`);
    }

    const model = this.providerFactory.getModel(provider, modelName);
    if (!model) {
      throw new Error(`Model ${modelName} not available for provider ${provider}`);
    }

    // Load conversation history if conversationId provided
    let conversationMessages: UIMessage[] = messages;
    if (options.conversationId) {
      try {
        const history = await this.memoryService.getMessages(
          {
            tenantId: options.tenantId,
            userId,
            schoolId: options.schoolId,
            conversationId: options.conversationId,
          },
          { maxMessages: 30 },
        );

        if (history.length > 0) {
          const historyUIMessages: UIMessage[] = history.map((msg) => {
            const text =
              typeof msg.content === 'string'
                ? msg.content
                : JSON.stringify(msg.content);
            return {
              id: `msg-${Date.now()}-${Math.random()}`,
              role: msg.role as any,
              parts: [{ type: 'text', text }],
            } as any;
          });

          conversationMessages = [...historyUIMessages, ...messages];
        }
      } catch (error: any) {
        this.logger.warn(`Could not load conversation history: ${error.message}`);
      }
    }

    // Check if should suggest detailed mode
    const lastUserMessage = messages.find((m) => m.role === 'user');
    const userText = lastUserMessage
      ? this.getTextFromUIMessage(lastUserMessage)
      : '';
    const shouldSuggestDetailed =
      options.responseMode === 'fast' && detectComplexity(userText) === 'complex';

    // Convert messages for model
    const modelMessages = await convertToModelMessages(conversationMessages);

    // Build stream options
    const modelConfigData = this.modelConfig.getModel(modelName);
    const isGpt5 = modelName.includes('gpt-5');

    const streamOptions: any = {
      model,
      messages: modelMessages,
      maxOutputTokens: options.maxTokens ?? modelConfigData?.maxTokens,
      maxRetries: this.aiConfig.getMaxRetries(),
    };

    // Configure provider-specific options
    if (!streamOptions.providerOptions) {
      streamOptions.providerOptions = {};
    }

    // Temperature (not supported by GPT-5)
    if (!isGpt5 && options.temperature !== undefined) {
      streamOptions.temperature = options.temperature;
    }

    // Configure reasoning support
    if (options.sendReasoning && supportsReasoning(modelName)) {
      if (provider === 'anthropic' && modelName.includes('claude')) {
        const supportsThinking =
          modelName.includes('claude-3-7') ||
          modelName.includes('claude-4') ||
          modelName.includes('claude-sonnet-4');

        if (supportsThinking) {
          if (!streamOptions.providerOptions.anthropic) {
            streamOptions.providerOptions.anthropic = {};
          }
          streamOptions.providerOptions.anthropic.thinking = {
            type: 'enabled',
            budgetTokens: 15000,
          };
          if (!streamOptions.headers) {
            streamOptions.headers = {};
          }
          streamOptions.headers['anthropic-beta'] = 'interleaved-thinking-2025-05-14';
        }
      } else if (provider === 'openai' && modelName.includes('gpt-5')) {
        if (!streamOptions.providerOptions.openai) {
          streamOptions.providerOptions.openai = {};
        }
        streamOptions.providerOptions.openai.reasoningEffort = 'high';
        streamOptions.providerOptions.openai.reasoningSummary = 'detailed';
      }
    }

    // Add system prompt with EducaIA context
    const systemPrompt = this.buildSystemPrompt(
      userData,
      schoolData,
      options.responseMode,
      shouldSuggestDetailed,
    );
    streamOptions.system = systemPrompt;

    // Create tools from agent (pass schoolSlug for navigation URLs)
    const schoolSlug = schoolData?.slug;
    const tools = this.createTools(options, userId, schoolSlug);
    const toolNames = Object.keys(tools);
    
    if (toolNames.length > 0) {
      streamOptions.tools = tools;
      // Allow multiple tool calls in a single response (AI SDK 5.0+)
      streamOptions.stopWhen = stepCountIs(5);
    }

    this.logger.debug(
      `EducaIA streaming with model ${modelName} (mode: ${options.responseMode}, reasoning: ${options.sendReasoning}, tools: ${toolNames.join(', ')})`,
    );

    try {
      const result = streamText(streamOptions);

      // Pipe to response
      pipeUIMessageStreamToResponse({
        response: res,
        stream: result.toUIMessageStream({
          sendReasoning: options.sendReasoning ?? false,
          sendSources: true,
        }),
      });

      // Save messages to memory in background after stream completes
      this.saveMessagesAfterStream(
        result,
        options,
        userId,
        userText,
      ).catch((err) => {
        this.logger.error(`Error saving messages after stream: ${err.message}`);
      });
    } catch (error: any) {
      this.logger.error(`Error streaming: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * List user conversations
   */
  async listConversations(
    supabaseId: string,
    tenantId: string,
    limit: number = 20,
  ): Promise<any[]> {
    const userId = await this.getUserId(supabaseId);

    const { data, error } = await this.supabase
      .getClient()
      .from('assistant_conversations')
      .select('id, created_at, updated_at, title, messages')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error(`Error listing conversations: ${error.message}`);
      throw error;
    }

    return (data || []).map((conv) => ({
      id: conv.id,
      createdAt: conv.created_at,
      updatedAt: conv.updated_at,
      title: conv.title,
      messageCount: Array.isArray(conv.messages) ? conv.messages.length : 0,
      lastMessage: this.getLastMessagePreview(conv.messages),
    }));
  }

  /**
   * Get conversation history
   * Returns messages in UIMessage format with full parts for proper rendering
   */
  async getConversationHistory(
    conversationId: string,
    supabaseId: string,
    tenantId: string,
  ): Promise<any[]> {
    const userId = await this.getUserId(supabaseId);

    const { data, error } = await this.supabase
      .getClient()
      .from('assistant_conversations')
      .select('messages')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      this.logger.error(`Error getting conversation: ${error.message}`);
      throw error;
    }

    // Return messages in UIMessage format with parts
    return (data?.messages || []).map((msg: any) => {
      const uiMessage: any = {
        id: msg.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: msg.role,
        createdAt: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      };

      // Build parts array - prioritize original parts which contain full tool outputs
      let parts: any[] = [];

      // If msg already has parts with content, use them directly
      // These parts include tool outputs which are needed for rendering components
      if (msg.parts && Array.isArray(msg.parts) && msg.parts.length > 0) {
        // Use original parts - they have full tool outputs for rendering cards/links
        parts = msg.parts.map((p: any) => ({
          ...p,
          // Ensure state is set for tool parts
          state: p.state || (p.output !== undefined ? 'output-available' : 'completed'),
        }));
      } else if (msg.content) {
        // Fallback: create text part from content
        parts.push({
          type: 'text',
          text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        });
      }

      // Only add toolCalls if parts array is empty AND toolCalls exist
      // This is a legacy fallback for old messages without parts
      if (parts.length === 0 && msg.toolCalls && Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls) {
          parts.push({
            type: `tool-${tc.toolName}`,
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            input: tc.args || {},
            output: tc.output || tc.result || undefined, // Try to get output if available
            state: 'output-available',
          });
        }
        // Also add content as text if present
        if (msg.content) {
          parts.push({
            type: 'text',
            text: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
          });
        }
      }

      uiMessage.parts = parts;

      return uiMessage;
    });
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(
    conversationId: string,
    supabaseId: string,
    tenantId: string,
  ): Promise<void> {
    const userId = await this.getUserId(supabaseId);

    const { error } = await this.supabase
      .getClient()
      .from('assistant_conversations')
      .delete()
      .eq('id', conversationId)
      .eq('user_id', userId)
      .eq('tenant_id', tenantId);

    if (error) {
      this.logger.error(`Error deleting conversation: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user ID from Supabase ID (auth0_id)
   */
  private async getUserId(supabaseId: string): Promise<string> {
    const { data, error } = await this.supabase
      .getClient()
      .from('users')
      .select('id')
      .eq('auth0_id', supabaseId)
      .single();

    if (error || !data) {
      this.logger.error(`User not found for Supabase ID: ${supabaseId}`);
      throw new Error('Usuário não encontrado no sistema');
    }

    return data.id;
  }

  /**
   * Get user data
   */
  private async getUserData(userId: string): Promise<any> {
    const { data, error } = await this.supabase
      .getClient()
      .from('users')
      .select('id, full_name, email, role, avatar_url, ai_context, ai_summary')
      .eq('id', userId)
      .single();

    if (error) {
      this.logger.warn(`Could not fetch user data: ${error.message}`);
      return null;
    }

    return data;
  }

  /**
   * Get school data
   */
  private async getSchoolData(schoolId: string): Promise<any> {
    const { data, error } = await this.supabase
      .getClient()
      .from('schools')
      .select('id, name, slug')
      .eq('id', schoolId)
      .single();

    if (error) {
      this.logger.warn(`Could not fetch school data: ${error.message}`);
      return null;
    }

    return data;
  }

  /**
   * Build system prompt with user context
   */
  private buildSystemPrompt(
    userData: any,
    schoolData: any,
    responseMode: ResponseMode,
    shouldSuggestDetailed: boolean,
  ): string {
    const parts: string[] = [
      'Você é o EducaIA, assistente virtual inteligente do SmartGesTI Ensino.',
      '',
      '## PERSONALIDADE',
      '- Amigável, didático e paciente',
      '- Chame o usuário pelo nome quando disponível',
      '- Explique conceitos de forma clara e acessível',
      '- Seja proativo em sugerir ajuda adicional',
      '',
      '## REGRAS ABSOLUTAS - MUITO IMPORTANTE',
      '- **NUNCA** invente informações - você NÃO sabe nada sobre o sistema sem consultar as tools',
      '- **SEMPRE** use a tool `retrieveKnowledge` ANTES de responder qualquer pergunta sobre o sistema',
      '- **SEMPRE** use a tool `navigateToPage` quando o usuário perguntar onde encontrar algo',
      '- Se a tool não retornar informação, admita que não sabe e sugira alternativas',
      '- Para consultas de dados específicos no banco, use `queryDatabase` (requer aprovação do usuário)',
      '- Para dados do próprio usuário, use `getUserData`',
      '',
      '## COMO USAR AS TOOLS',
      '- `retrieveKnowledge`: Use para buscar informações sobre funcionalidades, como usar o sistema, documentação, APIs, páginas',
      '- `listAgents`: Use para listar os agentes de IA disponíveis (públicos e colaborativos) - NÃO requer aprovação',
      '- `getAgentDetails`: Use para obter detalhes completos de um agente específico pelo nome - NÃO requer aprovação',
      '- `navigateToPage`: Use para sugerir páginas/menus quando o usuário pergunta "onde encontro..."',
      '- `getUserData`: Use para obter dados do perfil, escola e preferências do usuário atual',
      '- `queryDatabase`: Use para consultas genéricas ao banco de dados - REQUER APROVAÇÃO do usuário',
      '',
      '## FLUXO DE RESPOSTA OBRIGATÓRIO',
      '1. Analise a pergunta do usuário',
      '2. Escolha a(s) tool(s) apropriada(s):',
      '   - Perguntas sobre "quais agentes", "lista de agentes", "agentes disponíveis" → use `listAgents`',
      '   - Perguntas sobre um agente específico (ex: "Analisador de Currículos") → use `getAgentDetails`',
      '   - Perguntas sobre como usar o sistema, funcionalidades → use `retrieveKnowledge`',
      '   - Perguntas sobre onde encontrar algo no menu → use `navigateToPage`',
      '3. AGUARDE os resultados da tool',
      '4. Use os resultados da tool para formular sua resposta',
      '5. Cite as fontes quando aplicável',
      '',
      '## IMPORTANTE - SOBRE AGENTES',
      '- SEMPRE use `listAgents` quando o usuário perguntar sobre agentes disponíveis',
      '- NUNCA diga que precisa de aprovação para listar agentes - essa tool é de leitura livre',
      '- Use `getAgentDetails` para explicar um agente específico',
      '',
      '## IMPORTANTE - NÃO IGNORE OS RESULTADOS',
      '- Se a tool retornou resultados, você DEVE usá-los na resposta',
      '- Não responda com conhecimento geral se a tool retornou dados específicos',
    ];

    // Add user context
    if (userData) {
      parts.push('');
      parts.push('## CONTEXTO DO USUÁRIO');
      if (userData.full_name) {
        parts.push(`👤 Nome: ${userData.full_name}`);
      }
      if (userData.role) {
        const roleLabels: Record<string, string> = {
          admin: 'Administrador',
          teacher: 'Professor',
          student: 'Aluno',
          coordinator: 'Coordenador',
        };
        parts.push(`🎭 Papel: ${roleLabels[userData.role] || userData.role}`);
      }
      if (userData.ai_summary) {
        parts.push(`📝 Resumo: ${userData.ai_summary}`);
      }
    }

    if (schoolData) {
      parts.push(`🏫 Escola: ${schoolData.name}`);
    }

    // Add mode-specific instructions
    parts.push('');
    if (responseMode === 'fast') {
      parts.push('## MODO RÁPIDO');
      parts.push('- Seja conciso e direto');
      parts.push('- Use no máximo 3 resultados do RAG');
      parts.push('- Respostas curtas e objetivas');
    } else {
      parts.push('## MODO DETALHADO');
      parts.push('- Forneça explicações completas');
      parts.push('- Use até 6 resultados do RAG');
      parts.push('- Inclua exemplos e passos detalhados');
    }

    // Suggest detailed mode if needed
    if (shouldSuggestDetailed) {
      parts.push('');
      parts.push(
        '💡 **Nota**: A pergunta parece complexa. Considere sugerir ao usuário usar o modo "Detalhado" para uma resposta mais completa.',
      );
    }

    return parts.join('\n');
  }

  /**
   * Create tools for the agent with proper context
   */
  private createTools(
    options: EducaIAStreamOptions, 
    userId: string,
    schoolSlug?: string,
  ): Record<string, any> {
    const toolContext = {
      tenantId: options.tenantId,
      userId,
      schoolId: options.schoolId,
      schoolSlug, // For building navigation URLs
      responseMode: options.responseMode,
    };

    return {
      // RAG Tool - busca na knowledge base (documentação)
      retrieveKnowledge: this.ragTool.createTool(toolContext),
      
      // Agents Tools - lista e detalha agentes (NÃO requer aprovação)
      listAgents: this.agentsTool.createListTool(toolContext),
      getAgentDetails: this.agentsTool.createDetailsTool(toolContext),
      
      // Navigation Tool - sugere páginas do sistema
      navigateToPage: this.navigationTool.createTool(toolContext),
      
      // User Data Tool - busca dados do usuário
      getUserData: this.userDataTool.createTool(toolContext),
      
      // Database Tool - consulta dados genéricos (requer aprovação)
      queryDatabase: this.databaseTool.createTool(toolContext),
    };
  }

  /**
   * Get last message preview for conversation list
   */
  private getLastMessagePreview(messages: any[]): string {
    if (!messages || messages.length === 0) return 'Nova conversa';

    const lastMessage = messages[messages.length - 1];
    const content = lastMessage?.content || '';

    if (typeof content === 'string') {
      return content.length > 50 ? content.substring(0, 50) + '...' : content;
    }

    return 'Mensagem';
  }

  /**
   * Extract text from UIMessage
   */
  private getTextFromUIMessage(message: UIMessage): string {
    const parts: any[] = (message as any).parts || [];
    return parts
      .filter((p) => p?.type === 'text')
      .map((p) => p?.text || '')
      .join('');
  }

  /**
   * Save messages after stream completes
   * This ensures both user and assistant messages are persisted with full parts
   */
  private async saveMessagesAfterStream(
    result: ReturnType<typeof streamText>,
    options: EducaIAStreamOptions,
    userId: string,
    userText: string,
  ): Promise<void> {
    if (!options.conversationId) {
      this.logger.debug('No conversationId provided, skipping message save');
      return;
    }

    const context = {
      tenantId: options.tenantId,
      userId,
      schoolId: options.schoolId,
      conversationId: options.conversationId,
    };

    try {
      // Save user message with parts format
      const userMessage = {
        id: `user-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: 'user' as const,
        content: userText,
        parts: [{ type: 'text' as const, text: userText }],
        timestamp: new Date().toISOString(),
      };

      // Wait for the stream to complete and get the full response
      const text = await result.text;
      const toolCallsResolved = await result.toolCalls;
      const toolResultsResolved = await result.toolResults;
      const reasoningResolved = await result.reasoning;

      // Build assistant parts array
      const assistantParts: any[] = [];

      // Create a map of tool results for easy lookup
      const toolResultsMap = new Map<string, any>();
      if (toolResultsResolved && toolResultsResolved.length > 0) {
        for (const tr of toolResultsResolved) {
          const toolCallId = (tr as any).toolCallId;
          if (toolCallId) {
            toolResultsMap.set(toolCallId, (tr as any).result);
          }
        }
      }

      // Add tool calls with their results
      if (toolCallsResolved && toolCallsResolved.length > 0) {
        for (const tc of toolCallsResolved) {
          const toolCallId = tc.toolCallId;
          const output = toolResultsMap.get(toolCallId);
          // Access args with type cast (may be 'args' or 'input' depending on tool type)
          const toolArgs = (tc as any).args || (tc as any).input || {};
          
          assistantParts.push({
            type: `tool-${tc.toolName}`,
            toolCallId,
            toolName: tc.toolName,
            input: toolArgs,
            output: output, // Include the result directly
            state: 'output-available',
          });

          this.logger.debug(
            `Tool ${tc.toolName} (${toolCallId}): output=${output ? 'present' : 'missing'}`,
          );
        }
      }

      // Add any orphan tool results (results without matching calls)
      if (toolResultsResolved && toolResultsResolved.length > 0) {
        for (const tr of toolResultsResolved) {
          const toolCallId = (tr as any).toolCallId;
          const existingPart = assistantParts.find((p) => p.toolCallId === toolCallId);
          
          if (!existingPart) {
            assistantParts.push({
              type: 'tool-result',
              toolCallId,
              toolName: (tr as any).toolName || 'unknown',
              output: (tr as any).result,
              state: 'output-available',
            });
          }
        }
      }

      // Add text content at the end (chronological order)
      if (text) {
        assistantParts.push({ type: 'text', text });
      }

      // Build assistant message with full parts
      const assistantMessage = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        role: 'assistant' as const,
        content: text,
        parts: assistantParts,
        toolCalls: toolCallsResolved?.map((tc: any) => ({
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          args: tc.args || {},
        })),
        reasoning: reasoningResolved || undefined,
        timestamp: new Date().toISOString(),
      };

      // Save both messages using saveUIMessages for proper parts handling
      await (this.memoryService as any).saveUIMessages(context, [userMessage, assistantMessage]);

      this.logger.debug(
        `Saved user and assistant messages with ${assistantParts.length} parts to conversation ${options.conversationId}`,
      );
    } catch (error: any) {
      this.logger.error(`Error saving messages: ${error.message}`, error.stack);
    }
  }
}

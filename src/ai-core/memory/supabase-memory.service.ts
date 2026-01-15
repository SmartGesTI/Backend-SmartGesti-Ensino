import { Injectable, Logger } from '@nestjs/common';
import { ModelMessage } from '@ai-sdk/provider-utils';
import { SupabaseService } from '../../supabase/supabase.service';
import { IMemoryService } from './memory.interface';
import {
  ConversationContext,
  Message,
  MessageRole,
  MemoryOptions,
  ConversationMetadata,
} from './memory.types';

@Injectable()
export class SupabaseMemoryService implements IMemoryService {
  private readonly logger = new Logger(SupabaseMemoryService.name);
  private readonly MAX_MESSAGES = 1000; // Limite padrão de mensagens
  private readonly MAX_TOKENS = 100000; // Limite padrão de tokens

  constructor(private readonly supabase: SupabaseService) {}

  async getOrCreateConversation(context: ConversationContext): Promise<string> {
    if (context.conversationId) {
      // Verificar se a conversa já existe
      const { data: existing, error: checkError } = await this.supabase
        .getClient()
        .from('assistant_conversations')
        .select('id')
        .eq('id', context.conversationId)
        .eq('tenant_id', context.tenantId)
        .maybeSingle();

      if (checkError) {
        this.logger.error(
          `Error checking conversation existence: ${checkError.message}`,
          checkError,
        );
        throw checkError;
      }

      // Se já existe, retornar
      if (existing) {
        return existing.id;
      }

      // Se não existe, criar com o ID fornecido
      const { data: newConversation, error: insertError } = await this.supabase
        .getClient()
        .from('assistant_conversations')
        .insert({
          id: context.conversationId,
          user_id: context.userId,
          tenant_id: context.tenantId,
          school_id: context.schoolId || null,
          messages: [],
          title: 'Nova conversa', // Default title, will be updated with first message
        })
        .select('id')
        .single();

      if (insertError) {
        this.logger.error(
          `Error creating conversation with ID: ${insertError.message}`,
          insertError,
        );
        throw insertError;
      }

      this.logger.debug(
        `Created new conversation with provided ID: ${context.conversationId}`,
      );
      return newConversation.id;
    }

    // Se não há conversationId, buscar conversa recente ou criar nova
    const { data: existing, error: findError } = await this.supabase
      .getClient()
      .from('assistant_conversations')
      .select('id')
      .eq('user_id', context.userId)
      .eq('tenant_id', context.tenantId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (findError) {
      this.logger.error(
        `Error finding recent conversation: ${findError.message}`,
        findError,
      );
      throw findError;
    }

    if (existing) {
      return existing.id;
    }

    // Criar nova conversa
    const { data: newConversation, error: insertError } = await this.supabase
      .getClient()
      .from('assistant_conversations')
      .insert({
        user_id: context.userId,
        tenant_id: context.tenantId,
        school_id: context.schoolId || null,
        messages: [],
      })
      .select('id')
      .single();

    if (insertError) {
      this.logger.error(
        `Error creating conversation: ${insertError.message}`,
        insertError,
      );
      throw insertError;
    }

    return newConversation.id;
  }

  async saveMessages(
    context: ConversationContext,
    messages: Message[],
    options: MemoryOptions = {},
  ): Promise<void> {
    const conversationId = await this.getOrCreateConversation(context);

    // Recuperar mensagens existentes
    const existingMessages = await this.getMessages(context, options);

    // Converter mensagens para formato CoreMessage
    const coreMessages = this.messagesToCoreMessages(messages);

    // Combinar com mensagens existentes
    const allMessages = [...existingMessages, ...coreMessages];

    // Aplicar limites
    const maxMessages = options.maxMessages || this.MAX_MESSAGES;
    const limitedMessages = allMessages.slice(-maxMessages);

    // Converter de volta para formato de armazenamento
    const messagesToStore = this.coreMessagesToMessages(limitedMessages);

    // Salvar no Supabase
    const { error } = await this.supabase
      .getClient()
      .from('assistant_conversations')
      .update({
        messages: messagesToStore,
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('tenant_id', context.tenantId);

    if (error) {
      this.logger.error(`Error saving messages: ${error.message}`, error);
      throw error;
    }

    this.logger.debug(
      `Saved ${messages.length} messages to conversation ${conversationId}`,
    );
  }

  async getMessages(
    context: ConversationContext,
    options: MemoryOptions = {},
  ): Promise<ModelMessage[]> {
    const conversationId = await this.getOrCreateConversation(context);

    const { data, error } = await this.supabase
      .getClient()
      .from('assistant_conversations')
      .select('messages')
      .eq('id', conversationId)
      .eq('tenant_id', context.tenantId)
      .maybeSingle();

    if (error) {
      this.logger.error(`Error getting messages: ${error.message}`, error);
      throw error;
    }

    // Se não houver linha (data === null), retornar histórico vazio
    if (!data) {
      this.logger.debug(
        `No conversation found for ID ${conversationId}, returning empty history`,
      );
      return [];
    }

    const messages = (data?.messages as Message[]) || [];

    // Aplicar limites
    const maxMessages = options.maxMessages || this.MAX_MESSAGES;
    const limitedMessages = messages.slice(-maxMessages);

    return this.messagesToCoreMessages(limitedMessages);
  }

  async clearMessages(context: ConversationContext): Promise<void> {
    const conversationId = await this.getOrCreateConversation(context);

    const { error } = await this.supabase
      .getClient()
      .from('assistant_conversations')
      .update({
        messages: [],
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('tenant_id', context.tenantId);

    if (error) {
      this.logger.error(`Error clearing messages: ${error.message}`, error);
      throw error;
    }

    this.logger.debug(`Cleared messages from conversation ${conversationId}`);
  }

  async addMessage(
    context: ConversationContext,
    message: Message,
  ): Promise<void> {
    await this.saveMessages(context, [message]);
  }

  private messagesToCoreMessages(messages: Message[]): ModelMessage[] {
    return messages.map((msg) => {
      const modelMsg: ModelMessage = {
        role: msg.role,
        content: msg.content,
      } as ModelMessage;

      if (msg.name) {
        (modelMsg as any).name = msg.name;
      }

      if (msg.toolCallId) {
        (modelMsg as any).toolCallId = msg.toolCallId;
      }

      if (msg.toolCalls && msg.toolCalls.length > 0) {
        (modelMsg as any).toolCalls = msg.toolCalls.map((tc) => ({
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          args: tc.args,
        }));
      }

      return modelMsg;
    });
  }

  private coreMessagesToMessages(coreMessages: ModelMessage[]): Message[] {
    return coreMessages.map((msg, index) => {
      const message: Message = {
        id: `msg-${Date.now()}-${index}`,
        role: msg.role,
        content:
          typeof msg.content === 'string'
            ? msg.content
            : JSON.stringify(msg.content),
        timestamp: new Date().toISOString(),
      };

      if ((msg as any).name) {
        message.name = (msg as any).name;
      }

      if ((msg as any).toolCallId) {
        message.toolCallId = (msg as any).toolCallId;
      }

      if ((msg as any).toolCalls && (msg as any).toolCalls.length > 0) {
        message.toolCalls = (msg as any).toolCalls.map((tc: any) => ({
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          args: tc.args,
        }));

        // Also store as parts for UIMessage compatibility
        if (!message.parts) {
          message.parts = [];
        }
        message.parts.push(
          ...(msg as any).toolCalls.map((tc: any) => ({
            type: 'tool-call' as const,
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            args: tc.args,
          })),
        );
      }

      // Preserve reasoning if present
      if ((msg as any).reasoning) {
        if (!message.parts) {
          message.parts = [];
        }
        message.parts.push({
          type: 'reasoning' as const,
          reasoning: (msg as any).reasoning,
          reasoningText: (msg as any).reasoningText || '',
        });
      }

      return message;
    });
  }

  /**
   * Save UIMessage format (with parts) to memory
   * This preserves tool calls, reasoning, and approvals without lossy conversions
   */
  async saveUIMessages(
    context: ConversationContext,
    messages: Array<{
      id?: string;
      role: string;
      content?: any;
      parts?: any[];
      toolCalls?: any[];
      reasoning?: string;
      timestamp?: string;
    }>,
    options: MemoryOptions = {},
  ): Promise<void> {
    const conversationId = await this.getOrCreateConversation(context);

    // Get existing messages directly from DB (not converted)
    const { data: existing } = await this.supabase
      .getClient()
      .from('assistant_conversations')
      .select('messages')
      .eq('id', conversationId)
      .eq('tenant_id', context.tenantId)
      .maybeSingle();

    const existingMessages: any[] = (existing?.messages as any[]) || [];

    // Convert new UIMessages to storage format preserving parts
    const newMessages = messages.map((msg) => ({
      id: msg.id || `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      role: msg.role as MessageRole,
      content:
        typeof msg.content === 'string'
          ? msg.content
          : msg.content
            ? JSON.stringify(msg.content)
            : '',
      parts: msg.parts || [],
      toolCalls: msg.toolCalls || undefined,
      reasoning: msg.reasoning || undefined,
      timestamp: msg.timestamp || new Date().toISOString(),
    }));

    // Combine with existing messages
    const allMessages = [...existingMessages, ...newMessages];

    // Apply limits
    const maxMessages = options.maxMessages || this.MAX_MESSAGES;
    const limitedMessages = allMessages.slice(-maxMessages);

    // Generate title from first user message if this is the first save
    let title: string | undefined;
    if (existingMessages.length === 0) {
      const firstUserMessage = messages.find((m) => m.role === 'user');
      if (firstUserMessage) {
        const content =
          firstUserMessage.content ||
          firstUserMessage.parts?.find((p: any) => p?.type === 'text')?.text ||
          '';
        // Truncate to 60 chars for title
        title =
          content.length > 60 ? content.substring(0, 57) + '...' : content;
      }
    }

    // Save directly to Supabase
    const updateData: any = {
      messages: limitedMessages,
      updated_at: new Date().toISOString(),
    };

    // Update title if generated
    if (title) {
      updateData.title = title;
    }

    const { error } = await this.supabase
      .getClient()
      .from('assistant_conversations')
      .update(updateData)
      .eq('id', conversationId)
      .eq('tenant_id', context.tenantId);

    if (error) {
      this.logger.error(`Error saving UIMessages: ${error.message}`, error);
      throw error;
    }

    this.logger.debug(
      `Saved ${messages.length} UIMessages to conversation ${conversationId} (total: ${limitedMessages.length})`,
    );
  }
}

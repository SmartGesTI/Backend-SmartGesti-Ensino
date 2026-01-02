import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../../supabase/supabase.service';
import { LoggerService } from '../../../common/logger/logger.service';
import { LLMMessage } from '../../shared/llm/llm.types';

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
  timestamp: Date;
}

@Injectable()
export class ConversationService {
  private readonly maxHistoryLength = 20; // Últimas 20 mensagens

  constructor(
    private readonly supabase: SupabaseService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Cria uma nova conversa
   */
  async createConversation(
    userId: string,
    tenantId: string,
    schoolId?: string,
    title?: string,
  ): Promise<string> {
    try {
      const client = this.supabase.getClient();
      const { data, error } = await client
        .from('assistant_conversations')
        .insert({
          user_id: userId,
          tenant_id: tenantId,
          school_id: schoolId,
          messages: [],
          title: title || null,
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      return data.id;
    } catch (error: any) {
      this.logger.error(`Erro ao criar conversa: ${error.message}`, 'ConversationService');
      throw error;
    }
  }

  /**
   * Atualiza o título de uma conversa
   */
  async updateTitle(conversationId: string, title: string): Promise<void> {
    try {
      const client = this.supabase.getClient();
      const { error } = await client
        .from('assistant_conversations')
        .update({ title })
        .eq('id', conversationId);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      this.logger.error(`Erro ao atualizar título: ${error.message}`, 'ConversationService');
      throw error;
    }
  }

  /**
   * Adiciona uma mensagem à conversa
   */
  async addMessage(
    conversationId: string,
    message: ConversationMessage,
  ): Promise<void> {
    try {
      const client = this.supabase.getClient();
      
      // Buscar conversa atual
      const { data: conversation, error: fetchError } = await client
        .from('assistant_conversations')
        .select('messages')
        .eq('id', conversationId)
        .single();

      if (fetchError) {
        throw fetchError;
      }

      // Adicionar nova mensagem
      const messages = (conversation.messages || []) as ConversationMessage[];
      messages.push(message);

      // Limitar histórico (manter apenas últimas N mensagens)
      const limitedMessages = messages.slice(-this.maxHistoryLength);

      // Atualizar conversa
      const { error: updateError } = await client
        .from('assistant_conversations')
        .update({
          messages: limitedMessages,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId);

      if (updateError) {
        throw updateError;
      }
    } catch (error: any) {
      this.logger.error(`Erro ao adicionar mensagem: ${error.message}`, 'ConversationService');
      throw error;
    }
  }

  /**
   * Obtém histórico de uma conversa
   */
  async getHistory(conversationId: string): Promise<LLMMessage[]> {
    try {
      const client = this.supabase.getClient();
      const { data, error } = await client
        .from('assistant_conversations')
        .select('messages')
        .eq('id', conversationId)
        .single();

      if (error) {
        throw error;
      }

      const messages = (data.messages || []) as ConversationMessage[];

      // Converter para formato LLMMessage
      return messages.map((msg) => ({
        role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
        content: msg.content,
        tool_calls: msg.tool_calls,
        tool_call_id: msg.tool_call_id,
      }));
    } catch (error: any) {
      this.logger.error(`Erro ao obter histórico: ${error.message}`, 'ConversationService');
      return [];
    }
  }

  /**
   * Lista conversas do usuário
   */
  async listConversations(
    userId: string,
    tenantId: string,
    limit = 10,
  ): Promise<any[]> {
    try {
      const client = this.supabase.getClient();
      const { data, error } = await client
        .from('assistant_conversations')
        .select('id, created_at, updated_at, title, messages')
        .eq('user_id', userId)
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return (data || []).map((conv: any) => ({
        id: conv.id,
        createdAt: conv.created_at,
        updatedAt: conv.updated_at,
        title: conv.title || null,
        messageCount: (conv.messages || []).length,
        lastMessage: (conv.messages || []).slice(-1)[0]?.content || '',
      }));
    } catch (error: any) {
      this.logger.error(`Erro ao listar conversas: ${error.message}`, 'ConversationService');
      return [];
    }
  }

  /**
   * Deleta uma conversa
   */
  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    try {
      const client = this.supabase.getClient();
      const { error } = await client
        .from('assistant_conversations')
        .delete()
        .eq('id', conversationId)
        .eq('user_id', userId);

      if (error) {
        throw error;
      }
    } catch (error: any) {
      this.logger.error(`Erro ao deletar conversa: ${error.message}`, 'ConversationService');
      throw error;
    }
  }
}

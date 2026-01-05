import { Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { CoreSession } from '../session.types';
import { AgentInputItem } from '@openai/agents-core';

/**
 * Implementação de sessão com Supabase
 * Nota: Esta classe não é um provider do NestJS, é instanciada manualmente pela SessionFactory
 */
export class SupabaseSession implements CoreSession {
  private readonly logger = new Logger(SupabaseSession.name);
  private readonly supabase: SupabaseClient;
  private readonly conversationId: string;
  private readonly tenantId: string;

  constructor(
    supabase: SupabaseClient,
    conversationId: string,
    tenantId: string,
  ) {
    this.supabase = supabase;
    this.conversationId = conversationId;
    this.tenantId = tenantId;
  }

  async getSessionId(): Promise<string> {
    return this.conversationId;
  }

  async getItems(limit?: number): Promise<AgentInputItem[]> {
    try {
      const { data, error } = await this.supabase
        .from('rag_conversations')
        .select('messages')
        .eq('id', this.conversationId)
        .eq('tenant_id', this.tenantId)
        .single();

      if (error || !data) {
        this.logger.warn(
          `Conversa não encontrada: ${this.conversationId}`,
        );
        return [];
      }

      const items = (data.messages as AgentInputItem[]) || [];
      return limit ? items.slice(-limit) : items;
    } catch (error: any) {
      this.logger.error(
        `Erro ao obter itens da sessão: ${error.message}`,
      );
      return [];
    }
  }

  async addItems(items: AgentInputItem[]): Promise<void> {
    try {
      const { data: current } = await this.supabase
        .from('rag_conversations')
        .select('messages')
        .eq('id', this.conversationId)
        .eq('tenant_id', this.tenantId)
        .single();

      const updatedMessages = [
        ...((current?.messages as AgentInputItem[]) || []),
        ...items,
      ];

      await this.supabase
        .from('rag_conversations')
        .update({
          messages: updatedMessages,
          updated_at: new Date().toISOString(),
        })
        .eq('id', this.conversationId)
        .eq('tenant_id', this.tenantId);
    } catch (error: any) {
      this.logger.error(
        `Erro ao adicionar itens à sessão: ${error.message}`,
      );
      throw error;
    }
  }

  async popItem(): Promise<AgentInputItem | undefined> {
    try {
      const { data } = await this.supabase
        .from('rag_conversations')
        .select('messages')
        .eq('id', this.conversationId)
        .eq('tenant_id', this.tenantId)
        .single();

      if (!data || !data.messages || data.messages.length === 0) {
        return undefined;
      }

      const messages = data.messages as AgentInputItem[];
      const lastItem = messages[messages.length - 1];
      const updatedMessages = messages.slice(0, -1);

      await this.supabase
        .from('rag_conversations')
        .update({ messages: updatedMessages })
        .eq('id', this.conversationId)
        .eq('tenant_id', this.tenantId);

      return lastItem;
    } catch (error: any) {
      this.logger.error(
        `Erro ao remover item da sessão: ${error.message}`,
      );
      return undefined;
    }
  }

  async clear(): Promise<void> {
    try {
      await this.supabase
        .from('rag_conversations')
        .update({ messages: [] })
        .eq('id', this.conversationId)
        .eq('tenant_id', this.tenantId);
    } catch (error: any) {
      this.logger.error(
        `Erro ao limpar sessão: ${error.message}`,
      );
      throw error;
    }
  }

  async clearSession(): Promise<void> {
    await this.clear();
  }
}

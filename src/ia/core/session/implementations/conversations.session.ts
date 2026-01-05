import { Logger } from '@nestjs/common';
import {
  OpenAIConversationsSession,
  type OpenAIConversationsSessionOptions,
} from '@openai/agents';
import { CoreSession } from '../session.types';
import { AgentInputItem } from '@openai/agents-core';

/**
 * Implementação de sessão com OpenAI Conversations API
 * Nota: Esta classe não é um provider do NestJS, é instanciada manualmente pela SessionFactory
 */
export class ConversationsSession implements CoreSession {
  private readonly logger = new Logger(ConversationsSession.name);
  private session: OpenAIConversationsSession;

  constructor(
    options: OpenAIConversationsSessionOptions,
  ) {
    this.session = new OpenAIConversationsSession(options);
  }

  async getSessionId(): Promise<string> {
    return await this.session.getSessionId();
  }

  async getItems(limit?: number): Promise<AgentInputItem[]> {
    const items = await this.session.getItems();
    return limit ? items.slice(-limit) : items;
  }

  async addItems(items: AgentInputItem[]): Promise<void> {
    await this.session.addItems(items);
  }

  async popItem(): Promise<AgentInputItem | undefined> {
    return await this.session.popItem();
  }

  async clear(): Promise<void> {
    // OpenAI Conversations Session não tem método clear direto
    // Implementação seria específica da API
    this.logger.warn('Clear não implementado para ConversationsSession');
  }

  async clearSession(): Promise<void> {
    await this.clear();
  }
}

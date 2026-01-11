import { ModelMessage } from '@ai-sdk/provider-utils';
import { ConversationContext, Message, MemoryOptions } from './memory.types';

export interface IMemoryService {
  /**
   * Salva mensagens na memória
   */
  saveMessages(
    context: ConversationContext,
    messages: Message[],
    options?: MemoryOptions,
  ): Promise<void>;

  /**
   * Recupera mensagens da memória
   */
  getMessages(
    context: ConversationContext,
    options?: MemoryOptions,
  ): Promise<ModelMessage[]>;

  /**
   * Limpa mensagens da memória
   */
  clearMessages(context: ConversationContext): Promise<void>;

  /**
   * Adiciona uma mensagem à conversa
   */
  addMessage(context: ConversationContext, message: Message): Promise<void>;

  /**
   * Obtém ou cria uma conversa
   */
  getOrCreateConversation(context: ConversationContext): Promise<string>;
}

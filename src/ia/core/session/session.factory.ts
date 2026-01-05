import { Injectable, Logger } from '@nestjs/common';
import { SessionType, SessionConfig, CoreSession } from './session.types';
import { SessionRegistry } from './session.registry';
import { MemorySession } from './implementations/memory.session';
import { SupabaseSession } from './implementations/supabase.session';
import { ConversationsSession } from './implementations/conversations.session';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../../../supabase/supabase.service';

/**
 * Factory para criar sessões
 */
@Injectable()
export class SessionFactory {
  private readonly logger = new Logger(SessionFactory.name);

  constructor(
    private readonly sessionRegistry: SessionRegistry,
    private readonly supabaseService: SupabaseService,
  ) {
    this.registerDefaultFactories();
  }

  /**
   * Registra factories padrão
   */
  private registerDefaultFactories(): void {
    // Memory session
    this.sessionRegistry.register('memory', (config: SessionConfig) => {
      return new MemorySession(config);
    });

    // Supabase session
    this.sessionRegistry.register(
      'supabase',
      (config: SessionConfig & { supabase?: SupabaseClient }) => {
        const supabase = config.supabase || this.supabaseService.getClient();
        
        if (!config.conversationId) {
          throw new Error(
            'Conversation ID é obrigatório para sessão Supabase',
          );
        }
        if (!config.tenantId) {
          throw new Error('Tenant ID é obrigatório para sessão Supabase');
        }

        return new SupabaseSession(
          supabase,
          config.conversationId,
          config.tenantId,
        );
      },
    );

    // Conversations session
    this.sessionRegistry.register(
      'conversations',
      (config: SessionConfig & { apiKey?: string; conversationId?: string }) => {
        return new ConversationsSession({
          conversationId: config.conversationId,
          apiKey: config.apiKey,
        });
      },
    );
  }

  /**
   * Cria uma sessão do tipo especificado
   */
  async create(type: SessionType, config: SessionConfig): Promise<CoreSession> {
    return await this.sessionRegistry.create(type, config);
  }

  /**
   * Cria uma sessão em memória
   */
  createMemory(config?: SessionConfig): CoreSession {
    return new MemorySession(config);
  }

  /**
   * Cria uma sessão Supabase
   */
  createSupabase(
    supabase: SupabaseClient,
    conversationId: string,
    tenantId: string,
  ): CoreSession {
    return new SupabaseSession(supabase, conversationId, tenantId);
  }

  /**
   * Cria uma sessão OpenAI Conversations
   */
  createConversations(options: {
    conversationId?: string;
    apiKey?: string;
  }): CoreSession {
    return new ConversationsSession(options);
  }
}

import { Session, AgentInputItem } from '@openai/agents-core';

/**
 * Interface base para sessões do core
 */
export interface CoreSession extends Session {
  getSessionId(): Promise<string>;
  getItems(limit?: number): Promise<AgentInputItem[]>;
  addItems(items: AgentInputItem[]): Promise<void>;
  popItem(): Promise<AgentInputItem | undefined>;
  clear(): Promise<void>;
}

/**
 * Configuração para criar uma sessão
 */
export interface SessionConfig {
  conversationId?: string;
  tenantId?: string;
  schoolId?: string;
  userId?: string;
  [key: string]: any;
}

/**
 * Tipo de sessão disponível
 */
export type SessionType = 'memory' | 'supabase' | 'conversations';

/**
 * Factory function para criar sessões
 */
export type SessionFactory<T extends SessionConfig = SessionConfig> = (
  config: T,
) => Promise<CoreSession> | CoreSession;

/**
 * Metadados de uma sessão
 */
export interface SessionMetadata {
  type: SessionType;
  sessionId: string;
  createdAt: Date;
  updatedAt: Date;
  itemCount: number;
}

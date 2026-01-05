import { MemorySession as SDKMemorySession } from '@openai/agents-core';
import { CoreSession } from '../session.types';
import { SessionConfig } from '../session.types';

/**
 * Implementação de sessão em memória
 */
export class MemorySession implements CoreSession {
  private session: SDKMemorySession;

  constructor(config?: SessionConfig) {
    this.session = new SDKMemorySession();
  }

  async getSessionId(): Promise<string> {
    return 'memory-session';
  }

  async getItems(limit?: number): Promise<any[]> {
    const items = await this.session.getItems();
    return limit ? items.slice(-limit) : items;
  }

  async addItems(items: any[]): Promise<void> {
    await this.session.addItems(items);
  }

  async popItem(): Promise<any | undefined> {
    return await this.session.popItem();
  }

  async clear(): Promise<void> {
    // MemorySession não tem método clear, então recriamos
    this.session = new SDKMemorySession();
  }

  async clearSession(): Promise<void> {
    await this.clear();
  }
}

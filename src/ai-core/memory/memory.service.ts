import { Injectable } from '@nestjs/common';
import { IMemoryService } from './memory.interface';
import { SupabaseMemoryService } from './supabase-memory.service';

@Injectable()
export class MemoryService implements IMemoryService {
  constructor(private readonly supabaseMemory: SupabaseMemoryService) {}

  async saveMessages(
    context: any,
    messages: any[],
    options?: any,
  ): Promise<void> {
    return this.supabaseMemory.saveMessages(context, messages, options);
  }

  async getMessages(context: any, options?: any): Promise<any[]> {
    return this.supabaseMemory.getMessages(context, options);
  }

  async clearMessages(context: any): Promise<void> {
    return this.supabaseMemory.clearMessages(context);
  }

  async addMessage(context: any, message: any): Promise<void> {
    return this.supabaseMemory.addMessage(context, message);
  }

  async getOrCreateConversation(context: any): Promise<string> {
    return this.supabaseMemory.getOrCreateConversation(context);
  }

  /**
   * Save UIMessage format (with parts) to memory
   * This preserves tool calls, reasoning, and approvals without lossy conversions
   */
  async saveUIMessages(
    context: any,
    messages: any[],
    options?: any,
  ): Promise<void> {
    return this.supabaseMemory.saveUIMessages(context, messages, options);
  }
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * Enhanced Message type that supports UIMessage format with parts
 * Compatible with AI SDK UI protocol
 */
export interface Message {
  id?: string;
  role: MessageRole;
  content: string | Array<{ type: string; [key: string]: any }>; // Support parts array for UIMessage
  name?: string;
  toolCallId?: string;
  toolCalls?: Array<{
    toolCallId: string;
    toolName: string;
    args: any;
  }>;
  parts?: Array<{
    type:
      | 'text'
      | 'tool-call'
      | 'tool-result'
      | 'reasoning'
      | 'tool-approval-request'
      | 'tool-approval-response';
    [key: string]: any;
  }>;
  timestamp?: Date | string;
}

export interface ConversationMetadata {
  title?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface ConversationContext {
  tenantId: string;
  userId: string;
  schoolId?: string;
  conversationId?: string;
}

export interface MemoryOptions {
  maxMessages?: number;
  maxTokens?: number;
  compressHistory?: boolean;
}

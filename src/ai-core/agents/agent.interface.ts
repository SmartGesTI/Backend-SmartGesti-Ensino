import { ModelMessage } from '@ai-sdk/provider-utils';
import { Tool } from '@ai-sdk/provider-utils';
import { ConversationContext } from '../memory/memory.types';

export interface AgentConfig {
  name: string;
  description?: string;
  model?: string;
  provider?: 'openai' | 'anthropic' | 'google';
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  tools?: Record<string, Tool>;
  maxToolRoundtrips?: number;
}

export interface AgentContext extends ConversationContext {
  metadata?: Record<string, any>;
}

export interface AgentResult {
  text: string;
  messages: ModelMessage[];
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  toolCalls?: Array<{
    toolCallId: string;
    toolName: string;
    args: any;
    result?: any;
  }>;
}

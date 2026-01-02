/**
 * Tipos e interfaces compartilhadas para LLM
 */

export type LLMRole = 'system' | 'user' | 'assistant' | 'tool';

export interface LLMMessage {
  role: LLMRole;
  content: string | null;
  tool_calls?: LLMToolCall[];
  tool_call_id?: string;
  name?: string;
}

export interface LLMToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

export interface LLMTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>; // JSON Schema
  };
}

export interface LLMRequest {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  tools?: LLMTool[];
  tool_choice?: 'auto' | 'none' | 'required' | { type: 'function'; function: { name: string } };
  response_format?: {
    type: 'text' | 'json_object' | 'json_schema';
    json_schema?: {
      name: string;
      strict: boolean;
      schema: Record<string, any>;
    };
  };
  reasoning_effort?: 'minimal' | 'low' | 'medium' | 'high';
}

export interface LLMResponse {
  content: string;
  tool_calls?: LLMToolCall[];
  finish_reason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
}

export type StreamingEventType = 
  | 'token' 
  | 'tool_call' 
  | 'tool_call_delta'
  | 'tool_result' 
  | 'done' 
  | 'error'
  | 'usage'
  | 'thinking'; // Pensamentos/reasoning do modelo (GPT-5)

export interface StreamingEvent {
  type: StreamingEventType;
  data: any;
  timestamp?: number;
}

export interface StructuredOutput {
  schema: Record<string, any>; // JSON Schema
  name?: string;
  strict?: boolean;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: 'openai' | 'anthropic' | 'other';
  maxTokens: number;
  supportsStreaming: boolean;
  supportsFunctions: boolean;
  supportsStructuredOutputs: boolean;
  costPer1kTokens?: {
    input: number;
    output: number;
  };
}

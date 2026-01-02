/**
 * Tipos e interfaces compartilhadas para LLM
 * 
 * Atualizado para GPT 5.2 com suporte completo a reasoning
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

/**
 * Níveis de esforço de reasoning suportados pelo GPT 5.2
 * 
 * - none: Sem reasoning (resposta direta)
 * - minimal: Reasoning mínimo (gpt-5-nano suporta apenas este)
 * - low: Reasoning baixo
 * - medium: Reasoning médio (padrão para modelos antes do gpt-5.1)
 * - high: Reasoning alto (padrão para gpt-5-pro)
 * - xhigh: Reasoning extra alto (disponível após gpt-5.1-codex-max)
 */
export type ReasoningEffort = 'none' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh';

/**
 * Configuração de reasoning para requisições
 */
export interface ReasoningConfig {
  /** Nível de esforço de reasoning */
  effort: ReasoningEffort;
  /** Se deve mostrar o reasoning para o usuário */
  showToUser?: boolean;
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
  /** Nível de esforço de reasoning (GPT 5.2) */
  reasoning_effort?: ReasoningEffort;
  /** ID da resposta anterior para multi-turn com reasoning (GPT 5.2) */
  previous_response_id?: string;
}

/**
 * Item de reasoning retornado pelo modelo
 */
export interface ReasoningItem {
  id: string;
  type: 'reasoning';
  content: string[];
  summary?: string[];
}

export interface LLMResponse {
  content: string;
  tool_calls?: LLMToolCall[];
  finish_reason?: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    /** Tokens usados no reasoning (GPT 5.2) */
    reasoning_tokens?: number;
  };
  model?: string;
  /** ID da resposta para uso em multi-turn (GPT 5.2) */
  response_id?: string;
  /** Itens de reasoning retornados pelo modelo */
  reasoning?: ReasoningItem[];
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

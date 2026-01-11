export interface StreamEvent {
  type:
    | 'text'
    | 'reasoning'
    | 'tool-call'
    | 'tool-result'
    | 'error'
    | 'finish'
    | 'partial-object';
  data: any;
  timestamp: number;
}

export interface StreamOptions {
  model?: string;
  provider?: 'openai' | 'anthropic' | 'google';
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stopSequences?: string[];
  schema?: any; // Zod schema for structured output
  onFinish?: (result: any) => void;
  onError?: (error: Error) => void;
}

export interface StreamResult {
  text: string;
  finishReason: 'stop' | 'length' | 'tool-calls' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  object?: any; // Structured output object
  toolCalls?: Array<{
    toolCallId: string;
    toolName: string;
    args: any;
  }>;
}

export interface AssistantResponse {
  text: string;
  links?: Array<{
    label: string;
    url: string;
    type?: 'navigation' | 'external';
  }>;
  actions?: Array<{
    type: string;
    data: any;
  }>;
  metadata?: {
    toolsUsed?: string[];
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    model?: string;
  };
}

export interface StreamingEventDto {
  type: 'token' | 'tool_call' | 'tool_result' | 'done' | 'error' | 'usage';
  data: any;
  timestamp?: number;
}

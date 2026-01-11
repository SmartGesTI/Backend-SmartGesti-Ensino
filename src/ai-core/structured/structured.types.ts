import { z } from 'zod';

export interface StructuredOutputOptions {
  model?: string;
  provider?: 'openai' | 'anthropic' | 'google';
  temperature?: number;
  maxTokens?: number;
  schema: z.ZodSchema;
}

export interface StructuredOutputResult<T = any> {
  object: T;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'error';
}

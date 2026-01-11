import { z } from 'zod';
import { Tool } from '@ai-sdk/provider-utils';

export interface ITool {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute: (args: any, context?: any) => Promise<any>;
}

export interface ToolContext {
  tenantId?: string;
  userId?: string;
  schoolId?: string;
  [key: string]: any;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodSchema;
  execute: (args: any, context?: ToolContext) => Promise<any>;
}

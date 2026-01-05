import { z } from 'zod';
import { Tool as SDKTool } from '@openai/agents-core';
import { CoreRunContext, CoreContext } from '../context/context.types';

/**
 * Interface base para tools do core
 */
export interface CoreTool<TContext extends CoreContext = CoreContext> {
  name: string;
  description: string;
  parameters: z.ZodType<any>;
  execute: (
    params: any,
    runContext: CoreRunContext<TContext>,
  ) => Promise<any>;
  category?: string;
  tags?: string[];
  version?: string;
}

/**
 * Configuração para criar uma tool
 */
export interface CoreToolConfig<TContext extends CoreContext = CoreContext> {
  name: string;
  description: string;
  parameters: z.ZodType<any>;
  execute: (
    params: any,
    runContext: CoreRunContext<TContext>,
  ) => Promise<any>;
  category?: string;
  tags?: string[];
  version?: string;
}

/**
 * Tool adaptada para o SDK
 */
export type SDKToolAdapter<TContext = any> = SDKTool<TContext>;

/**
 * Metadados de uma tool
 */
export interface ToolMetadata {
  name: string;
  description: string;
  category?: string;
  tags?: string[];
  version?: string;
  registeredAt: Date;
}

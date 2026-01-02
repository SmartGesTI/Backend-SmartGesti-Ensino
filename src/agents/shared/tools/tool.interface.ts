/**
 * Interface base para todas as tools
 */

export interface ToolContext {
  userId: string;
  tenantId: string;
  schoolId?: string;
  permissions?: any;
  supabaseId?: string;
}

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema
  execute(params: any, context: ToolContext): Promise<any>;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}

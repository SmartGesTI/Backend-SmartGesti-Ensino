/**
 * Interface base para todas as tools
 */

export interface ToolContext {
  userId: string;
  tenantId: string;
  schoolId?: string;
  permissions?: any;
  supabaseId?: string;

  // Contexto de URL - usado para construir links dinamicamente
  schoolSlug?: string;
  tenantSubdomain?: string;
  requestOrigin?: string; // Origin da requisição HTTP (ex: "http://magistral.localhost:5173")
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

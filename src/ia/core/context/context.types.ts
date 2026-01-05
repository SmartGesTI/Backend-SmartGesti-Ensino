import { RunContext } from '@openai/agents-core';

/**
 * Contexto base para todos os agentes e tools
 */
export interface CoreContext {
  tenantId: string;
  schoolId?: string;
  userId: string;
  supabaseId?: string;
  schoolSlug?: string;
  tenantSubdomain?: string;
  requestOrigin?: string;
  permissions?: any;
  [key: string]: any;
}

/**
 * Tipo para contexto estendido com serviços
 */
export interface ExtendedContext<T = any> extends CoreContext {
  [key: string]: any;
}

/**
 * Tipo para RunContext do SDK com nosso contexto customizado
 */
export type CoreRunContext<T extends CoreContext = CoreContext> = RunContext<T>;

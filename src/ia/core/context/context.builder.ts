import { Injectable, Logger } from '@nestjs/common';
import { CoreContext, ExtendedContext } from './context.types';

/**
 * Builder para construção de contexto
 */
@Injectable()
export class ContextBuilder {
  private readonly logger = new Logger(ContextBuilder.name);

  /**
   * Constrói um contexto base
   */
  buildBaseContext(
    tenantId: string,
    userId: string,
    options?: {
      schoolId?: string;
      supabaseId?: string;
      schoolSlug?: string;
      tenantSubdomain?: string;
      requestOrigin?: string;
      permissions?: any;
    },
  ): CoreContext {
    return {
      tenantId,
      userId,
      schoolId: options?.schoolId,
      supabaseId: options?.supabaseId,
      schoolSlug: options?.schoolSlug,
      tenantSubdomain: options?.tenantSubdomain,
      requestOrigin: options?.requestOrigin,
      permissions: options?.permissions,
    };
  }

  /**
   * Estende um contexto com serviços adicionais
   */
  extendContext<T extends CoreContext>(
    baseContext: T,
    services: Record<string, any>,
  ): ExtendedContext<T> {
    return {
      ...baseContext,
      ...services,
    };
  }

  /**
   * Merge de múltiplos contextos
   */
  mergeContexts(...contexts: Partial<CoreContext>[]): CoreContext {
    const merged: CoreContext = {
      tenantId: '',
      userId: '',
    };

    for (const context of contexts) {
      Object.assign(merged, context);
    }

    // Validação básica
    if (!merged.tenantId || !merged.userId) {
      throw new Error(
        'Contexto deve ter tenantId e userId. Use buildBaseContext primeiro.',
      );
    }

    return merged;
  }

  /**
   * Valida um contexto
   */
  validateContext(context: Partial<CoreContext>): boolean {
    return !!(context.tenantId && context.userId);
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { CoreContext, ExtendedContext } from './context.types';
import { ContextBuilder } from './context.builder';

/**
 * Provider centralizado de contexto
 */
@Injectable()
export class ContextProvider {
  private readonly logger = new Logger(ContextProvider.name);
  private readonly contextCache: Map<string, CoreContext> = new Map();

  constructor(private readonly contextBuilder: ContextBuilder) {}

  /**
   * Obtém ou cria um contexto para um tenant/school
   */
  getContext(
    tenantId: string,
    userId: string,
    options?: {
      schoolId?: string;
      supabaseId?: string;
      schoolSlug?: string;
      tenantSubdomain?: string;
      requestOrigin?: string;
      permissions?: any;
      services?: Record<string, any>;
    },
  ): ExtendedContext {
    const cacheKey = this.getCacheKey(tenantId, options?.schoolId, userId);

    // Verificar cache
    let context = this.contextCache.get(cacheKey);

    if (!context) {
      // Criar novo contexto
      context = this.contextBuilder.buildBaseContext(tenantId, userId, options);

      // Estender com serviços se fornecidos
      if (options?.services) {
        context = this.contextBuilder.extendContext(context, options.services);
      }

      // Cachear contexto
      this.contextCache.set(cacheKey, context);
      this.logger.debug(`Contexto criado e cacheado: ${cacheKey}`);
    } else {
      // Atualizar contexto existente com novos serviços se fornecidos
      if (options?.services) {
        context = this.contextBuilder.extendContext(context, options.services);
        this.contextCache.set(cacheKey, context);
      }
    }

    return context as ExtendedContext;
  }

  /**
   * Estende um contexto existente com serviços
   */
  extendContext(
    context: CoreContext,
    services: Record<string, any>,
  ): ExtendedContext {
    return this.contextBuilder.extendContext(context, services);
  }

  /**
   * Limpa o cache de contexto
   */
  clearCache(tenantId?: string, schoolId?: string): void {
    if (tenantId) {
      const keysToDelete: string[] = [];
      for (const key of this.contextCache.keys()) {
        if (key.startsWith(`${tenantId}:${schoolId || ''}:`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach((key) => this.contextCache.delete(key));
      this.logger.debug(
        `Cache limpo para tenant: ${tenantId}, school: ${schoolId || 'all'}`,
      );
    } else {
      this.contextCache.clear();
      this.logger.debug('Cache de contexto completamente limpo');
    }
  }

  /**
   * Gera chave de cache
   */
  private getCacheKey(
    tenantId: string,
    schoolId: string | undefined,
    userId: string,
  ): string {
    return `${tenantId}:${schoolId || 'global'}:${userId}`;
  }
}

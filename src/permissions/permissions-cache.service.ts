import { Injectable } from '@nestjs/common';

/**
 * Interface para dados cacheados de permissões
 */
export interface CachedPermissions {
  userId: string;
  isOwner: boolean;
  permissions: Record<string, string[]>;
  permissionsVersion: string;
  cachedAt: number;
}

/**
 * Interface para contexto da request (cache por request)
 */
export interface RequestPermissionContext {
  userId?: string;
  isOwner?: boolean;
  permissions?: Record<string, string[]>;
  permissionsVersion?: string;
}

/**
 * Serviço de cache de permissões
 * - Cache em memória com TTL de 5 minutos
 * - Invalidação automática por permissions_version
 */
@Injectable()
export class PermissionsCacheService {
  // Cache global (entre requests) - Map<cacheKey, CachedPermissions>
  private readonly cache = new Map<string, CachedPermissions>();
  
  // TTL do cache em ms (5 minutos)
  private readonly CACHE_TTL = 5 * 60 * 1000;
  
  // Intervalo de limpeza do cache (10 minutos)
  private readonly CLEANUP_INTERVAL = 10 * 60 * 1000;

  constructor() {
    // Limpar cache expirado periodicamente
    setInterval(() => this.cleanupExpiredCache(), this.CLEANUP_INTERVAL);
  }

  /**
   * Gera chave de cache única
   */
  private getCacheKey(supabaseId: string, tenantId: string): string {
    return `${supabaseId}:${tenantId}`;
  }

  /**
   * Obtém permissões do cache
   * @returns Dados cacheados ou null se não existe/expirou/versão mudou
   */
  get(
    supabaseId: string,
    tenantId: string,
    currentVersion?: string,
  ): CachedPermissions | null {
    const key = this.getCacheKey(supabaseId, tenantId);
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    // Verificar TTL
    const now = Date.now();
    if (now - cached.cachedAt > this.CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    // Verificar versão (se fornecida)
    if (currentVersion && cached.permissionsVersion !== currentVersion) {
      this.cache.delete(key);
      return null;
    }

    return cached;
  }

  /**
   * Armazena permissões no cache
   */
  set(
    supabaseId: string,
    tenantId: string,
    data: {
      userId: string;
      isOwner: boolean;
      permissions: Record<string, string[]>;
      permissionsVersion: string;
    },
  ): void {
    const key = this.getCacheKey(supabaseId, tenantId);
    this.cache.set(key, {
      ...data,
      cachedAt: Date.now(),
    });
  }

  /**
   * Invalida cache de um usuário específico
   */
  invalidate(supabaseId: string, tenantId?: string): void {
    if (tenantId) {
      // Invalidar apenas para tenant específico
      const key = this.getCacheKey(supabaseId, tenantId);
      this.cache.delete(key);
    } else {
      // Invalidar todos os tenants do usuário
      const prefix = `${supabaseId}:`;
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key);
        }
      }
    }
  }

  /**
   * Limpa todo o cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Remove entradas expiradas do cache
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now - cached.cachedAt > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Estatísticas do cache (para debug)
   */
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

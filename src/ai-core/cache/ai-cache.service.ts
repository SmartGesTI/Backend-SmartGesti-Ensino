import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { CacheEntry, CacheOptions } from './cache.types';
import { AiCoreConfigService } from '../config/ai-core.config';

@Injectable()
export class AiCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(AiCacheService.name);
  private readonly cache: Map<string, CacheEntry> = new Map();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(private readonly aiConfig: AiCoreConfigService) {
    // Limpar cache expirado a cada 5 minutos
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 5 * 60 * 1000);
  }

  /**
   * Obtém valor do cache
   */
  get<T = any>(key: string, tenantId?: string): T | undefined {
    const cacheKey = this.buildKey(key, tenantId);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      return undefined;
    }

    return entry.value as T;
  }

  /**
   * Define valor no cache
   */
  set<T = any>(key: string, value: T, options: CacheOptions = {}): void {
    if (!this.aiConfig.isCacheEnabled()) {
      return;
    }

    const ttl = options.ttl || this.aiConfig.getCacheTtl();
    const expiresAt = Date.now() + ttl * 1000;
    const cacheKey = this.buildKey(key, options.tenantId);

    this.cache.set(cacheKey, {
      key: cacheKey,
      value,
      expiresAt,
      tenantId: options.tenantId,
    });

    this.logger.debug(`Cached value for key: ${cacheKey}`);
  }

  /**
   * Remove valor do cache
   */
  delete(key: string, tenantId?: string): void {
    const cacheKey = this.buildKey(key, tenantId);
    this.cache.delete(cacheKey);
  }

  /**
   * Limpa todo o cache (ou apenas de um tenant)
   */
  clear(tenantId?: string): void {
    if (tenantId) {
      // Limpar apenas cache do tenant
      for (const [key, entry] of this.cache.entries()) {
        if (entry.tenantId === tenantId) {
          this.cache.delete(key);
        }
      }
    } else {
      // Limpar tudo
      this.cache.clear();
    }
  }

  /**
   * Verifica se uma chave existe no cache
   */
  has(key: string, tenantId?: string): boolean {
    const cacheKey = this.buildKey(key, tenantId);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      return false;
    }

    return true;
  }

  /**
   * Constrói chave de cache com isolamento por tenant
   */
  private buildKey(key: string, tenantId?: string): string {
    return tenantId ? `${tenantId}:${key}` : key;
  }

  /**
   * Remove entradas expiradas do cache
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned up ${cleaned} expired cache entries`);
    }
  }

  /**
   * Limpa recursos ao destruir o serviço
   */
  onModuleDestroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

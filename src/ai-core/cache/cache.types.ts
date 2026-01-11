export interface CacheEntry<T = any> {
  key: string;
  value: T;
  expiresAt: number;
  tenantId?: string;
}

export interface CacheOptions {
  ttl?: number; // Time to live em segundos
  tenantId?: string; // Para isolamento multi-tenant
}

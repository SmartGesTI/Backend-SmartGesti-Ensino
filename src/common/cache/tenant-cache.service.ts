import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';

/**
 * Interface para dados cacheados de tenant
 */
export interface CachedTenant {
  id: string;
  subdomain: string;
  cachedAt: number;
}

/**
 * Interface para dados cacheados de escola
 */
export interface CachedSchool {
  id: string;
  slug: string;
  tenantId: string;
  cachedAt: number;
}

/**
 * Serviço de cache para conversão de subdomain/slug para UUID
 * - Cache em memória com TTL longo (subdomínios raramente mudam)
 * - Evita queries repetidas ao banco para converter identificadores
 */
@Injectable()
export class TenantCacheService {
  // Cache de tenants: subdomain -> CachedTenant
  private readonly tenantCache = new Map<string, CachedTenant>();
  
  // Cache de escolas: `${tenantId}:${slug}` -> CachedSchool
  private readonly schoolCache = new Map<string, CachedSchool>();
  
  // TTL do cache em ms (1 hora - subdomínios raramente mudam)
  private readonly CACHE_TTL = 60 * 60 * 1000;

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Obtém UUID do tenant pelo subdomain (com cache)
   * @returns UUID do tenant ou null se não encontrado
   */
  async getTenantId(subdomain: string): Promise<string | null> {
    // Verificar se já é UUID
    if (this.isUuid(subdomain)) {
      return subdomain;
    }

    // Verificar cache
    const cached = this.tenantCache.get(subdomain);
    if (cached && !this.isExpired(cached.cachedAt)) {
      console.log('[TenantCacheService] Tenant cache HIT:', subdomain);
      return cached.id;
    }

    console.log('[TenantCacheService] Tenant cache MISS:', subdomain);

    // Buscar no banco
    const { data, error } = await this.supabase.getClient()
      .from('tenants')
      .select('id, subdomain')
      .eq('subdomain', subdomain)
      .single();

    if (error || !data) {
      console.error('[TenantCacheService] Tenant não encontrado:', subdomain);
      return null;
    }

    // Armazenar no cache
    this.tenantCache.set(subdomain, {
      id: data.id,
      subdomain: data.subdomain,
      cachedAt: Date.now(),
    });

    return data.id;
  }

  /**
   * Obtém UUID da escola pelo slug (com cache)
   * @param tenantId - UUID do tenant (já resolvido)
   * @param slug - Slug da escola
   * @returns UUID da escola ou null se não encontrado
   */
  async getSchoolId(tenantId: string, slug: string): Promise<string | null> {
    // Verificar se já é UUID
    if (this.isUuid(slug)) {
      return slug;
    }

    const cacheKey = `${tenantId}:${slug}`;
    
    // Verificar cache
    const cached = this.schoolCache.get(cacheKey);
    if (cached && !this.isExpired(cached.cachedAt)) {
      console.log('[TenantCacheService] School cache HIT:', cacheKey);
      return cached.id;
    }

    console.log('[TenantCacheService] School cache MISS:', cacheKey);

    // Buscar no banco
    const { data, error } = await this.supabase.getClient()
      .from('schools')
      .select('id, slug, tenant_id')
      .eq('tenant_id', tenantId)
      .eq('slug', slug)
      .single();

    if (error || !data) {
      console.error('[TenantCacheService] School não encontrada:', cacheKey);
      return null;
    }

    // Armazenar no cache
    this.schoolCache.set(cacheKey, {
      id: data.id,
      slug: data.slug,
      tenantId: data.tenant_id,
      cachedAt: Date.now(),
    });

    return data.id;
  }

  /**
   * Resolve tenant e escola de uma vez (otimizado)
   * @returns { tenantId, schoolId } ou null se tenant não encontrado
   */
  async resolveContext(
    subdomainOrTenantId: string,
    slugOrSchoolId?: string,
  ): Promise<{ tenantId: string; schoolId?: string } | null> {
    // Resolver tenant
    const tenantId = await this.getTenantId(subdomainOrTenantId);
    if (!tenantId) {
      return null;
    }

    // Resolver escola (se fornecida)
    let schoolId: string | undefined;
    if (slugOrSchoolId) {
      const resolvedSchoolId = await this.getSchoolId(tenantId, slugOrSchoolId);
      schoolId = resolvedSchoolId || undefined;
    }

    return { tenantId, schoolId };
  }

  /**
   * Invalida cache de um tenant específico
   */
  invalidateTenant(subdomain: string): void {
    this.tenantCache.delete(subdomain);
    
    // Também invalidar escolas desse tenant
    for (const [key, school] of this.schoolCache.entries()) {
      const cached = this.tenantCache.get(subdomain);
      if (cached && school.tenantId === cached.id) {
        this.schoolCache.delete(key);
      }
    }
  }

  /**
   * Invalida cache de uma escola específica
   */
  invalidateSchool(tenantId: string, slug: string): void {
    this.schoolCache.delete(`${tenantId}:${slug}`);
  }

  /**
   * Limpa todo o cache
   */
  clear(): void {
    this.tenantCache.clear();
    this.schoolCache.clear();
  }

  /**
   * Verifica se é UUID válido
   */
  private isUuid(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }

  /**
   * Verifica se o cache expirou
   */
  private isExpired(cachedAt: number): boolean {
    return Date.now() - cachedAt > this.CACHE_TTL;
  }

  /**
   * Estatísticas do cache (para debug)
   */
  getStats(): { tenants: number; schools: number } {
    return {
      tenants: this.tenantCache.size,
      schools: this.schoolCache.size,
    };
  }
}

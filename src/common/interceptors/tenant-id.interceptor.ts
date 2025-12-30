import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { SupabaseService } from '../../supabase/supabase.service';

/**
 * Interceptor que converte subdomain para UUID do tenant
 * Modifica o header x-tenant-id automaticamente
 */
@Injectable()
export class TenantIdInterceptor implements NestInterceptor {
  constructor(private readonly supabase: SupabaseService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const tenantIdOrSubdomain = request.headers['x-tenant-id'];

    console.log('[TenantIdInterceptor] Interceptando request:', {
      originalTenantId: tenantIdOrSubdomain,
      url: request.url,
      method: request.method,
    });

    if (tenantIdOrSubdomain) {
      // Verificar se já é um UUID válido
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (!uuidRegex.test(tenantIdOrSubdomain)) {
        console.log('[TenantIdInterceptor] Convertendo subdomain para UUID:', tenantIdOrSubdomain);
        
        // Se não for UUID, assumir que é subdomain e buscar UUID
        const { data: tenant, error } = await this.supabase.getClient()
          .from('tenants')
          .select('id')
          .eq('subdomain', tenantIdOrSubdomain)
          .single();

        if (error || !tenant) {
          console.error('[TenantIdInterceptor] Erro ao buscar tenant:', {
            subdomain: tenantIdOrSubdomain,
            error: error?.message,
          });
          throw new BadRequestException(
            `Tenant não encontrado: ${tenantIdOrSubdomain}`
          );
        }

        console.log('[TenantIdInterceptor] Tenant encontrado, convertendo:', {
          subdomain: tenantIdOrSubdomain,
          uuid: tenant.id,
        });

        // Substituir o header com o UUID
        request.headers['x-tenant-id'] = tenant.id;
      } else {
        console.log('[TenantIdInterceptor] TenantId já é UUID, mantendo:', tenantIdOrSubdomain);
      }
    }

    console.log('[TenantIdInterceptor] Header final x-tenant-id:', request.headers['x-tenant-id']);

    return next.handle();
  }
}

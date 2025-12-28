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

    if (tenantIdOrSubdomain) {
      // Verificar se já é um UUID válido
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      
      if (!uuidRegex.test(tenantIdOrSubdomain)) {
        // Se não for UUID, assumir que é subdomain e buscar UUID
        const { data: tenant, error } = await this.supabase.getClient()
          .from('tenants')
          .select('id')
          .eq('subdomain', tenantIdOrSubdomain)
          .single();

        if (error || !tenant) {
          throw new BadRequestException(
            `Tenant não encontrado: ${tenantIdOrSubdomain}`
          );
        }

        // Substituir o header com o UUID
        request.headers['x-tenant-id'] = tenant.id;
      }
    }

    return next.handle();
  }
}

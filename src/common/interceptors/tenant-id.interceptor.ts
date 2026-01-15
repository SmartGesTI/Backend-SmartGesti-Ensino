import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  BadRequestException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { TenantCacheService } from '../cache/tenant-cache.service';

/**
 * Interceptor que converte subdomain para UUID do tenant
 * Modifica o header x-tenant-id automaticamente
 * USA CACHE para evitar queries repetidas
 */
@Injectable()
export class TenantIdInterceptor implements NestInterceptor {
  constructor(private readonly tenantCache: TenantCacheService) {}

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
      // Usar cache para converter subdomain -> UUID
      const tenantId = await this.tenantCache.getTenantId(tenantIdOrSubdomain);

      if (!tenantId) {
        throw new BadRequestException(
          `Tenant não encontrado: ${tenantIdOrSubdomain}`,
        );
      }

      // Substituir o header com o UUID (pode ser o mesmo se já era UUID)
      request.headers['x-tenant-id'] = tenantId;
    }

    console.log(
      '[TenantIdInterceptor] Header final x-tenant-id:',
      request.headers['x-tenant-id'],
    );

    return next.handle();
  }
}

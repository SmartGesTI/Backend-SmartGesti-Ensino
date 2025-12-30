import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from '../permissions.service';
import { SupabaseService } from '../../supabase/supabase.service';
import {
  PERMISSION_KEY,
  PermissionRequirement,
} from '../decorators/require-permission.decorator';
import { ROLE_KEY } from '../decorators/require-permission.decorator';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionsService: PermissionsService,
    private supabase: SupabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Obter requisitos de permissão do decorator
    const permissionRequirement = this.reflector.getAllAndOverride<
      PermissionRequirement
    >(PERMISSION_KEY, [context.getHandler(), context.getClass()]);

    const requiredRole = this.reflector.getAllAndOverride<string>(ROLE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Se não há requisitos, permitir acesso
    if (!permissionRequirement && !requiredRole) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Usuário não autenticado');
    }

    // Obter contexto do tenant e escola
    let tenantId = request.headers['x-tenant-id'] || request.query.tenantId;
    const schoolId = request.params.schoolId || request.query.schoolId;

    console.log('[PermissionGuard] Contexto obtido (antes da conversão):', {
      tenantIdFromHeader: request.headers['x-tenant-id'],
      tenantIdFromQuery: request.query.tenantId,
      tenantIdFinal: tenantId,
      schoolId,
      userSub: user.sub,
    });

    if (!tenantId) {
      throw new ForbiddenException('Tenant não especificado');
    }

    // Se o tenantId não é UUID, converter subdomain para UUID
    // (fallback caso o TenantIdInterceptor não tenha executado)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
      console.log('[PermissionGuard] Convertendo subdomain para UUID (fallback):', tenantId);
      const { data: tenant, error } = await this.supabase
        .getClient()
        .from('tenants')
        .select('id')
        .eq('subdomain', tenantId)
        .single();

      if (error || !tenant) {
        console.error('[PermissionGuard] Erro ao buscar tenant:', {
          subdomain: tenantId,
          error: error?.message,
        });
        throw new ForbiddenException(`Tenant não encontrado: ${tenantId}`);
      }

      tenantId = tenant.id;
      // Atualizar o header também para que outros guards/interceptors vejam o UUID
      request.headers['x-tenant-id'] = tenant.id;
      console.log('[PermissionGuard] Subdomain convertido para UUID:', {
        subdomainOriginal: request.headers['x-tenant-id'],
        uuid: tenantId,
      });
    }

    // Verificar cargo específico se necessário
    if (requiredRole) {
      // user.sub é o UUID do Supabase (supabaseId)
      const supabaseId = user.sub;
      
      if (!supabaseId) {
        throw new ForbiddenException('Token inválido: sub não encontrado');
      }

      const hasRole = await this.permissionsService.hasRole(
        supabaseId,
        requiredRole,
        tenantId,
        schoolId,
      );

      if (!hasRole) {
        // Se não tem o cargo, verificar se é owner (owners têm acesso a tudo)
        const isOwner = await this.permissionsService.isOwner(supabaseId, tenantId);
        if (!isOwner) {
          throw new ForbiddenException(
            `Cargo '${requiredRole}' necessário para esta ação`,
          );
        }
      }
    }

    // Verificar permissão específica se necessário
    if (permissionRequirement) {
      // user.sub é o UUID do Supabase (supabaseId)
      // user.id pode não existir (depende do guard usado)
      const supabaseId = user.sub;
      
      if (!supabaseId) {
        throw new ForbiddenException('Token inválido: sub não encontrado');
      }

      // PRIMEIRO: Verificar se é owner (owners têm acesso a tudo)
      // Isso evita chamar checkPermission desnecessariamente
      const isOwner = await this.permissionsService.isOwner(supabaseId, tenantId);
      
      console.log('[PermissionGuard] Verificando permissão:', {
        supabaseId,
        resource: permissionRequirement.resource,
        action: permissionRequirement.action,
        tenantId,
        schoolId,
        isOwner,
      });

      if (isOwner) {
        console.log('[PermissionGuard] Usuário é owner, permitindo acesso imediatamente');
        return true;
      }

      const hasPermission = await this.permissionsService.checkPermission(
        supabaseId,
        permissionRequirement.resource,
        permissionRequirement.action,
        {
          userId: user.id || supabaseId, // UUID do banco para contexto (fallback para supabaseId)
          tenantId,
          schoolId,
        },
      );

      console.log('[PermissionGuard] Resultado verificação:', {
        hasPermission,
        supabaseId,
        resource: permissionRequirement.resource,
        action: permissionRequirement.action,
        isOwner,
      });

      if (!hasPermission) {
        throw new ForbiddenException(
          `Permissão negada: ${permissionRequirement.action} em ${permissionRequirement.resource}`,
        );
      }
    }

    return true;
  }
}

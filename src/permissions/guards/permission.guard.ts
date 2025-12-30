import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService, PermissionContextResult } from '../permissions.service';
import { TenantCacheService } from '../../common/cache/tenant-cache.service';
import {
  PERMISSION_KEY,
  PermissionRequirement,
} from '../decorators/require-permission.decorator';
import { ROLE_KEY } from '../decorators/require-permission.decorator';

// Chave para armazenar contexto de permissões na request
export const PERMISSION_CONTEXT_KEY = 'permissionContext';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionsService: PermissionsService,
    private tenantCache: TenantCacheService,
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

    // Converter subdomain para UUID usando cache (Guard executa ANTES do Interceptor)
    const resolvedTenantId = await this.tenantCache.getTenantId(tenantId);
    if (!resolvedTenantId) {
      throw new ForbiddenException(`Tenant não encontrado: ${tenantId}`);
    }
    
    // Atualizar tenantId e header para uso posterior
    tenantId = resolvedTenantId;
    request.headers['x-tenant-id'] = resolvedTenantId;

    // OTIMIZAÇÃO: Obter contexto de permissões de uma vez (com cache)
    const supabaseId = user.sub;
    if (!supabaseId) {
      throw new ForbiddenException('Token inválido: sub não encontrado');
    }

    // Buscar contexto completo (usa cache automaticamente)
    const permContext = await this.permissionsService.getPermissionContext(
      supabaseId,
      tenantId,
      schoolId,
    );

    if (!permContext) {
      throw new ForbiddenException('Usuário não encontrado');
    }

    // Armazenar contexto na request para uso pelos services
    request[PERMISSION_CONTEXT_KEY] = permContext;

    console.log('[PermissionGuard] Contexto de permissões:', {
      userId: permContext.userId,
      isOwner: permContext.isOwner,
      hasPermissions: Object.keys(permContext.permissions).length > 0,
    });

    // Se é owner, permitir acesso imediatamente
    if (permContext.isOwner) {
      console.log('[PermissionGuard] Usuário é owner, permitindo acesso imediatamente');
      return true;
    }

    // Verificar cargo específico se necessário
    if (requiredRole) {
      const hasRole = await this.permissionsService.hasRole(
        supabaseId,
        requiredRole,
        tenantId,
        schoolId,
      );

      if (!hasRole) {
        throw new ForbiddenException(
          `Cargo '${requiredRole}' necessário para esta ação`,
        );
      }
    }

    // Verificar permissão específica se necessário
    if (permissionRequirement) {
      const { resource, action } = permissionRequirement;
      const permissions = permContext.permissions;

      // Verificar permissão usando dados já carregados
      const hasPermission = 
        permissions['*']?.includes('*') ||
        permissions['*']?.includes(action) ||
        permissions[resource]?.includes(action) ||
        permissions[resource]?.includes('*') ||
        permissions[resource]?.includes('manage');

      console.log('[PermissionGuard] Verificando permissão:', {
        resource,
        action,
        hasPermission,
      });

      if (!hasPermission) {
        throw new ForbiddenException(
          `Permissão negada: ${action} em ${resource}`,
        );
      }
    }

    return true;
  }
}

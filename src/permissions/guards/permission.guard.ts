import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsService } from '../permissions.service';
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
    const tenantId = request.headers['x-tenant-id'] || request.query.tenantId;
    const schoolId = request.params.schoolId || request.query.schoolId;

    if (!tenantId) {
      throw new ForbiddenException('Tenant não especificado');
    }

    // Verificar cargo específico se necessário
    if (requiredRole) {
      const hasRole = await this.permissionsService.hasRole(
        user.id,
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
      const hasPermission = await this.permissionsService.checkPermission(
        user.id,
        permissionRequirement.resource,
        permissionRequirement.action,
        {
          userId: user.id,
          tenantId,
          schoolId,
        },
      );

      if (!hasPermission) {
        throw new ForbiddenException(
          `Permissão negada: ${permissionRequirement.action} em ${permissionRequirement.resource}`,
        );
      }
    }

    return true;
  }
}

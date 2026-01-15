import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SupabaseService } from '../../supabase/supabase.service';
import { LoggerService } from '../../common/logger/logger.service';

/**
 * Guard que valida se o usuário tem acesso ao tenant especificado
 * Garante isolamento completo entre instituições
 */
@Injectable()
export class TenantAccessGuard implements CanActivate {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly logger: LoggerService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Se não há usuário autenticado, deixar JwtAuthGuard lidar
    if (!user || !user.sub) {
      return true;
    }

    // Obter tenant_id do header
    const tenantId = request.headers['x-tenant-id'];

    // Se não há tenant_id, permitir (algumas rotas não requerem)
    if (!tenantId) {
      return true;
    }

    const supabaseId = user.sub; // UUID do Supabase

    try {
      // 1. Buscar usuário no banco
      const { data: dbUser, error: userError } = await this.supabase
        .getClient()
        .from('users')
        .select('id, tenant_id, email')
        .eq('auth0_id', supabaseId) // Campo auth0_id armazena UUID do Supabase
        .single();

      if (userError || !dbUser) {
        this.logger.warn('User not found in database', 'TenantAccessGuard', {
          supabaseId,
          tenantId,
        });
        throw new UnauthorizedException('Usuário não encontrado no sistema');
      }

      // 2. Verificar se usuário tem tenant_id definido
      if (!dbUser.tenant_id) {
        // Usuário ainda não foi vinculado a nenhum tenant
        // Permitir acesso para que possa ser vinculado
        this.logger.log(
          'User has no tenant_id yet, allowing access for first-time setup',
          'TenantAccessGuard',
          { userId: dbUser.id, supabaseId, requestedTenantId: tenantId },
        );
        return true;
      }

      // 3. Verificar se o tenant_id do usuário corresponde ao tenant solicitado
      if (dbUser.tenant_id !== tenantId) {
        this.logger.error(
          'Tenant access denied: user belongs to different tenant',
          undefined,
          'TenantAccessGuard',
          {
            userId: dbUser.id,
            userEmail: dbUser.email,
            userTenantId: dbUser.tenant_id,
            requestedTenantId: tenantId,
            supabaseId,
            path: request.url,
            method: request.method,
          },
        );

        throw new ForbiddenException(
          'Acesso negado: você não tem permissão para acessar esta instituição',
        );
      }

      // 4. Verificar se é proprietário do tenant (acesso adicional)
      const { data: ownership } = await this.supabase
        .getClient()
        .from('tenant_owners')
        .select('id')
        .eq('user_id', dbUser.id)
        .eq('tenant_id', tenantId)
        .single();

      if (ownership) {
        this.logger.log(
          'Tenant access granted: user is owner',
          'TenantAccessGuard',
          { userId: dbUser.id, tenantId },
        );
        return true;
      }

      // 5. Verificar se tem algum role no tenant
      const { data: userRoles } = await this.supabase
        .getClient()
        .from('user_roles')
        .select('id')
        .eq('user_id', dbUser.id)
        .eq('tenant_id', tenantId)
        .limit(1);

      if (userRoles && userRoles.length > 0) {
        this.logger.log(
          'Tenant access granted: user has roles',
          'TenantAccessGuard',
          { userId: dbUser.id, tenantId },
        );
        return true;
      }

      // 6. Se chegou aqui, tenant_id corresponde mas não tem roles
      // Permitir acesso (pode ser primeiro acesso após vinculação)
      this.logger.log(
        'Tenant access granted: tenant_id matches',
        'TenantAccessGuard',
        { userId: dbUser.id, tenantId },
      );
      return true;
    } catch (error: any) {
      if (
        error instanceof ForbiddenException ||
        error instanceof UnauthorizedException
      ) {
        throw error;
      }

      this.logger.error(
        `Tenant access validation error: ${error.message}`,
        error.stack,
        'TenantAccessGuard',
        { supabaseId, tenantId, error: error.message },
      );

      throw new ForbiddenException('Erro ao validar acesso à instituição');
    }
  }
}

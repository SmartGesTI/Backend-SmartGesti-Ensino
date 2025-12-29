import {
  Controller,
  Get,
  Headers,
  Query,
  UseGuards,
  Request,
  Res,
  Inject,
  forwardRef,
} from '@nestjs/common';
import type { Response } from 'express';
import { PermissionsService } from './permissions.service';
import { RolesService } from '../roles/roles.service';
import { JwtAuthGuard } from '../auth/auth.guard';

@Controller('permissions')
@UseGuards(JwtAuthGuard)
export class PermissionsController {
  constructor(
    private readonly permissionsService: PermissionsService,
    @Inject(forwardRef(() => RolesService))
    private readonly rolesService: RolesService,
  ) {}

  /**
   * Retorna todas as permissões e roles do usuário autenticado
   * UNIFICADO: Agora retorna permissões e roles em uma única requisição
   */
  @Get('user')
  async getUserPermissions(
    @Request() req: any,
    @Res() res: Response,
    @Headers('x-tenant-id') tenantId: string,
    @Query('schoolId') schoolId?: string,
  ) {
    const userId = req.user.sub; // Supabase user ID (UUID)

    // Buscar permissions_version do usuário
    const permissionsVersion = await this.permissionsService.getUserPermissionsVersion(userId);

    // Chamar isOwner apenas uma vez e reutilizar
    const isOwner = await this.permissionsService.isOwner(userId, tenantId);

    // Buscar permissions, hierarchy e roles em paralelo
    const [permissions, hierarchy, roles] = await Promise.all([
      this.permissionsService.getUserPermissionsWithOwner(userId, tenantId, schoolId, isOwner),
      this.permissionsService.getUserHighestHierarchyWithOwner(userId, tenantId, schoolId, isOwner),
      this.rolesService.getUserRoles(userId, tenantId, schoolId).catch(() => []), // Falha silenciosa para roles
    ]);

    // Adicionar header com permissions_version
    if (permissionsVersion) {
      res.setHeader('X-Permissions-Version', permissionsVersion);
    }

    return res.json({
      permissions,
      isOwner,
      hierarchy,
      roles, // Agora incluído na resposta
    });
  }

  /**
   * Verifica se o usuário tem uma permissão específica
   */
  @Get('check')
  async checkPermission(
    @Request() req: any,
    @Headers('x-tenant-id') tenantId: string,
    @Query('resource') resource: string,
    @Query('action') action: string,
    @Query('schoolId') schoolId?: string,
  ) {
    if (!resource || !action) {
      throw new Error('Parâmetros obrigatórios: resource, action');
    }

    const userId = req.user.sub; // Supabase user ID (UUID)

    const hasPermission = await this.permissionsService.checkPermission(
      userId,
      resource,
      action,
      {
        userId,
        tenantId,
        schoolId,
      },
    );

    return { hasPermission };
  }
}

import {
  Controller,
  Get,
  Headers,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { JwtAuthGuard } from '../auth/auth.guard';

@Controller('permissions')
@UseGuards(JwtAuthGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  /**
   * Retorna todas as permissões do usuário autenticado
   */
  @Get('user')
  async getUserPermissions(
    @Request() req: any,
    @Headers('x-tenant-id') tenantId: string,
    @Query('schoolId') schoolId?: string,
  ) {
    const userId = req.user.sub; // Supabase user ID (UUID)

    // Chamar isOwner apenas uma vez e reutilizar
    const isOwner = await this.permissionsService.isOwner(userId, tenantId);

    // Usar versões otimizadas que aceitam isOwner pré-calculado
    const [permissions, hierarchy] = await Promise.all([
      this.permissionsService.getUserPermissionsWithOwner(userId, tenantId, schoolId, isOwner),
      this.permissionsService.getUserHighestHierarchyWithOwner(userId, tenantId, schoolId, isOwner),
    ]);

    return {
      permissions,
      isOwner,
      hierarchy,
    };
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

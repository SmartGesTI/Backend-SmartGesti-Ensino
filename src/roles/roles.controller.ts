import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Headers,
  UseGuards,
  Request,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';

@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  /**
   * Lista todos os cargos disponíveis
   */
  @Get()
  async findAll(@Headers('x-tenant-id') tenantId: string) {
    return this.rolesService.findAll(tenantId);
  }

  /**
   * Lista cargos de um usuário
   * IMPORTANTE: Esta rota deve vir ANTES de @Get(':id')
   */
  @Get('user/:userId')
  async getUserRoles(
    @Param('userId') userId: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.rolesService.getUserRoles(userId, tenantId);
  }

  /**
   * Busca um cargo específico
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.rolesService.findOne(id, tenantId);
  }

  /**
   * Cria um novo cargo customizado
   */
  @Post()
  @UseGuards(PermissionGuard)
  @RequirePermission('roles', 'create')
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Body() createRoleDto: CreateRoleDto,
  ) {
    return this.rolesService.create(tenantId, createRoleDto);
  }

  /**
   * Atualiza um cargo customizado
   */
  @Put(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('roles', 'update')
  async update(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
    @Body() updateRoleDto: UpdateRoleDto,
  ) {
    return this.rolesService.update(id, tenantId, updateRoleDto);
  }

  /**
   * Deleta um cargo customizado
   */
  @Delete(':id')
  @UseGuards(PermissionGuard)
  @RequirePermission('roles', 'delete')
  async remove(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.rolesService.remove(id, tenantId);
  }

  /**
   * Atribui um cargo a um usuário
   */
  @Post('assign')
  @UseGuards(PermissionGuard)
  @RequirePermission('users', 'update')
  async assignRole(
    @Headers('x-tenant-id') tenantId: string,
    @Body() assignRoleDto: AssignRoleDto,
    @Request() req: any,
  ) {
    return this.rolesService.assignRole(
      tenantId,
      assignRoleDto,
      req.user.id,
    );
  }

  /**
   * Remove um cargo de um usuário
   */
  @Delete('remove/:userId/:roleId')
  @UseGuards(PermissionGuard)
  @RequirePermission('users', 'update')
  async removeRole(
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    return this.rolesService.removeRole(tenantId, userId, roleId);
  }
}

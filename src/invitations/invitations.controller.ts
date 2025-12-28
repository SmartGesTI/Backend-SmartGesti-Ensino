import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Headers,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { InvitationsService } from './invitations.service';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { AcceptInvitationDto } from './dto/accept-invitation.dto';
import { JwtAuthGuard } from '../auth/auth.guard';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { RequirePermission } from '../permissions/decorators/require-permission.decorator';

@Controller('invitations')
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  /**
   * Cria um novo convite
   */
  @Post()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('users', 'create')
  async create(
    @Headers('x-tenant-id') tenantId: string,
    @Body() createInvitationDto: CreateInvitationDto,
    @Request() req: any,
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID é obrigatório');
    }
    return this.invitationsService.create(
      tenantId,
      createInvitationDto,
      req.user.id,
    );
  }

  /**
   * Lista todos os convites
   */
  @Get()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('users', 'read')
  async findAll(
    @Headers('x-tenant-id') tenantId: string,
    @Query('status') status?: string,
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID é obrigatório');
    }
    return this.invitationsService.findAll(tenantId, status);
  }

  /**
   * Busca convite por token (público - não requer autenticação)
   */
  @Get('token/:token')
  async findByToken(@Param('token') token: string) {
    return this.invitationsService.findByToken(token);
  }

  /**
   * Aceita um convite
   */
  @Post('accept')
  @UseGuards(JwtAuthGuard)
  async accept(
    @Body() acceptInvitationDto: AcceptInvitationDto,
    @Request() req: any,
  ) {
    return this.invitationsService.accept(
      acceptInvitationDto.token,
      req.user.id,
    );
  }

  /**
   * Cancela um convite
   */
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('users', 'update')
  async cancel(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID é obrigatório');
    }
    return this.invitationsService.cancel(id, tenantId);
  }

  /**
   * Deleta um convite
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('users', 'delete')
  async remove(
    @Param('id') id: string,
    @Headers('x-tenant-id') tenantId: string,
  ) {
    if (!tenantId) {
      throw new Error('Tenant ID é obrigatório');
    }
    return this.invitationsService.remove(id, tenantId);
  }
}

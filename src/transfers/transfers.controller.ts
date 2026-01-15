import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { TransfersService, TransferWithRelations } from './transfers.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import {
  ApproveTransferDto,
  RejectTransferDto,
  CompleteTransferDto,
  CancelTransferDto,
} from './dto/update-transfer.dto';
import { PaginatedResult } from '../common/types';

@Controller('transfers')
@UseGuards(JwtAuthGuard)
export class TransfersController {
  constructor(
    private transfersService: TransfersService,
    private usersService: UsersService,
    private tenantsService: TenantsService,
    private logger: LoggerService,
  ) {}

  private async getTenantId(subdomain: string | undefined): Promise<string> {
    if (!subdomain) {
      throw new BadRequestException('Subdomain é obrigatório');
    }

    const tenant = await this.tenantsService.getTenantBySubdomain(subdomain);
    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado');
    }

    return tenant.id;
  }

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Query('status') status?: string,
    @Query('direction') direction?: 'incoming' | 'outgoing',
    @Query('student_id') studentId?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<PaginatedResult<TransferWithRelations>> {
    const tenantId = await this.getTenantId(subdomain);

    this.logger.log('Listing transfers', 'TransfersController', {
      userSub: user.sub,
      tenantId,
      status,
      direction,
    });

    return this.transfersService.findAll(
      tenantId,
      { status, direction, studentId },
      page || 1,
      limit || 20,
    );
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TransferWithRelations> {
    const tenantId = await this.getTenantId(subdomain);
    const transfer = await this.transfersService.findOne(id, tenantId);

    if (!transfer) {
      throw new NotFoundException(
        `Transferência com id '${id}' não encontrada`,
      );
    }

    return transfer;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateTransferDto,
  ): Promise<TransferWithRelations> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Creating transfer request', 'TransfersController', {
      userSub: user.sub,
      studentId: dto.student_id,
      toTenantId: dto.to_tenant_id,
    });

    return this.transfersService.create(tenantId, dto, dbUser?.id);
  }

  @Post(':id/approve')
  async approve(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveTransferDto,
  ): Promise<TransferWithRelations> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Approving transfer', 'TransfersController', {
      userSub: user.sub,
      transferId: id,
    });

    return this.transfersService.approve(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/reject')
  async reject(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectTransferDto,
  ): Promise<TransferWithRelations> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Rejecting transfer', 'TransfersController', {
      userSub: user.sub,
      transferId: id,
      reason: dto.reason,
    });

    return this.transfersService.reject(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/complete')
  async complete(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CompleteTransferDto,
  ): Promise<TransferWithRelations> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Completing transfer', 'TransfersController', {
      userSub: user.sub,
      transferId: id,
    });

    return this.transfersService.complete(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/cancel')
  async cancel(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelTransferDto,
  ): Promise<TransferWithRelations> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Cancelling transfer', 'TransfersController', {
      userSub: user.sub,
      transferId: id,
      reason: dto.reason,
    });

    return this.transfersService.cancel(id, tenantId, dto, dbUser?.id);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.transfersService.remove(id, tenantId, dbUser.id);

    return { message: `Transferência removida com sucesso` };
  }
}

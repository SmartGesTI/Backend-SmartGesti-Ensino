import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { DataSharesService } from './data-shares.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { SchoolsService } from '../schools/schools.service';
import {
  CreateDataShareDto,
  CreateTokenDto,
  RevokeDataShareDto,
} from './dto/create-data-share.dto';
import {
  DataShare,
  DataShareWithRelations,
  DataShareAccessLog,
  AcademicRecordSnapshot,
} from '../common/types';

@Controller('data-shares')
export class DataSharesController {
  constructor(
    private dataSharesService: DataSharesService,
    private usersService: UsersService,
    private tenantsService: TenantsService,
    private schoolsService: SchoolsService,
    private logger: LoggerService,
  ) {}

  private async getTenantId(subdomain: string | undefined): Promise<string> {
    if (!subdomain) {
      throw new BadRequestException('Subdomain e obrigatorio');
    }

    const tenant = await this.tenantsService.getTenantBySubdomain(subdomain);
    if (!tenant) {
      throw new NotFoundException('Tenant nao encontrado');
    }

    return tenant.id;
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Query('snapshotId') snapshotId?: string,
    @Query('status') status?: string,
  ): Promise<DataShare[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.dataSharesService.findAll(tenantId, { snapshotId, status });
  }

  @Get('validate/:token')
  async validateToken(
    @Param('token') token: string,
    @Req() req: Request,
  ): Promise<{
    valid: boolean;
    snapshot?: AcademicRecordSnapshot;
    message?: string;
  }> {
    const ip = req.ip || req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    this.logger.log('Validating data share token', 'DataSharesController', {
      tokenHint: token.substring(0, 8) + '...',
      ip,
    });

    return this.dataSharesService.validateToken(token, { ip, userAgent });
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DataShareWithRelations> {
    const tenantId = await this.getTenantId(subdomain);
    const share = await this.dataSharesService.findOne(id, tenantId);

    if (!share) {
      throw new NotFoundException(`Data share com id '${id}' nao encontrado`);
    }

    return share;
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateDataShareDto,
    @Query('schoolId') schoolId?: string,
  ): Promise<DataShare> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Creating data share', 'DataSharesController', {
      userSub: user.sub,
      snapshotId: dto.snapshot_id,
    });

    return this.dataSharesService.create(
      tenantId,
      schoolId || null,
      dto,
      dbUser?.id,
    );
  }

  @Post(':id/revoke')
  @UseGuards(JwtAuthGuard)
  async revoke(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokeDataShareDto,
  ): Promise<DataShare> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuario nao encontrado');
    }

    this.logger.log('Revoking data share', 'DataSharesController', {
      userSub: user.sub,
      shareId: id,
    });

    return this.dataSharesService.revoke(id, tenantId, dto, dbUser.id);
  }

  @Post(':id/tokens')
  @UseGuards(JwtAuthGuard)
  async createToken(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) shareId: string,
    @Body() dto: CreateTokenDto,
  ): Promise<{ token: string; token_hint: string; expires_at: string | null }> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Creating token for data share', 'DataSharesController', {
      userSub: user.sub,
      shareId,
    });

    return this.dataSharesService.createToken(
      shareId,
      tenantId,
      dto,
      dbUser?.id,
    );
  }

  @Get(':id/access-logs')
  @UseGuards(JwtAuthGuard)
  async findAccessLogs(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) shareId: string,
  ): Promise<DataShareAccessLog[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.dataSharesService.findAccessLogs(shareId, tenantId);
  }
}

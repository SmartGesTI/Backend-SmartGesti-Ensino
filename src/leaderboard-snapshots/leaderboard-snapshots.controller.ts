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
import { LeaderboardSnapshotsService } from './leaderboard-snapshots.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { LoggerService } from '../common/logger/logger.service';
import {
  CreateLeaderboardSnapshotDto,
  ComputeLeaderboardSnapshotDto,
} from './dto/create-leaderboard-snapshot.dto';
import { LeaderboardSnapshot } from '../common/types';

@Controller('leaderboard-snapshots')
@UseGuards(JwtAuthGuard)
export class LeaderboardSnapshotsController {
  constructor(
    private service: LeaderboardSnapshotsService,
    private usersService: UsersService,
    private tenantsService: TenantsService,
    private logger: LoggerService,
  ) {}

  private async getTenantId(subdomain: string | undefined): Promise<string> {
    if (!subdomain) throw new BadRequestException('Subdomain é obrigatório');
    const tenant = await this.tenantsService.getTenantBySubdomain(subdomain);
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    return tenant.id;
  }

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Query('leaderboardDefinitionId') leaderboardDefinitionId?: string,
    @Query('limit') limit?: string,
  ): Promise<LeaderboardSnapshot[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.findAll(tenantId, {
      leaderboardDefinitionId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('latest/:leaderboardDefinitionId')
  async getLatest(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('leaderboardDefinitionId', ParseUUIDPipe)
    leaderboardDefinitionId: string,
  ): Promise<LeaderboardSnapshot> {
    const tenantId = await this.getTenantId(subdomain);
    const snapshot = await this.service.getLatest(
      leaderboardDefinitionId,
      tenantId,
    );
    if (!snapshot)
      throw new NotFoundException(
        `Nenhum snapshot encontrado para leaderboard '${leaderboardDefinitionId}'`,
      );
    return snapshot;
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LeaderboardSnapshot> {
    const tenantId = await this.getTenantId(subdomain);
    const snapshot = await this.service.findOne(id, tenantId);
    if (!snapshot)
      throw new NotFoundException(
        `Leaderboard snapshot com id '${id}' não encontrado`,
      );
    return snapshot;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateLeaderboardSnapshotDto,
  ): Promise<LeaderboardSnapshot> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.service.create(tenantId, dto, dbUser?.id);
  }

  @Post('compute')
  async compute(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: ComputeLeaderboardSnapshotDto,
  ): Promise<LeaderboardSnapshot> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    this.logger.log(
      'Computing leaderboard snapshot',
      'LeaderboardSnapshotsController',
      { userSub: user.sub },
    );
    return this.service.compute(tenantId, dto, dbUser?.id);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    const tenantId = await this.getTenantId(subdomain);
    await this.service.remove(id, tenantId);
    return { message: 'Leaderboard snapshot removido com sucesso' };
  }
}

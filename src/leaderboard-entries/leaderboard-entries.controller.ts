import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { LeaderboardEntriesService } from './leaderboard-entries.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { TenantsService } from '../tenants/tenants.service';
import { LeaderboardEntry } from '../common/types';

@Controller('leaderboard-entries')
@UseGuards(JwtAuthGuard)
export class LeaderboardEntriesController {
  constructor(
    private service: LeaderboardEntriesService,
    private tenantsService: TenantsService,
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
    @Query('snapshotId') snapshotId?: string,
    @Query('limit') limit?: string,
  ): Promise<LeaderboardEntry[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.findAll(tenantId, {
      snapshotId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('by-snapshot/:snapshotId')
  async findBySnapshot(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('snapshotId', ParseUUIDPipe) snapshotId: string,
    @Query('limit') limit?: string,
  ): Promise<LeaderboardEntry[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.findBySnapshot(
      snapshotId,
      tenantId,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Get('by-student/:studentId/snapshot/:snapshotId')
  async findByStudent(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Param('snapshotId', ParseUUIDPipe) snapshotId: string,
  ): Promise<LeaderboardEntry> {
    const tenantId = await this.getTenantId(subdomain);
    const entry = await this.service.findByStudent(
      studentId,
      snapshotId,
      tenantId,
    );
    if (!entry)
      throw new NotFoundException(
        `Entrada não encontrada para estudante '${studentId}' no snapshot '${snapshotId}'`,
      );
    return entry;
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LeaderboardEntry> {
    const tenantId = await this.getTenantId(subdomain);
    const entry = await this.service.findOne(id, tenantId);
    if (!entry)
      throw new NotFoundException(
        `Leaderboard entry com id '${id}' não encontrada`,
      );
    return entry;
  }
}

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { AcademicRecordSnapshotsService } from './academic-record-snapshots.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  GenerateSnapshotDto,
  FinalizeSnapshotDto,
  RevokeSnapshotDto,
} from './dto/create-snapshot.dto';
import {
  AcademicRecordSnapshot,
  AcademicRecordSnapshotWithRelations,
} from '../common/types';

@Controller('academic-record-snapshots')
@UseGuards(JwtAuthGuard)
export class AcademicRecordSnapshotsController {
  constructor(
    private snapshotsService: AcademicRecordSnapshotsService,
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
    @Query('studentId') studentId?: string,
    @Query('kind') kind?: string,
    @Query('status') status?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('isFinal') isFinal?: string,
  ): Promise<AcademicRecordSnapshot[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.snapshotsService.findAll(tenantId, {
      studentId,
      kind,
      status,
      academicYearId,
      isFinal:
        isFinal === 'true' ? true : isFinal === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AcademicRecordSnapshotWithRelations> {
    const tenantId = await this.getTenantId(subdomain);
    const snapshot = await this.snapshotsService.findOne(id, tenantId);

    if (!snapshot) {
      throw new NotFoundException(`Snapshot com id '${id}' não encontrado`);
    }

    return snapshot;
  }

  @Post('generate')
  async generate(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: GenerateSnapshotDto,
  ): Promise<AcademicRecordSnapshot> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log(
      'Generating snapshot',
      'AcademicRecordSnapshotsController',
      {
        userSub: user.sub,
        studentId: dto.student_id,
        kind: dto.kind,
      },
    );

    return this.snapshotsService.generate(tenantId, dto, dbUser?.id);
  }

  @Post(':id/finalize')
  async finalize(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: FinalizeSnapshotDto,
  ): Promise<AcademicRecordSnapshot> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    this.logger.log(
      'Finalizing snapshot',
      'AcademicRecordSnapshotsController',
      {
        userSub: user.sub,
        snapshotId: id,
      },
    );

    return this.snapshotsService.finalize(id, tenantId, dto, dbUser.id);
  }

  @Post(':id/revoke')
  async revoke(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RevokeSnapshotDto,
  ): Promise<AcademicRecordSnapshot> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    this.logger.log('Revoking snapshot', 'AcademicRecordSnapshotsController', {
      userSub: user.sub,
      snapshotId: id,
      reason: dto.reason,
    });

    return this.snapshotsService.revoke(id, tenantId, dto, dbUser.id);
  }

  @Get(':id/verify')
  async verify(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ valid: boolean; computed_hash: string; stored_hash: string }> {
    const tenantId = await this.getTenantId(subdomain);

    this.logger.log(
      'Verifying snapshot integrity',
      'AcademicRecordSnapshotsController',
      {
        userSub: user.sub,
        snapshotId: id,
      },
    );

    return this.snapshotsService.verify(id, tenantId);
  }
}

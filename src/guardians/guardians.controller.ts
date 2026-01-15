import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { GuardiansService } from './guardians.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  CreateGuardianDto,
  UpdateGuardianDto,
} from './dto/create-guardian.dto';
import {
  CreateGuardianTenantProfileDto,
  UpdateGuardianTenantProfileDto,
} from './dto/create-guardian-tenant-profile.dto';
import {
  Guardian,
  GuardianTenantProfile,
  GuardianWithProfiles,
} from '../common/types';

@Controller('guardians')
@UseGuards(JwtAuthGuard)
export class GuardiansController {
  constructor(
    private guardiansService: GuardiansService,
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
    @Query('search') search?: string,
  ): Promise<GuardianWithProfiles[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.guardiansService.findAll(tenantId, { status, search });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GuardianWithProfiles> {
    const tenantId = await this.getTenantId(subdomain);
    const guardian = await this.guardiansService.findOne(id, tenantId);

    if (!guardian) {
      throw new NotFoundException(`Responsável com id '${id}' não encontrado`);
    }

    return guardian;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateGuardianDto,
  ): Promise<GuardianWithProfiles> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.guardiansService.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGuardianDto,
  ): Promise<Guardian> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.guardiansService.update(id, tenantId, dto, dbUser?.id);
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

    await this.guardiansService.remove(id, tenantId, dbUser.id);

    return { message: 'Responsável removido com sucesso' };
  }

  // ==============================
  // Tenant Profiles Endpoints
  // ==============================

  @Get(':id/tenant-profiles')
  async findProfiles(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) guardianId: string,
  ): Promise<GuardianTenantProfile[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.guardiansService.findProfiles(guardianId, tenantId);
  }

  @Post(':id/tenant-profiles')
  async addProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) guardianId: string,
    @Body() dto: CreateGuardianTenantProfileDto,
  ): Promise<GuardianTenantProfile> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.guardiansService.addProfile(
      guardianId,
      tenantId,
      dto,
      dbUser?.id,
    );
  }

  @Put(':id/tenant-profiles/:profileId')
  async updateProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) guardianId: string,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Body() dto: UpdateGuardianTenantProfileDto,
  ): Promise<GuardianTenantProfile> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.guardiansService.updateProfile(
      profileId,
      tenantId,
      dto,
      dbUser?.id,
    );
  }
}

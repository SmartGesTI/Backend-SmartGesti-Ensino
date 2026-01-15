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
import { StaffMembersService } from './staff-members.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateStaffMemberDto } from './dto/create-staff-member.dto';
import { UpdateStaffMemberDto } from './dto/update-staff-member.dto';
import { CreateStaffSchoolProfileDto } from './dto/create-staff-school-profile.dto';
import { UpdateStaffSchoolProfileDto } from './dto/update-staff-school-profile.dto';
import { StaffMember, StaffSchoolProfile } from '../common/types';

@Controller('staff-members')
@UseGuards(JwtAuthGuard)
export class StaffMembersController {
  constructor(
    private staffMembersService: StaffMembersService,
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

  // =======================
  // Staff Members Endpoints
  // =======================

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Query('staffType') staffType?: string,
    @Query('status') status?: string,
    @Query('includeProfiles') includeProfiles?: boolean,
  ): Promise<StaffMember[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.staffMembersService.findAll(tenantId, {
      staffType,
      status,
      includeProfiles,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('includeProfiles') includeProfiles?: boolean,
  ): Promise<StaffMember> {
    const tenantId = await this.getTenantId(subdomain);
    const staffMember = await this.staffMembersService.findOne(
      id,
      tenantId,
      includeProfiles,
    );

    if (!staffMember) {
      throw new NotFoundException(`Staff member com id '${id}' não encontrado`);
    }

    return staffMember;
  }

  @Get('person/:personId')
  async findByPersonId(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('personId', ParseUUIDPipe) personId: string,
  ): Promise<StaffMember> {
    const tenantId = await this.getTenantId(subdomain);
    const staffMember = await this.staffMembersService.findByPersonId(
      personId,
      tenantId,
    );

    if (!staffMember) {
      throw new NotFoundException(
        `Staff member para person '${personId}' não encontrado`,
      );
    }

    return staffMember;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateStaffMemberDto,
  ): Promise<StaffMember> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.staffMembersService.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffMemberDto,
  ): Promise<StaffMember> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.staffMembersService.update(id, tenantId, dto, dbUser?.id);
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

    await this.staffMembersService.remove(id, tenantId, dbUser.id);

    return { message: 'Staff member removido com sucesso' };
  }

  // ==============================
  // Staff School Profiles Endpoints
  // ==============================

  @Get(':id/school-profiles')
  async findProfilesByStaffMember(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) staffMemberId: string,
  ): Promise<StaffSchoolProfile[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.staffMembersService.findProfilesByStaffMember(
      staffMemberId,
      tenantId,
    );
  }

  @Get(':id/school-profiles/:profileId')
  async findProfileOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) staffMemberId: string,
    @Param('profileId', ParseUUIDPipe) profileId: string,
  ): Promise<StaffSchoolProfile> {
    const tenantId = await this.getTenantId(subdomain);
    const profile = await this.staffMembersService.findProfileOne(
      profileId,
      tenantId,
    );

    if (!profile) {
      throw new NotFoundException(
        `Staff school profile com id '${profileId}' não encontrado`,
      );
    }

    return profile;
  }

  @Post(':id/school-profiles')
  async createProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) staffMemberId: string,
    @Body() dto: CreateStaffSchoolProfileDto,
  ): Promise<StaffSchoolProfile> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.staffMembersService.createProfile(
      staffMemberId,
      tenantId,
      dto,
      dbUser?.id,
    );
  }

  @Put(':id/school-profiles/:profileId')
  async updateProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) staffMemberId: string,
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Body() dto: UpdateStaffSchoolProfileDto,
  ): Promise<StaffSchoolProfile> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.staffMembersService.updateProfile(
      profileId,
      tenantId,
      dto,
      dbUser?.id,
    );
  }

  @Delete(':id/school-profiles/:profileId')
  async removeProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) staffMemberId: string,
    @Param('profileId', ParseUUIDPipe) profileId: string,
  ): Promise<{ message: string }> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.staffMembersService.removeProfile(
      profileId,
      tenantId,
      dbUser.id,
    );

    return { message: 'Staff school profile removido com sucesso' };
  }
}

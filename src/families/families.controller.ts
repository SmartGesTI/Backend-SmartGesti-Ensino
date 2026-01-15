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
import { FamiliesService } from './families.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateFamilyDto, UpdateFamilyDto } from './dto/create-family.dto';
import { CreateFamilyMemberDto } from './dto/create-family-member.dto';
import { Family, FamilyMember, FamilyWithMembers } from '../common/types';

@Controller('families')
@UseGuards(JwtAuthGuard)
export class FamiliesController {
  constructor(
    private familiesService: FamiliesService,
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
  ): Promise<FamilyWithMembers[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.familiesService.findAll(tenantId, { status, search });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<FamilyWithMembers> {
    const tenantId = await this.getTenantId(subdomain);
    const family = await this.familiesService.findOne(id, tenantId);

    if (!family) {
      throw new NotFoundException(`Família com id '${id}' não encontrada`);
    }

    return family;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateFamilyDto,
  ): Promise<Family> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.familiesService.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFamilyDto,
  ): Promise<Family> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.familiesService.update(id, tenantId, dto, dbUser?.id);
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

    await this.familiesService.remove(id, tenantId, dbUser.id);

    return { message: 'Família removida com sucesso' };
  }

  // ==============================
  // Family Members Endpoints
  // ==============================

  @Get(':id/members')
  async findMembers(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) familyId: string,
  ): Promise<FamilyMember[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.familiesService.findMembers(familyId, tenantId);
  }

  @Post(':id/members')
  async addMember(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) familyId: string,
    @Body() dto: CreateFamilyMemberDto,
  ): Promise<FamilyMember> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.familiesService.addMember(familyId, tenantId, dto, dbUser?.id);
  }

  @Delete(':id/members/:memberId')
  async removeMember(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) familyId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ): Promise<{ message: string }> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.familiesService.removeMember(
      familyId,
      memberId,
      tenantId,
      dbUser.id,
    );

    return { message: 'Membro removido com sucesso' };
  }
}

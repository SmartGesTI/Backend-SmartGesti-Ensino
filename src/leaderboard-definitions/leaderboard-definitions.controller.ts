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
import { LeaderboardDefinitionsService } from './leaderboard-definitions.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  CreateLeaderboardDefinitionDto,
  UpdateLeaderboardDefinitionDto,
} from './dto/create-leaderboard-definition.dto';
import { LeaderboardDefinition } from '../common/types';

@Controller('leaderboard-definitions')
@UseGuards(JwtAuthGuard)
export class LeaderboardDefinitionsController {
  constructor(
    private service: LeaderboardDefinitionsService,
    private usersService: UsersService,
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
    @Query('schoolId') schoolId?: string,
    @Query('isActive') isActive?: string,
    @Query('scope') scope?: string,
    @Query('academicYearId') academicYearId?: string,
  ): Promise<LeaderboardDefinition[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.findAll(tenantId, {
      schoolId,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      scope,
      academicYearId,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LeaderboardDefinition> {
    const tenantId = await this.getTenantId(subdomain);
    const def = await this.service.findOne(id, tenantId);
    if (!def)
      throw new NotFoundException(
        `Leaderboard definition com id '${id}' não encontrada`,
      );
    return def;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateLeaderboardDefinitionDto,
  ): Promise<LeaderboardDefinition> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.service.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeaderboardDefinitionDto,
  ): Promise<LeaderboardDefinition> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.update(id, tenantId, dto);
  }

  @Post(':id/activate')
  async activate(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LeaderboardDefinition> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.activate(id, tenantId);
  }

  @Post(':id/deactivate')
  async deactivate(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<LeaderboardDefinition> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.deactivate(id, tenantId);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    if (!dbUser) throw new NotFoundException('Usuário não encontrado');
    await this.service.remove(id, tenantId, dbUser.id);
    return { message: 'Leaderboard definition removida com sucesso' };
  }
}

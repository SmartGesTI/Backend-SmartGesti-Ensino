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
import { InsightInstancesService } from './insight-instances.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  CreateInsightInstanceDto,
  DismissInsightDto,
} from './dto/create-insight-instance.dto';
import { InsightInstance } from '../common/types';

@Controller('insight-instances')
@UseGuards(JwtAuthGuard)
export class InsightInstancesController {
  constructor(
    private service: InsightInstancesService,
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
    @Query('insightDefinitionId') insightDefinitionId?: string,
    @Query('status') status?: string,
    @Query('targetKind') targetKind?: string,
    @Query('studentId') studentId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('limit') limit?: string,
  ): Promise<InsightInstance[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.findAll(tenantId, {
      schoolId,
      insightDefinitionId,
      status,
      targetKind,
      studentId,
      academicYearId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InsightInstance> {
    const tenantId = await this.getTenantId(subdomain);
    const instance = await this.service.findOne(id, tenantId);
    if (!instance)
      throw new NotFoundException(
        `Insight instance com id '${id}' não encontrada`,
      );
    return instance;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateInsightInstanceDto,
  ): Promise<InsightInstance> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.service.create(tenantId, dto, dbUser?.id);
  }

  @Post(':id/approve')
  async approve(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InsightInstance> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.service.approve(id, tenantId, dbUser?.id);
  }

  @Post(':id/dismiss')
  async dismiss(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DismissInsightDto,
  ): Promise<InsightInstance> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.service.dismiss(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/resolve')
  async resolve(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InsightInstance> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.service.resolve(id, tenantId, dbUser?.id);
  }

  @Post(':id/deliver')
  async deliver(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InsightInstance> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.service.deliver(id, tenantId, dbUser?.id);
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
    return { message: 'Insight instance removida com sucesso' };
  }
}

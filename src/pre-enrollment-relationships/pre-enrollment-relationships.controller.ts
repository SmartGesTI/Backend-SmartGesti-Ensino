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
import { PreEnrollmentRelationshipsService } from './pre-enrollment-relationships.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  CreatePreEnrollmentRelationshipDto,
  UpdatePreEnrollmentRelationshipDto,
} from './dto/create-pre-enrollment-relationship.dto';
import { PreEnrollmentRelationship } from '../common/types';

@Controller('pre-enrollment-relationships')
@UseGuards(JwtAuthGuard)
export class PreEnrollmentRelationshipsController {
  constructor(
    private service: PreEnrollmentRelationshipsService,
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
    @Query('applicationId') applicationId?: string,
    @Query('studentPersonId') studentPersonId?: string,
    @Query('guardianPersonId') guardianPersonId?: string,
  ): Promise<PreEnrollmentRelationship[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.findAll(tenantId, {
      applicationId,
      studentPersonId,
      guardianPersonId,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PreEnrollmentRelationship> {
    const tenantId = await this.getTenantId(subdomain);
    const relationship = await this.service.findOne(id, tenantId);

    if (!relationship) {
      throw new NotFoundException(`Relationship com id '${id}' não encontrado`);
    }

    return relationship;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreatePreEnrollmentRelationshipDto,
  ): Promise<PreEnrollmentRelationship> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log(
      'Creating pre-enrollment relationship',
      'PreEnrollmentRelationshipsController',
      {
        userSub: user.sub,
        type: dto.relationship_type,
      },
    );

    return this.service.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePreEnrollmentRelationshipDto,
  ): Promise<PreEnrollmentRelationship> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.update(id, tenantId, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    const tenantId = await this.getTenantId(subdomain);
    await this.service.remove(id, tenantId);

    return { message: 'Relationship removido com sucesso' };
  }
}

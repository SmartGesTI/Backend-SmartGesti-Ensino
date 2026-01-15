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
import { PreEnrollmentFormTemplatesService } from './pre-enrollment-form-templates.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  CreatePreEnrollmentFormTemplateDto,
  UpdatePreEnrollmentFormTemplateDto,
} from './dto/create-pre-enrollment-form-template.dto';
import { PreEnrollmentFormTemplate } from '../common/types';

@Controller('pre-enrollment-form-templates')
@UseGuards(JwtAuthGuard)
export class PreEnrollmentFormTemplatesController {
  constructor(
    private service: PreEnrollmentFormTemplatesService,
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
    @Query('schoolId') schoolId?: string,
    @Query('status') status?: string,
    @Query('slug') slug?: string,
  ): Promise<PreEnrollmentFormTemplate[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.findAll(tenantId, { schoolId, status, slug });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PreEnrollmentFormTemplate> {
    const tenantId = await this.getTenantId(subdomain);
    const template = await this.service.findOne(id, tenantId);

    if (!template) {
      throw new NotFoundException(`Template com id '${id}' não encontrado`);
    }

    return template;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreatePreEnrollmentFormTemplateDto,
  ): Promise<PreEnrollmentFormTemplate> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log(
      'Creating pre-enrollment form template',
      'PreEnrollmentFormTemplatesController',
      {
        userSub: user.sub,
        slug: dto.slug,
      },
    );

    return this.service.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePreEnrollmentFormTemplateDto,
  ): Promise<PreEnrollmentFormTemplate> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.service.update(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/publish')
  async publish(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PreEnrollmentFormTemplate> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log(
      'Publishing pre-enrollment form template',
      'PreEnrollmentFormTemplatesController',
      {
        userSub: user.sub,
        templateId: id,
      },
    );

    return this.service.publish(id, tenantId, dbUser?.id);
  }

  @Post(':id/archive')
  async archive(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PreEnrollmentFormTemplate> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log(
      'Archiving pre-enrollment form template',
      'PreEnrollmentFormTemplatesController',
      {
        userSub: user.sub,
        templateId: id,
      },
    );

    return this.service.archive(id, tenantId, dbUser?.id);
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

    await this.service.remove(id, tenantId, dbUser.id);

    return { message: 'Template removido com sucesso' };
  }
}

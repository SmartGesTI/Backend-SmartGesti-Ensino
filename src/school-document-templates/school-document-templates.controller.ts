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
import { SchoolDocumentTemplatesService } from './school-document-templates.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  CreateSchoolDocumentTemplateDto,
  UpdateSchoolDocumentTemplateDto,
} from './dto/create-school-document-template.dto';
import { SchoolDocumentTemplate } from '../common/types';

@Controller('school-document-templates')
@UseGuards(JwtAuthGuard)
export class SchoolDocumentTemplatesController {
  constructor(
    private templatesService: SchoolDocumentTemplatesService,
    private usersService: UsersService,
    private tenantsService: TenantsService,
    private logger: LoggerService,
  ) {}

  private async getTenantId(subdomain: string | undefined): Promise<string> {
    if (!subdomain) {
      throw new BadRequestException('Subdomain e obrigatorio');
    }

    const tenant = await this.tenantsService.getTenantBySubdomain(subdomain);
    if (!tenant) {
      throw new NotFoundException('Tenant nao encontrado');
    }

    return tenant.id;
  }

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Query('schoolId') schoolId?: string,
    @Query('documentTypeId') documentTypeId?: string,
    @Query('status') status?: string,
  ): Promise<SchoolDocumentTemplate[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.templatesService.findAll(tenantId, {
      schoolId,
      documentTypeId,
      status,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SchoolDocumentTemplate> {
    const tenantId = await this.getTenantId(subdomain);
    const template = await this.templatesService.findOne(id, tenantId);

    if (!template) {
      throw new NotFoundException(`Template com id '${id}' nao encontrado`);
    }

    return template;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateSchoolDocumentTemplateDto,
  ): Promise<SchoolDocumentTemplate> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Creating template', 'SchoolDocumentTemplatesController', {
      userSub: user.sub,
      name: dto.name,
    });

    return this.templatesService.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSchoolDocumentTemplateDto,
  ): Promise<SchoolDocumentTemplate> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.templatesService.update(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/publish')
  async publish(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SchoolDocumentTemplate> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log(
      'Publishing template',
      'SchoolDocumentTemplatesController',
      {
        userSub: user.sub,
        templateId: id,
      },
    );

    return this.templatesService.publish(id, tenantId, dbUser?.id);
  }

  @Post(':id/archive')
  async archive(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SchoolDocumentTemplate> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.templatesService.archive(id, tenantId, dbUser?.id);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    await this.templatesService.remove(id, tenantId, dbUser?.id);

    return { success: true };
  }
}

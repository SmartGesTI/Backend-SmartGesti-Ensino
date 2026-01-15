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
import { SchoolDocumentTypesService } from './school-document-types.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  CreateSchoolDocumentTypeDto,
  UpdateSchoolDocumentTypeDto,
} from './dto/create-school-document-type.dto';
import { SchoolDocumentType } from '../common/types';

@Controller('school-document-types')
@UseGuards(JwtAuthGuard)
export class SchoolDocumentTypesController {
  constructor(
    private documentTypesService: SchoolDocumentTypesService,
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
    @Query('category') category?: string,
    @Query('isActive') isActive?: string,
  ): Promise<SchoolDocumentType[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.documentTypesService.findAll(tenantId, {
      schoolId,
      category,
      isActive:
        isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get('slug/:slug')
  async findBySlug(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('slug') slug: string,
    @Query('schoolId') schoolId?: string,
  ): Promise<SchoolDocumentType> {
    const tenantId = await this.getTenantId(subdomain);
    const docType = await this.documentTypesService.findBySlug(
      slug,
      tenantId,
      schoolId,
    );

    if (!docType) {
      throw new NotFoundException(
        `Tipo de documento com slug '${slug}' nao encontrado`,
      );
    }

    return docType;
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<SchoolDocumentType> {
    const tenantId = await this.getTenantId(subdomain);
    const docType = await this.documentTypesService.findOne(id, tenantId);

    if (!docType) {
      throw new NotFoundException(
        `Tipo de documento com id '${id}' nao encontrado`,
      );
    }

    return docType;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateSchoolDocumentTypeDto,
  ): Promise<SchoolDocumentType> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Creating document type', 'SchoolDocumentTypesController', {
      userSub: user.sub,
      slug: dto.slug,
    });

    return this.documentTypesService.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSchoolDocumentTypeDto,
  ): Promise<SchoolDocumentType> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.documentTypesService.update(id, tenantId, dto, dbUser?.id);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    await this.documentTypesService.remove(id, tenantId, dbUser?.id);

    return { success: true };
  }
}

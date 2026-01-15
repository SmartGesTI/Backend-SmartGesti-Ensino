import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SchoolsService } from './schools.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { School } from '../common/types';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { LoggerService } from '../common/logger/logger.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';

@Controller('schools')
@UseGuards(JwtAuthGuard)
export class SchoolsController {
  constructor(
    private schoolsService: SchoolsService,
    private usersService: UsersService,
    private tenantsService: TenantsService,
    private logger: LoggerService,
  ) {}

  @Get()
  async getSchools(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
  ): Promise<School[]> {
    // OBRIGATÓRIO: subdomain define o tenant - isolamento de dados
    if (!subdomain) {
      this.logger.warn(
        'Schools request without subdomain',
        'SchoolsController',
        { userSub: user.sub },
      );
      return [];
    }

    // Buscar tenant pelo subdomain - SEMPRE usar subdomain, nunca o tenant_id do usuário
    const tenant = await this.tenantsService.getTenantBySubdomain(subdomain);
    if (!tenant) {
      this.logger.warn('Tenant not found for subdomain', 'SchoolsController', {
        subdomain,
      });
      return [];
    }

    this.logger.log('Fetching schools for tenant', 'SchoolsController', {
      subdomain,
      tenantId: tenant.id,
      userSub: user.sub,
    });

    // Retornar apenas escolas do tenant do subdomain
    return this.schoolsService.getSchoolsByTenant(tenant.id);
  }

  @Get('current')
  async getCurrentSchool(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
  ): Promise<School | null> {
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    if (!dbUser || !dbUser.current_school_id) {
      return null;
    }

    const school = await this.schoolsService.getCurrentSchool(dbUser.id);

    // Validar que a escola pertence ao tenant do subdomain
    if (school && subdomain) {
      const tenant = await this.tenantsService.getTenantBySubdomain(subdomain);
      if (tenant && school.tenant_id !== tenant.id) {
        // Escola não pertence a este tenant - retornar null
        this.logger.warn(
          'User current school does not belong to this tenant',
          'SchoolsController',
          {
            subdomain,
            schoolTenantId: school.tenant_id,
            requestedTenantId: tenant.id,
          },
        );
        return null;
      }
    }

    return school;
  }

  @Put('current')
  async setCurrentSchool(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() body: { school_id: string },
  ): Promise<{ success: boolean }> {
    if (!subdomain) {
      throw new BadRequestException('Subdomain is required');
    }

    // Buscar tenant pelo subdomain
    const tenant = await this.tenantsService.getTenantBySubdomain(subdomain);
    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }

    // Verificar se a escola pertence ao tenant do subdomain
    const school = await this.schoolsService.getSchoolById(body.school_id);
    if (!school) {
      throw new BadRequestException('School not found');
    }

    if (school.tenant_id !== tenant.id) {
      this.logger.error(
        'Attempt to access school from different tenant',
        undefined,
        'SchoolsController',
        {
          subdomain,
          schoolId: body.school_id,
          schoolTenantId: school.tenant_id,
          requestedTenantId: tenant.id,
        },
      );
      throw new ForbiddenException(
        'School does not belong to this institution',
      );
    }

    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    if (!dbUser) {
      throw new BadRequestException('User not found');
    }

    await this.schoolsService.setCurrentSchool(
      dbUser.id,
      body.school_id,
      tenant.id,
    );
    return { success: true };
  }

  @Post()
  async createSchool(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() createSchoolDto: CreateSchoolDto,
  ): Promise<School> {
    if (!subdomain) {
      throw new BadRequestException('Subdomain is required');
    }

    // Buscar tenant pelo subdomain
    const tenant = await this.tenantsService.getTenantBySubdomain(subdomain);
    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }

    this.logger.log('Creating school', 'SchoolsController', {
      tenantId: tenant.id,
      subdomain,
      name: createSchoolDto.name,
      userSub: user.sub,
    });

    return this.schoolsService.createSchool(tenant.id, createSchoolDto);
  }

  @Put(':id')
  async updateSchool(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id') schoolId: string,
    @Body() updateSchoolDto: UpdateSchoolDto,
  ): Promise<School> {
    if (!subdomain) {
      throw new BadRequestException('Subdomain is required');
    }

    // Buscar tenant pelo subdomain
    const tenant = await this.tenantsService.getTenantBySubdomain(subdomain);
    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }

    this.logger.log('Updating school', 'SchoolsController', {
      schoolId,
      tenantId: tenant.id,
      subdomain,
      userSub: user.sub,
    });

    return this.schoolsService.updateSchool(
      schoolId,
      tenant.id,
      updateSchoolDto,
    );
  }

  @Delete(':id')
  async deleteSchool(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id') schoolId: string,
  ): Promise<{ message: string }> {
    if (!subdomain) {
      throw new BadRequestException('Subdomain is required');
    }

    // Buscar tenant pelo subdomain
    const tenant = await this.tenantsService.getTenantBySubdomain(subdomain);
    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }

    this.logger.log('Deleting school', 'SchoolsController', {
      schoolId,
      tenantId: tenant.id,
      subdomain,
      userSub: user.sub,
    });

    await this.schoolsService.deleteSchool(schoolId, tenant.id);
    return { message: `School with id '${schoolId}' deleted successfully` };
  }
}

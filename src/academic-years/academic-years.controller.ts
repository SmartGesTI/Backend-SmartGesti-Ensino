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
import { AcademicYearsService } from './academic-years.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateAcademicYearDto } from './dto/create-academic-year.dto';
import { UpdateAcademicYearDto } from './dto/update-academic-year.dto';
import { AcademicYear } from '../common/types';

@Controller('academic-years')
@UseGuards(JwtAuthGuard)
export class AcademicYearsController {
  constructor(
    private academicYearsService: AcademicYearsService,
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
    @Query('school_id') schoolId?: string,
    @Query('status') status?: string,
  ): Promise<AcademicYear[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.academicYearsService.findAll(tenantId, schoolId, status);
  }

  @Get('current')
  async findCurrent(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Query('school_id') schoolId: string,
  ): Promise<AcademicYear | null> {
    if (!schoolId) {
      throw new BadRequestException('school_id é obrigatório');
    }

    const tenantId = await this.getTenantId(subdomain);
    return this.academicYearsService.findCurrent(tenantId, schoolId);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AcademicYear> {
    const tenantId = await this.getTenantId(subdomain);
    const academicYear = await this.academicYearsService.findOne(id, tenantId);

    if (!academicYear) {
      throw new NotFoundException(`Ano letivo com id '${id}' não encontrado`);
    }

    return academicYear;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateAcademicYearDto,
  ): Promise<AcademicYear> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.academicYearsService.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAcademicYearDto,
  ): Promise<AcademicYear> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.academicYearsService.update(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/close')
  async close(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AcademicYear> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return this.academicYearsService.close(id, tenantId, dbUser.id);
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

    await this.academicYearsService.remove(id, tenantId, dbUser.id);

    return { message: `Ano letivo removido com sucesso` };
  }
}

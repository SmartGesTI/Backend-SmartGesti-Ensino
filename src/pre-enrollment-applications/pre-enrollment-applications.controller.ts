import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PreEnrollmentApplicationsService } from './pre-enrollment-applications.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  CreatePreEnrollmentApplicationDto,
  UpdatePreEnrollmentApplicationDto,
  ReviewApplicationDto,
} from './dto/create-pre-enrollment-application.dto';
import { PreEnrollmentApplication } from '../common/types';

@Controller('pre-enrollment-applications')
@UseGuards(JwtAuthGuard)
export class PreEnrollmentApplicationsController {
  constructor(
    private service: PreEnrollmentApplicationsService,
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
    @Query('householdId') householdId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<PreEnrollmentApplication[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.findAll(tenantId, {
      schoolId,
      householdId,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PreEnrollmentApplication> {
    const tenantId = await this.getTenantId(subdomain);
    const application = await this.service.findOne(id, tenantId);

    if (!application) {
      throw new NotFoundException(`Application com id '${id}' não encontrada`);
    }

    return application;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreatePreEnrollmentApplicationDto,
  ): Promise<PreEnrollmentApplication> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log(
      'Creating pre-enrollment application',
      'PreEnrollmentApplicationsController',
      {
        userSub: user.sub,
        householdId: dto.household_id,
      },
    );

    return this.service.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePreEnrollmentApplicationDto,
  ): Promise<PreEnrollmentApplication> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.service.update(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/submit')
  async submit(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PreEnrollmentApplication> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log(
      'Submitting pre-enrollment application',
      'PreEnrollmentApplicationsController',
      {
        userSub: user.sub,
        applicationId: id,
      },
    );

    return this.service.submit(id, tenantId, dbUser?.id);
  }

  @Post(':id/review')
  async review(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewApplicationDto,
  ): Promise<PreEnrollmentApplication> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log(
      'Reviewing pre-enrollment application',
      'PreEnrollmentApplicationsController',
      {
        userSub: user.sub,
        applicationId: id,
        decision: dto.decision,
      },
    );

    return this.service.review(id, tenantId, dto, dbUser?.id);
  }

  @Patch(':id/status')
  async updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: string,
  ): Promise<PreEnrollmentApplication> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!status) {
      throw new BadRequestException('Status é obrigatório');
    }

    return this.service.updateStatus(id, tenantId, status, dbUser?.id);
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

    return { message: 'Application removida com sucesso' };
  }
}

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
import { GradingPeriodsService } from './grading-periods.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateGradingPeriodDto } from './dto/create-grading-period.dto';
import { UpdateGradingPeriodDto } from './dto/update-grading-period.dto';
import { GradingPeriod } from '../common/types';

@Controller('grading-periods')
@UseGuards(JwtAuthGuard)
export class GradingPeriodsController {
  constructor(
    private gradingPeriodsService: GradingPeriodsService,
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
    @Query('academicYearId') academicYearId?: string,
    @Query('active') activeOnly?: boolean,
  ): Promise<GradingPeriod[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.gradingPeriodsService.findAll(tenantId, {
      schoolId,
      academicYearId,
      activeOnly,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GradingPeriod> {
    const tenantId = await this.getTenantId(subdomain);
    const gradingPeriod = await this.gradingPeriodsService.findOne(
      id,
      tenantId,
    );

    if (!gradingPeriod) {
      throw new NotFoundException(
        `Período de nota com id '${id}' não encontrado`,
      );
    }

    return gradingPeriod;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateGradingPeriodDto,
  ): Promise<GradingPeriod> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.gradingPeriodsService.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGradingPeriodDto,
  ): Promise<GradingPeriod> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.gradingPeriodsService.update(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/close')
  async close(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GradingPeriod> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return this.gradingPeriodsService.close(id, tenantId, dbUser.id);
  }

  @Post(':id/reopen')
  async reopen(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GradingPeriod> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return this.gradingPeriodsService.reopen(id, tenantId, dbUser.id);
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

    await this.gradingPeriodsService.remove(id, tenantId, dbUser.id);

    return { message: 'Período de nota removido com sucesso' };
  }
}

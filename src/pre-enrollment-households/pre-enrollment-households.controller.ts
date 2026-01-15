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
import { PreEnrollmentHouseholdsService } from './pre-enrollment-households.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  CreatePreEnrollmentHouseholdDto,
  UpdatePreEnrollmentHouseholdDto,
} from './dto/create-pre-enrollment-household.dto';
import { PreEnrollmentHousehold } from '../common/types';

@Controller('pre-enrollment-households')
@UseGuards(JwtAuthGuard)
export class PreEnrollmentHouseholdsController {
  constructor(
    private service: PreEnrollmentHouseholdsService,
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
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<PreEnrollmentHousehold[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.findAll(tenantId, {
      schoolId,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('by-reference/:code')
  async findByReferenceCode(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('code') code: string,
  ): Promise<PreEnrollmentHousehold> {
    const tenantId = await this.getTenantId(subdomain);
    const household = await this.service.findByReferenceCode(code, tenantId);

    if (!household) {
      throw new NotFoundException(
        `Household com código '${code}' não encontrado`,
      );
    }

    return household;
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PreEnrollmentHousehold> {
    const tenantId = await this.getTenantId(subdomain);
    const household = await this.service.findOne(id, tenantId);

    if (!household) {
      throw new NotFoundException(`Household com id '${id}' não encontrado`);
    }

    return household;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreatePreEnrollmentHouseholdDto,
  ): Promise<PreEnrollmentHousehold> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log(
      'Creating pre-enrollment household',
      'PreEnrollmentHouseholdsController',
      {
        userSub: user.sub,
        schoolId: dto.school_id,
      },
    );

    return this.service.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePreEnrollmentHouseholdDto,
  ): Promise<PreEnrollmentHousehold> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.service.update(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/submit')
  async submit(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PreEnrollmentHousehold> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log(
      'Submitting pre-enrollment household',
      'PreEnrollmentHouseholdsController',
      {
        userSub: user.sub,
        householdId: id,
      },
    );

    return this.service.submit(id, tenantId, dbUser?.id);
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

    return { message: 'Household removido com sucesso' };
  }
}

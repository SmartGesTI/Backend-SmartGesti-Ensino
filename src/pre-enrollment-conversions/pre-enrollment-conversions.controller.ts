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
import { PreEnrollmentConversionsService } from './pre-enrollment-conversions.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  CreatePreEnrollmentConversionDto,
  ConvertApplicationDto,
} from './dto/create-pre-enrollment-conversion.dto';
import { PreEnrollmentConversion } from '../common/types';

@Controller('pre-enrollment-conversions')
@UseGuards(JwtAuthGuard)
export class PreEnrollmentConversionsController {
  constructor(
    private service: PreEnrollmentConversionsService,
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
    @Query('householdId') householdId?: string,
    @Query('applicationId') applicationId?: string,
  ): Promise<PreEnrollmentConversion[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.findAll(tenantId, { householdId, applicationId });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PreEnrollmentConversion> {
    const tenantId = await this.getTenantId(subdomain);
    const conversion = await this.service.findOne(id, tenantId);

    if (!conversion) {
      throw new NotFoundException(`Conversion com id '${id}' não encontrada`);
    }

    return conversion;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreatePreEnrollmentConversionDto,
  ): Promise<PreEnrollmentConversion> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log(
      'Creating pre-enrollment conversion',
      'PreEnrollmentConversionsController',
      {
        userSub: user.sub,
        applicationId: dto.application_id,
      },
    );

    return this.service.create(tenantId, dto, dbUser?.id);
  }

  @Post(':applicationId/convert')
  async convert(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('applicationId', ParseUUIDPipe) applicationId: string,
    @Body() dto: ConvertApplicationDto,
  ): Promise<PreEnrollmentConversion> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log(
      'Converting pre-enrollment application',
      'PreEnrollmentConversionsController',
      {
        userSub: user.sub,
        applicationId,
      },
    );

    return this.service.convert(applicationId, tenantId, dto, dbUser?.id);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    const tenantId = await this.getTenantId(subdomain);
    await this.service.remove(id, tenantId);

    return { message: 'Conversion removida com sucesso' };
  }
}

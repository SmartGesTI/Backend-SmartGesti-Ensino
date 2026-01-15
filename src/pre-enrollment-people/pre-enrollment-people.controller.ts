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
import { PreEnrollmentPeopleService } from './pre-enrollment-people.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  CreatePreEnrollmentPersonDto,
  UpdatePreEnrollmentPersonDto,
} from './dto/create-pre-enrollment-person.dto';
import { PreEnrollmentPerson } from '../common/types';

@Controller('pre-enrollment-people')
@UseGuards(JwtAuthGuard)
export class PreEnrollmentPeopleController {
  constructor(
    private service: PreEnrollmentPeopleService,
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
    @Query('role') role?: string,
  ): Promise<PreEnrollmentPerson[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.findAll(tenantId, { householdId, applicationId, role });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PreEnrollmentPerson> {
    const tenantId = await this.getTenantId(subdomain);
    const person = await this.service.findOne(id, tenantId);

    if (!person) {
      throw new NotFoundException(`Person com id '${id}' não encontrada`);
    }

    return person;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreatePreEnrollmentPersonDto,
  ): Promise<PreEnrollmentPerson> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log(
      'Creating pre-enrollment person',
      'PreEnrollmentPeopleController',
      {
        userSub: user.sub,
        role: dto.role,
      },
    );

    return this.service.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePreEnrollmentPersonDto,
  ): Promise<PreEnrollmentPerson> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.service.update(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/set-primary')
  async setPrimary(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PreEnrollmentPerson> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log(
      'Setting pre-enrollment person as primary',
      'PreEnrollmentPeopleController',
      {
        userSub: user.sub,
        personId: id,
      },
    );

    return this.service.setPrimary(id, tenantId, dbUser?.id);
  }

  @Post(':id/match')
  async match(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('matchedPersonId', ParseUUIDPipe) matchedPersonId: string,
  ): Promise<PreEnrollmentPerson> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log(
      'Matching pre-enrollment person',
      'PreEnrollmentPeopleController',
      {
        userSub: user.sub,
        personId: id,
        matchedPersonId,
      },
    );

    return this.service.match(id, tenantId, matchedPersonId, dbUser?.id);
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

    return { message: 'Person removida com sucesso' };
  }
}

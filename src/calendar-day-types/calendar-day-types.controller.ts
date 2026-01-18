import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CalendarDayTypesService } from './calendar-day-types.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateCalendarDayTypeDto } from './dto/create-calendar-day-type.dto';
import {
  UpdateCalendarDayTypeDto,
  ShareCalendarDayTypeDto,
} from './dto/update-calendar-day-type.dto';
import type { CalendarDayType } from '../common/types';

@Controller('calendar-day-types')
@UseGuards(JwtAuthGuard)
export class CalendarDayTypesController {
  constructor(
    private calendarDayTypesService: CalendarDayTypesService,
    private usersService: UsersService,
    private tenantsService: TenantsService,
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

  private getSchoolId(schoolIdHeader: string | undefined): string {
    if (!schoolIdHeader) {
      throw new BadRequestException('Header x-school-id e obrigatorio');
    }
    return schoolIdHeader;
  }

  /**
   * Lista tipos de dia visiveis para a escola
   * GET /calendar-day-types
   */
  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Headers('x-school-id') schoolIdHeader: string | undefined,
    @Query('includeSystem') includeSystem?: string,
    @Query('includeShared') includeShared?: string,
  ): Promise<CalendarDayType[]> {
    const tenantId = await this.getTenantId(subdomain);
    const schoolId = this.getSchoolId(schoolIdHeader);

    return this.calendarDayTypesService.findAll(tenantId, schoolId, {
      includeSystem: includeSystem !== 'false',
      includeShared: includeShared !== 'false',
    });
  }

  /**
   * Busca tipo de dia por ID
   * GET /calendar-day-types/:id
   */
  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Headers('x-school-id') schoolIdHeader: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CalendarDayType> {
    const tenantId = await this.getTenantId(subdomain);
    const schoolId = this.getSchoolId(schoolIdHeader);

    const dayType = await this.calendarDayTypesService.findOne(
      id,
      tenantId,
      schoolId,
    );

    if (!dayType) {
      throw new NotFoundException(`Tipo de dia com id '${id}' nao encontrado`);
    }

    return dayType;
  }

  /**
   * Busca tipo de dia por slug
   * GET /calendar-day-types/slug/:slug
   */
  @Get('slug/:slug')
  async findBySlug(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Headers('x-school-id') schoolIdHeader: string | undefined,
    @Param('slug') slug: string,
  ): Promise<CalendarDayType> {
    const tenantId = await this.getTenantId(subdomain);
    const schoolId = this.getSchoolId(schoolIdHeader);

    const dayType = await this.calendarDayTypesService.findBySlug(
      slug,
      tenantId,
      schoolId,
    );

    if (!dayType) {
      throw new NotFoundException(
        `Tipo de dia com slug '${slug}' nao encontrado`,
      );
    }

    return dayType;
  }

  /**
   * Cria novo tipo de dia
   * POST /calendar-day-types
   */
  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Headers('x-school-id') schoolIdHeader: string | undefined,
    @Body() dto: CreateCalendarDayTypeDto,
  ): Promise<CalendarDayType> {
    const tenantId = await this.getTenantId(subdomain);
    const schoolId = this.getSchoolId(schoolIdHeader);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.calendarDayTypesService.create(
      tenantId,
      schoolId,
      dto,
      dbUser?.id,
    );
  }

  /**
   * Atualiza tipo de dia
   * PUT /calendar-day-types/:id
   */
  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Headers('x-school-id') schoolIdHeader: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCalendarDayTypeDto,
  ): Promise<CalendarDayType> {
    const tenantId = await this.getTenantId(subdomain);
    const schoolId = this.getSchoolId(schoolIdHeader);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.calendarDayTypesService.update(
      id,
      tenantId,
      schoolId,
      dto,
      dbUser?.id,
    );
  }

  /**
   * Compartilha ou descompartilha tipo de dia
   * PUT /calendar-day-types/:id/share
   */
  @Put(':id/share')
  async share(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Headers('x-school-id') schoolIdHeader: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShareCalendarDayTypeDto,
  ): Promise<CalendarDayType> {
    const tenantId = await this.getTenantId(subdomain);
    const schoolId = this.getSchoolId(schoolIdHeader);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.calendarDayTypesService.share(
      id,
      tenantId,
      schoolId,
      dto.is_shared,
      dbUser?.id,
    );
  }

  /**
   * Verifica uso do tipo por outras escolas
   * GET /calendar-day-types/:id/usage
   */
  @Get(':id/usage')
  async checkUsage(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Headers('x-school-id') schoolIdHeader: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ canDelete: boolean; usedBySchools: string[]; totalSchoolsUsing: number }> {
    const tenantId = await this.getTenantId(subdomain);
    const schoolId = this.getSchoolId(schoolIdHeader);

    // Verificar se o tipo existe
    const dayType = await this.calendarDayTypesService.findOne(
      id,
      tenantId,
      schoolId,
    );

    if (!dayType) {
      throw new NotFoundException(`Tipo de dia com id '${id}' nao encontrado`);
    }

    return this.calendarDayTypesService.checkUsage(id, schoolId);
  }

  /**
   * Remove tipo de dia (soft delete)
   * DELETE /calendar-day-types/:id
   */
  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Headers('x-school-id') schoolIdHeader: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    const tenantId = await this.getTenantId(subdomain);
    const schoolId = this.getSchoolId(schoolIdHeader);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuario nao encontrado');
    }

    await this.calendarDayTypesService.remove(id, tenantId, schoolId, dbUser.id);

    return { message: 'Tipo de dia removido com sucesso' };
  }
}

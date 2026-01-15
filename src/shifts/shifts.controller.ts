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
import { ShiftsService } from './shifts.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { Shift } from '../common/types';

@Controller('shifts')
@UseGuards(JwtAuthGuard)
export class ShiftsController {
  constructor(
    private shiftsService: ShiftsService,
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
    @Query('active') activeOnly?: boolean,
  ): Promise<Shift[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.shiftsService.findAll(tenantId, activeOnly);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Shift> {
    const tenantId = await this.getTenantId(subdomain);
    const shift = await this.shiftsService.findOne(id, tenantId);

    if (!shift) {
      throw new NotFoundException(`Turno com id '${id}' não encontrado`);
    }

    return shift;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateShiftDto,
  ): Promise<Shift> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.shiftsService.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateShiftDto,
  ): Promise<Shift> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.shiftsService.update(id, tenantId, dto, dbUser?.id);
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

    await this.shiftsService.remove(id, tenantId, dbUser.id);

    return { message: `Turno removido com sucesso` };
  }
}

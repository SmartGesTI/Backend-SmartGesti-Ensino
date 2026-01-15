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
import { TimeSlotsService } from './time-slots.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateTimeSlotDto } from './dto/create-time-slot.dto';
import { UpdateTimeSlotDto } from './dto/update-time-slot.dto';
import { TimeSlot } from '../common/types';

@Controller('time-slots')
@UseGuards(JwtAuthGuard)
export class TimeSlotsController {
  constructor(
    private timeSlotsService: TimeSlotsService,
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
    @Query('shiftId') shiftId?: string,
    @Query('active') activeOnly?: boolean,
  ): Promise<TimeSlot[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.timeSlotsService.findAll(tenantId, {
      schoolId,
      shiftId,
      activeOnly,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TimeSlot> {
    const tenantId = await this.getTenantId(subdomain);
    const timeSlot = await this.timeSlotsService.findOne(id, tenantId);

    if (!timeSlot) {
      throw new NotFoundException(`Time slot com id '${id}' não encontrado`);
    }

    return timeSlot;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateTimeSlotDto,
  ): Promise<TimeSlot> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.timeSlotsService.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTimeSlotDto,
  ): Promise<TimeSlot> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.timeSlotsService.update(id, tenantId, dto, dbUser?.id);
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

    await this.timeSlotsService.remove(id, tenantId, dbUser.id);

    return { message: 'Time slot removido com sucesso' };
  }
}

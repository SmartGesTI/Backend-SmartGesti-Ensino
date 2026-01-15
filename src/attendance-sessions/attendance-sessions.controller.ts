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
import { AttendanceSessionsService } from './attendance-sessions.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateAttendanceSessionDto } from './dto/create-attendance-session.dto';
import { UpdateAttendanceSessionDto } from './dto/update-attendance-session.dto';
import {
  CreateAttendanceRecordDto,
  BulkCreateRecordsDto,
} from './dto/create-attendance-record.dto';
import { UpdateAttendanceRecordDto } from './dto/update-attendance-record.dto';
import { AttendanceSession, AttendanceRecord } from '../common/types';

@Controller('attendance-sessions')
@UseGuards(JwtAuthGuard)
export class AttendanceSessionsController {
  constructor(
    private attendanceSessionsService: AttendanceSessionsService,
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

  // ======================
  // Session Endpoints
  // ======================

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Query('schoolId') schoolId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('classGroupId') classGroupId?: string,
    @Query('classGroupSubjectId') classGroupSubjectId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: string,
  ): Promise<AttendanceSession[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.attendanceSessionsService.findAll(tenantId, {
      schoolId,
      academicYearId,
      classGroupId,
      classGroupSubjectId,
      startDate,
      endDate,
      status,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AttendanceSession> {
    const tenantId = await this.getTenantId(subdomain);
    const session = await this.attendanceSessionsService.findOne(id, tenantId);

    if (!session) {
      throw new NotFoundException(
        `Sessão de chamada com id '${id}' não encontrada`,
      );
    }

    return session;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateAttendanceSessionDto,
  ): Promise<AttendanceSession> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.attendanceSessionsService.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttendanceSessionDto,
  ): Promise<AttendanceSession> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.attendanceSessionsService.update(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/close')
  async close(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AttendanceSession> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return this.attendanceSessionsService.close(id, tenantId, dbUser.id);
  }

  @Post(':id/reopen')
  async reopen(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AttendanceSession> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return this.attendanceSessionsService.reopen(id, tenantId, dbUser.id);
  }

  @Post(':id/cancel')
  async cancel(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AttendanceSession> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return this.attendanceSessionsService.cancel(id, tenantId, dbUser.id);
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

    await this.attendanceSessionsService.remove(id, tenantId, dbUser.id);

    return { message: 'Sessão de chamada removida com sucesso' };
  }

  // ==============================
  // Attendance Records Endpoints
  // ==============================

  @Get(':id/records')
  async findRecords(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) sessionId: string,
  ): Promise<AttendanceRecord[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.attendanceSessionsService.findRecords(sessionId, tenantId);
  }

  @Post(':id/records')
  async createRecord(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) sessionId: string,
    @Body() dto: CreateAttendanceRecordDto,
  ): Promise<AttendanceRecord> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.attendanceSessionsService.createRecord(
      sessionId,
      tenantId,
      dto,
      dbUser?.id,
    );
  }

  @Put(':id/records/:recordId')
  async updateRecord(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) sessionId: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Body() dto: UpdateAttendanceRecordDto,
  ): Promise<AttendanceRecord> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.attendanceSessionsService.updateRecord(
      recordId,
      tenantId,
      dto,
      dbUser?.id,
    );
  }

  @Post(':id/records/bulk')
  async createRecordsBulk(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) sessionId: string,
    @Body() dto: BulkCreateRecordsDto,
  ): Promise<AttendanceRecord[]> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.attendanceSessionsService.createRecordsBulk(
      sessionId,
      tenantId,
      dto.records,
      dbUser?.id,
    );
  }

  @Delete(':id/records/:recordId')
  async removeRecord(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) sessionId: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
  ): Promise<{ message: string }> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.attendanceSessionsService.removeRecord(
      recordId,
      tenantId,
      dbUser.id,
    );

    return { message: 'Registro de presença removido com sucesso' };
  }
}

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
import { EnrollmentsService } from './enrollments.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto';
import {
  UpdateEnrollmentDto,
  AssignClassDto,
  LeaveSchoolDto,
} from './dto/update-enrollment.dto';
import { InitiateTransferDto } from './dto/initiate-transfer.dto';
import {
  TransfersService,
  TransferWithRelations,
} from '../transfers/transfers.service';
import {
  Enrollment,
  EnrollmentWithRelations,
  EnrollmentClassMembership,
  EnrollmentEvent,
  PaginatedResult,
} from '../common/types';

@Controller('enrollments')
@UseGuards(JwtAuthGuard)
export class EnrollmentsController {
  constructor(
    private enrollmentsService: EnrollmentsService,
    private transfersService: TransfersService,
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
    @Query('academic_year_id') academicYearId?: string,
    @Query('student_id') studentId?: string,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<PaginatedResult<EnrollmentWithRelations>> {
    const tenantId = await this.getTenantId(subdomain);
    return this.enrollmentsService.findAll(
      tenantId,
      { schoolId, academicYearId, studentId, status },
      page || 1,
      limit || 20,
    );
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EnrollmentWithRelations> {
    const tenantId = await this.getTenantId(subdomain);
    const enrollment = await this.enrollmentsService.findOne(id, tenantId);

    if (!enrollment) {
      throw new NotFoundException(`Matrícula com id '${id}' não encontrada`);
    }

    return enrollment;
  }

  @Get(':id/events')
  async getEvents(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EnrollmentEvent[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.enrollmentsService.getEvents(id, tenantId);
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateEnrollmentDto,
  ): Promise<EnrollmentWithRelations> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Creating enrollment', 'EnrollmentsController', {
      userSub: user.sub,
      studentId: dto.student_id,
      academicYearId: dto.academic_year_id,
    });

    return this.enrollmentsService.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEnrollmentDto,
  ): Promise<Enrollment> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.enrollmentsService.update(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/assign-class')
  async assignClass(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignClassDto,
  ): Promise<EnrollmentClassMembership> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Assigning class to enrollment', 'EnrollmentsController', {
      userSub: user.sub,
      enrollmentId: id,
      classGroupId: dto.class_group_id,
    });

    return this.enrollmentsService.assignClass(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/leave')
  async leaveSchool(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LeaveSchoolDto,
  ): Promise<Enrollment> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Student leaving school', 'EnrollmentsController', {
      userSub: user.sub,
      enrollmentId: id,
      reason: dto.reason,
    });

    return this.enrollmentsService.leaveSchool(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/transfer')
  async initiateTransfer(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InitiateTransferDto,
  ): Promise<TransferWithRelations> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    // Buscar matrícula para obter student_id e school_id
    const enrollment = await this.enrollmentsService.findOne(id, tenantId);
    if (!enrollment) {
      throw new NotFoundException(`Matrícula com id '${id}' não encontrada`);
    }

    this.logger.log(
      'Initiating transfer from enrollment',
      'EnrollmentsController',
      {
        userSub: user.sub,
        enrollmentId: id,
        toTenantId: dto.to_tenant_id,
      },
    );

    // Criar transferência usando o TransfersService
    return this.transfersService.create(
      tenantId,
      {
        student_id: enrollment.student_id,
        from_school_id: enrollment.school_id,
        to_tenant_id: dto.to_tenant_id,
        to_school_id: dto.to_school_id,
        to_academic_year_id: dto.to_academic_year_id,
        notes: dto.notes,
        metadata: dto.metadata,
      },
      dbUser?.id,
    );
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

    await this.enrollmentsService.remove(id, tenantId, dbUser.id);

    return { message: `Matrícula removida com sucesso` };
  }
}

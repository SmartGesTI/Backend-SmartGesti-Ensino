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
import { StudentSubjectResultsService } from './student-subject-results.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateStudentSubjectResultDto } from './dto/create-student-subject-result.dto';
import { UpdateStudentSubjectResultDto } from './dto/update-student-subject-result.dto';
import { StudentSubjectResult } from '../common/types';

@Controller('student-subject-results')
@UseGuards(JwtAuthGuard)
export class StudentSubjectResultsController {
  constructor(
    private studentSubjectResultsService: StudentSubjectResultsService,
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
    @Query('enrollmentId') enrollmentId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('gradingPeriodId') gradingPeriodId?: string,
    @Query('resultStatus') resultStatus?: string,
    @Query('locked') lockedOnly?: boolean,
  ): Promise<StudentSubjectResult[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.studentSubjectResultsService.findAll(tenantId, {
      schoolId,
      academicYearId,
      enrollmentId,
      subjectId,
      gradingPeriodId,
      resultStatus,
      lockedOnly,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StudentSubjectResult> {
    const tenantId = await this.getTenantId(subdomain);
    const result = await this.studentSubjectResultsService.findOne(
      id,
      tenantId,
    );

    if (!result) {
      throw new NotFoundException(`Resultado com id '${id}' não encontrado`);
    }

    return result;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateStudentSubjectResultDto,
  ): Promise<StudentSubjectResult> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.studentSubjectResultsService.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentSubjectResultDto,
  ): Promise<StudentSubjectResult> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.studentSubjectResultsService.update(
      id,
      tenantId,
      dto,
      dbUser?.id,
    );
  }

  @Post(':id/compute')
  async compute(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StudentSubjectResult> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return this.studentSubjectResultsService.compute(id, tenantId, dbUser.id);
  }

  @Post(':id/lock')
  async lock(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StudentSubjectResult> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return this.studentSubjectResultsService.lock(id, tenantId, dbUser.id);
  }

  @Post(':id/unlock')
  async unlock(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StudentSubjectResult> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return this.studentSubjectResultsService.unlock(id, tenantId, dbUser.id);
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

    await this.studentSubjectResultsService.remove(id, tenantId, dbUser.id);

    return { message: 'Resultado removido com sucesso' };
  }
}

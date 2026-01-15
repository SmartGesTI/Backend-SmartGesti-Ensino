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
import { StudentsService } from './students.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  CreateStudentDto,
  CreateStudentFromPersonDto,
} from './dto/create-student.dto';
import {
  UpdateStudentTenantProfileDto,
  UpdateStudentSchoolProfileDto,
  AssociateStudentToSchoolDto,
} from './dto/update-student.dto';
import {
  CreateStudentGuardianLinkDto,
  UpdateStudentGuardianLinkDto,
} from './dto/create-student-guardian-link.dto';
import {
  StudentWithProfiles,
  StudentTenantProfile,
  StudentSchoolProfile,
  StudentGuardianLink,
  StudentGuardianLinkWithDetails,
  PaginatedResult,
} from '../common/types';

@Controller('students')
@UseGuards(JwtAuthGuard)
export class StudentsController {
  constructor(
    private studentsService: StudentsService,
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
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ): Promise<PaginatedResult<StudentWithProfiles>> {
    const tenantId = await this.getTenantId(subdomain);

    this.logger.log('Listing students', 'StudentsController', {
      userSub: user.sub,
      tenantId,
      page,
      limit,
      search,
      status,
    });

    return this.studentsService.findAll(
      tenantId,
      page || 1,
      limit || 20,
      search,
      status,
    );
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StudentWithProfiles> {
    const tenantId = await this.getTenantId(subdomain);

    const student = await this.studentsService.findOne(id, tenantId);

    if (!student) {
      throw new NotFoundException(`Aluno com id '${id}' não encontrado`);
    }

    return student;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() createStudentDto: CreateStudentDto,
  ): Promise<StudentWithProfiles> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Creating student', 'StudentsController', {
      userSub: user.sub,
      tenantId,
      name: createStudentDto.full_name,
    });

    return this.studentsService.create(tenantId, createStudentDto, dbUser?.id);
  }

  @Post('from-person')
  async createFromPerson(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateStudentFromPersonDto,
  ): Promise<StudentWithProfiles> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Creating student from person', 'StudentsController', {
      userSub: user.sub,
      tenantId,
      personId: dto.person_id,
    });

    return this.studentsService.createFromPerson(tenantId, dto, dbUser?.id);
  }

  @Put(':id/tenant-profile')
  async updateTenantProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStudentTenantProfileDto,
  ): Promise<StudentTenantProfile> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Updating student tenant profile', 'StudentsController', {
      userSub: user.sub,
      studentId: id,
      tenantId,
    });

    return this.studentsService.updateTenantProfile(
      id,
      tenantId,
      dto,
      dbUser?.id,
    );
  }

  @Get(':id/tenant-profile')
  async getTenantProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StudentTenantProfile> {
    const tenantId = await this.getTenantId(subdomain);

    const student = await this.studentsService.findOne(id, tenantId);
    if (!student || !student.tenant_profile) {
      throw new NotFoundException('Perfil do aluno não encontrado');
    }

    return student.tenant_profile;
  }

  @Post(':id/schools')
  async associateToSchool(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssociateStudentToSchoolDto,
  ): Promise<StudentSchoolProfile> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Associating student to school', 'StudentsController', {
      userSub: user.sub,
      studentId: id,
      schoolId: dto.school_id,
    });

    return this.studentsService.associateToSchool(
      id,
      tenantId,
      dto,
      dbUser?.id,
    );
  }

  @Get(':id/schools')
  async getSchoolProfiles(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StudentSchoolProfile[]> {
    const tenantId = await this.getTenantId(subdomain);

    const student = await this.studentsService.findOne(id, tenantId);
    if (!student) {
      throw new NotFoundException('Aluno não encontrado');
    }

    return student.school_profiles || [];
  }

  @Put(':id/schools/:schoolId')
  async updateSchoolProfile(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('schoolId', ParseUUIDPipe) schoolId: string,
    @Body() dto: UpdateStudentSchoolProfileDto,
  ): Promise<StudentSchoolProfile> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Updating student school profile', 'StudentsController', {
      userSub: user.sub,
      studentId: id,
      schoolId,
    });

    return this.studentsService.updateSchoolProfile(
      id,
      schoolId,
      tenantId,
      dto,
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

    this.logger.log('Removing student from tenant', 'StudentsController', {
      userSub: user.sub,
      studentId: id,
      tenantId,
    });

    await this.studentsService.remove(id, tenantId, dbUser.id);

    return { message: `Aluno removido com sucesso desta organização` };
  }

  // ============================================
  // Student Guardian Links Endpoints
  // ============================================

  @Get(':id/guardians')
  async findGuardians(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) studentId: string,
  ): Promise<StudentGuardianLinkWithDetails[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.studentsService.findGuardians(studentId, tenantId);
  }

  @Post(':id/guardians')
  async addGuardian(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) studentId: string,
    @Body() dto: CreateStudentGuardianLinkDto,
  ): Promise<StudentGuardianLink> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Adding guardian to student', 'StudentsController', {
      userSub: user.sub,
      studentId,
      guardianId: dto.guardian_id,
    });

    return this.studentsService.addGuardian(
      studentId,
      tenantId,
      dto,
      dbUser?.id,
    );
  }

  @Put(':id/guardians/:linkId')
  async updateGuardianLink(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) studentId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
    @Body() dto: UpdateStudentGuardianLinkDto,
  ): Promise<StudentGuardianLink> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log('Updating guardian link', 'StudentsController', {
      userSub: user.sub,
      studentId,
      linkId,
    });

    return this.studentsService.updateGuardianLink(
      linkId,
      tenantId,
      dto,
      dbUser?.id,
    );
  }

  @Delete(':id/guardians/:linkId')
  async removeGuardian(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) studentId: string,
    @Param('linkId', ParseUUIDPipe) linkId: string,
  ): Promise<{ message: string }> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    this.logger.log('Removing guardian from student', 'StudentsController', {
      userSub: user.sub,
      studentId,
      linkId,
    });

    await this.studentsService.removeGuardian(
      studentId,
      linkId,
      tenantId,
      dbUser.id,
    );

    return { message: 'Responsável desvinculado com sucesso' };
  }
}

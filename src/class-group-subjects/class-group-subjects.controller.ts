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
import { ClassGroupSubjectsService } from './class-group-subjects.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateClassGroupSubjectDto } from './dto/create-class-group-subject.dto';
import { UpdateClassGroupSubjectDto } from './dto/update-class-group-subject.dto';
import { AssignTeacherDto } from './dto/assign-teacher.dto';
import { ClassGroupSubject } from '../common/types';

@Controller('class-group-subjects')
@UseGuards(JwtAuthGuard)
export class ClassGroupSubjectsController {
  constructor(
    private classGroupSubjectsService: ClassGroupSubjectsService,
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
    @Query('classGroupId') classGroupId?: string,
    @Query('subjectId') subjectId?: string,
    @Query('active') activeOnly?: boolean,
  ): Promise<ClassGroupSubject[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.classGroupSubjectsService.findAll(tenantId, {
      schoolId,
      academicYearId,
      classGroupId,
      subjectId,
      activeOnly,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ClassGroupSubject> {
    const tenantId = await this.getTenantId(subdomain);
    const classGroupSubject = await this.classGroupSubjectsService.findOne(
      id,
      tenantId,
    );

    if (!classGroupSubject) {
      throw new NotFoundException(
        `Class group subject com id '${id}' não encontrado`,
      );
    }

    return classGroupSubject;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateClassGroupSubjectDto,
  ): Promise<ClassGroupSubject> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.classGroupSubjectsService.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassGroupSubjectDto,
  ): Promise<ClassGroupSubject> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.classGroupSubjectsService.update(id, tenantId, dto, dbUser?.id);
  }

  @Put(':id/assign-teacher')
  async assignTeacher(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignTeacherDto,
  ): Promise<ClassGroupSubject> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.classGroupSubjectsService.assignTeacher(
      id,
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

    await this.classGroupSubjectsService.remove(id, tenantId, dbUser.id);

    return { message: 'Class group subject removido com sucesso' };
  }
}

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
import { CurriculumService } from './curriculum.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateCurriculumDto } from './dto/create-curriculum.dto';
import { UpdateCurriculumDto } from './dto/update-curriculum.dto';
import { CreateCurriculumSubjectDto } from './dto/create-curriculum-subject.dto';
import { UpdateCurriculumSubjectDto } from './dto/update-curriculum-subject.dto';
import { Curriculum, CurriculumSubject } from '../common/types';

@Controller('curriculum')
@UseGuards(JwtAuthGuard)
export class CurriculumController {
  constructor(
    private curriculumService: CurriculumService,
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
  // Curriculum Endpoints
  // ======================

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Query('schoolId') schoolId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('gradeLevelId') gradeLevelId?: string,
    @Query('status') status?: string,
  ): Promise<Curriculum[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.curriculumService.findAll(tenantId, {
      schoolId,
      academicYearId,
      gradeLevelId,
      status,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Curriculum> {
    const tenantId = await this.getTenantId(subdomain);
    const curriculum = await this.curriculumService.findOne(id, tenantId);

    if (!curriculum) {
      throw new NotFoundException(`Currículo com id '${id}' não encontrado`);
    }

    return curriculum;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateCurriculumDto,
  ): Promise<Curriculum> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.curriculumService.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCurriculumDto,
  ): Promise<Curriculum> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.curriculumService.update(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/activate')
  async activate(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Curriculum> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return this.curriculumService.activate(id, tenantId, dbUser.id);
  }

  @Post(':id/archive')
  async archive(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Curriculum> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return this.curriculumService.archive(id, tenantId, dbUser.id);
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

    await this.curriculumService.remove(id, tenantId, dbUser.id);

    return { message: 'Currículo removido com sucesso' };
  }

  // ==============================
  // Curriculum Subjects Endpoints
  // ==============================

  @Get(':id/subjects')
  async findSubjects(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) curriculumId: string,
  ): Promise<CurriculumSubject[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.curriculumService.findSubjects(curriculumId, tenantId);
  }

  @Get(':id/subjects/:subjectId')
  async findSubjectOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) curriculumId: string,
    @Param('subjectId', ParseUUIDPipe) curriculumSubjectId: string,
  ): Promise<CurriculumSubject> {
    const tenantId = await this.getTenantId(subdomain);
    const subject = await this.curriculumService.findSubjectOne(
      curriculumSubjectId,
      tenantId,
    );

    if (!subject) {
      throw new NotFoundException(
        `Curriculum subject com id '${curriculumSubjectId}' não encontrado`,
      );
    }

    return subject;
  }

  @Post(':id/subjects')
  async addSubject(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) curriculumId: string,
    @Body() dto: CreateCurriculumSubjectDto,
  ): Promise<CurriculumSubject> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.curriculumService.addSubject(
      curriculumId,
      tenantId,
      dto,
      dbUser?.id,
    );
  }

  @Put(':id/subjects/:subjectId')
  async updateSubject(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) curriculumId: string,
    @Param('subjectId', ParseUUIDPipe) curriculumSubjectId: string,
    @Body() dto: UpdateCurriculumSubjectDto,
  ): Promise<CurriculumSubject> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.curriculumService.updateSubject(
      curriculumSubjectId,
      tenantId,
      dto,
      dbUser?.id,
    );
  }

  @Delete(':id/subjects/:subjectId')
  async removeSubject(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) curriculumId: string,
    @Param('subjectId', ParseUUIDPipe) curriculumSubjectId: string,
  ): Promise<{ message: string }> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.curriculumService.removeSubject(
      curriculumSubjectId,
      tenantId,
      dbUser.id,
    );

    return { message: 'Disciplina removida do currículo com sucesso' };
  }
}

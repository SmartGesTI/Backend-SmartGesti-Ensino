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
import { AssessmentsService } from './assessments.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { UpdateAssessmentDto } from './dto/update-assessment.dto';
import {
  CreateAssessmentScoreDto,
  BulkCreateScoresDto,
} from './dto/create-assessment-score.dto';
import { UpdateAssessmentScoreDto } from './dto/update-assessment-score.dto';
import { Assessment, AssessmentScore } from '../common/types';

@Controller('assessments')
@UseGuards(JwtAuthGuard)
export class AssessmentsController {
  constructor(
    private assessmentsService: AssessmentsService,
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
  // Assessment Endpoints
  // ======================

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Query('schoolId') schoolId?: string,
    @Query('academicYearId') academicYearId?: string,
    @Query('classGroupSubjectId') classGroupSubjectId?: string,
    @Query('gradingPeriodId') gradingPeriodId?: string,
    @Query('published') publishedOnly?: boolean,
  ): Promise<Assessment[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.assessmentsService.findAll(tenantId, {
      schoolId,
      academicYearId,
      classGroupSubjectId,
      gradingPeriodId,
      publishedOnly,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Assessment> {
    const tenantId = await this.getTenantId(subdomain);
    const assessment = await this.assessmentsService.findOne(id, tenantId);

    if (!assessment) {
      throw new NotFoundException(`Avaliação com id '${id}' não encontrada`);
    }

    return assessment;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateAssessmentDto,
  ): Promise<Assessment> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.assessmentsService.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAssessmentDto,
  ): Promise<Assessment> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.assessmentsService.update(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/publish')
  async publish(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Assessment> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return this.assessmentsService.publish(id, tenantId, dbUser.id);
  }

  @Post(':id/unpublish')
  async unpublish(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Assessment> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    return this.assessmentsService.unpublish(id, tenantId, dbUser.id);
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

    await this.assessmentsService.remove(id, tenantId, dbUser.id);

    return { message: 'Avaliação removida com sucesso' };
  }

  // ==============================
  // Assessment Scores Endpoints
  // ==============================

  @Get(':id/scores')
  async findScores(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) assessmentId: string,
  ): Promise<AssessmentScore[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.assessmentsService.findScores(assessmentId, tenantId);
  }

  @Post(':id/scores')
  async createScore(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Body() dto: CreateAssessmentScoreDto,
  ): Promise<AssessmentScore> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.assessmentsService.createScore(
      assessmentId,
      tenantId,
      dto,
      dbUser?.id,
    );
  }

  @Put(':id/scores/:scoreId')
  async updateScore(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Param('scoreId', ParseUUIDPipe) scoreId: string,
    @Body() dto: UpdateAssessmentScoreDto,
  ): Promise<AssessmentScore> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.assessmentsService.updateScore(
      scoreId,
      tenantId,
      dto,
      dbUser?.id,
    );
  }

  @Post(':id/scores/bulk')
  async createScoresBulk(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Body() dto: BulkCreateScoresDto,
  ): Promise<AssessmentScore[]> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.assessmentsService.createScoresBulk(
      assessmentId,
      tenantId,
      dto.scores,
      dbUser?.id,
    );
  }

  @Delete(':id/scores/:scoreId')
  async removeScore(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) assessmentId: string,
    @Param('scoreId', ParseUUIDPipe) scoreId: string,
  ): Promise<{ message: string }> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    if (!dbUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    await this.assessmentsService.removeScore(scoreId, tenantId, dbUser.id);

    return { message: 'Nota removida com sucesso' };
  }
}

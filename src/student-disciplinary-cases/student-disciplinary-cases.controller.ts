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
import {
  StudentDisciplinaryCasesService,
  DisciplinaryCaseWithRelations,
} from './student-disciplinary-cases.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import {
  CreateDisciplinaryCaseDto,
  UpdateDisciplinaryCaseDto,
  CloseCaseDto,
  VoidCaseDto,
  LinkDocumentDto,
} from './dto/create-disciplinary-case.dto';
import {
  CreateDisciplinaryActionDto,
  UpdateDisciplinaryActionDto,
} from './dto/create-disciplinary-action.dto';
import {
  StudentDisciplinaryCase,
  StudentDisciplinaryAction,
} from '../common/types';

@Controller('student-disciplinary-cases')
@UseGuards(JwtAuthGuard)
export class StudentDisciplinaryCasesController {
  constructor(
    private casesService: StudentDisciplinaryCasesService,
    private usersService: UsersService,
    private tenantsService: TenantsService,
    private logger: LoggerService,
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

  // ============================================
  // CRUD Principal
  // ============================================

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Query('schoolId') schoolId?: string,
    @Query('studentId') studentId?: string,
    @Query('status') status?: string,
    @Query('caseType') caseType?: string,
    @Query('severity') severity?: string,
  ): Promise<StudentDisciplinaryCase[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.casesService.findAll(tenantId, {
      schoolId,
      studentId,
      status,
      caseType,
      severity,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<DisciplinaryCaseWithRelations> {
    const tenantId = await this.getTenantId(subdomain);
    const caseData = await this.casesService.findOne(id, tenantId);

    if (!caseData) {
      throw new NotFoundException(`Caso com id '${id}' nao encontrado`);
    }

    return caseData;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateDisciplinaryCaseDto,
  ): Promise<StudentDisciplinaryCase> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log(
      'Creating disciplinary case',
      'StudentDisciplinaryCasesController',
      {
        userSub: user.sub,
        studentId: dto.student_id,
        caseType: dto.case_type,
      },
    );

    return this.casesService.create(tenantId, dto, null, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDisciplinaryCaseDto,
  ): Promise<StudentDisciplinaryCase> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.casesService.update(id, tenantId, dto, dbUser?.id);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ success: boolean }> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    await this.casesService.remove(id, tenantId, dbUser?.id);

    return { success: true };
  }

  // ============================================
  // Acoes do Caso
  // ============================================

  @Post(':id/close')
  async close(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CloseCaseDto,
  ): Promise<StudentDisciplinaryCase> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log(
      'Closing disciplinary case',
      'StudentDisciplinaryCasesController',
      {
        userSub: user.sub,
        caseId: id,
      },
    );

    return this.casesService.close(id, tenantId, null, dto, dbUser?.id);
  }

  @Post(':id/void')
  async void(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidCaseDto,
  ): Promise<StudentDisciplinaryCase> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    this.logger.log(
      'Voiding disciplinary case',
      'StudentDisciplinaryCasesController',
      {
        userSub: user.sub,
        caseId: id,
        reason: dto.reason,
      },
    );

    return this.casesService.void(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/link-document')
  async linkDocument(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkDocumentDto,
  ): Promise<StudentDisciplinaryCase> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.casesService.linkDocument(id, tenantId, dto, dbUser?.id);
  }

  // ============================================
  // Acoes Disciplinares
  // ============================================

  @Get(':id/actions')
  async findActions(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<StudentDisciplinaryAction[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.casesService.findActions(id, tenantId);
  }

  @Post(':id/actions')
  async addAction(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateDisciplinaryActionDto,
  ): Promise<StudentDisciplinaryAction> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.casesService.addAction(id, tenantId, null, dto, dbUser?.id);
  }

  @Put(':id/actions/:actionId')
  async updateAction(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('actionId', ParseUUIDPipe) actionId: string,
    @Body() dto: UpdateDisciplinaryActionDto,
  ): Promise<StudentDisciplinaryAction> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.casesService.updateAction(
      id,
      actionId,
      tenantId,
      dto,
      dbUser?.id,
    );
  }

  @Post(':id/actions/:actionId/complete')
  async completeAction(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('actionId', ParseUUIDPipe) actionId: string,
  ): Promise<StudentDisciplinaryAction> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.casesService.completeAction(id, actionId, tenantId, dbUser?.id);
  }

  @Post(':id/actions/:actionId/cancel')
  async cancelAction(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('actionId', ParseUUIDPipe) actionId: string,
  ): Promise<StudentDisciplinaryAction> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.casesService.cancelAction(id, actionId, tenantId, dbUser?.id);
  }

  @Delete(':id/actions/:actionId')
  async removeAction(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('actionId', ParseUUIDPipe) actionId: string,
  ): Promise<{ success: boolean }> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    await this.casesService.removeAction(id, actionId, tenantId, dbUser?.id);

    return { success: true };
  }
}

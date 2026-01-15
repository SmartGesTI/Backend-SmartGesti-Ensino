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
import { ClassGroupsService } from './class-groups.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateClassGroupDto } from './dto/create-class-group.dto';
import {
  UpdateClassGroupDto,
  AllocateRoomDto,
} from './dto/update-class-group.dto';
import {
  ClassGroup,
  ClassGroupWithRelations,
  ClassGroupRoomAllocation,
} from '../common/types';

@Controller('class-groups')
@UseGuards(JwtAuthGuard)
export class ClassGroupsController {
  constructor(
    private classGroupsService: ClassGroupsService,
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
    @Query('grade_level_id') gradeLevelId?: string,
    @Query('shift_id') shiftId?: string,
    @Query('active') activeOnly?: boolean,
  ): Promise<ClassGroupWithRelations[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.classGroupsService.findAll(tenantId, {
      schoolId,
      academicYearId,
      gradeLevelId,
      shiftId,
      activeOnly,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ClassGroupWithRelations> {
    const tenantId = await this.getTenantId(subdomain);
    const classGroup = await this.classGroupsService.findOne(id, tenantId);

    if (!classGroup) {
      throw new NotFoundException(`Turma com id '${id}' não encontrada`);
    }

    return classGroup;
  }

  @Get(':id/students')
  async getStudents(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<any[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.classGroupsService.getStudents(id, tenantId);
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateClassGroupDto,
  ): Promise<ClassGroup> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.classGroupsService.create(tenantId, dto, dbUser?.id);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClassGroupDto,
  ): Promise<ClassGroup> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.classGroupsService.update(id, tenantId, dto, dbUser?.id);
  }

  @Post(':id/allocate-room')
  async allocateRoom(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AllocateRoomDto,
  ): Promise<ClassGroupRoomAllocation> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);

    return this.classGroupsService.allocateRoom(id, tenantId, dto, dbUser?.id);
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

    await this.classGroupsService.remove(id, tenantId, dbUser.id);

    return { message: `Turma removida com sucesso` };
  }
}

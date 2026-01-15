import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ReportFeedbackService } from './report-feedback.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { UsersService } from '../users/users.service';
import { TenantsService } from '../tenants/tenants.service';
import { CreateReportFeedbackDto } from './dto/create-report-feedback.dto';
import { ReportFeedback } from '../common/types';

@Controller('report-feedback')
@UseGuards(JwtAuthGuard)
export class ReportFeedbackController {
  constructor(
    private service: ReportFeedbackService,
    private usersService: UsersService,
    private tenantsService: TenantsService,
  ) {}

  private async getTenantId(subdomain: string | undefined): Promise<string> {
    if (!subdomain) throw new BadRequestException('Subdomain é obrigatório');
    const tenant = await this.tenantsService.getTenantBySubdomain(subdomain);
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    return tenant.id;
  }

  @Get()
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Query('reportRunId') reportRunId?: string,
    @Query('feedbackType') feedbackType?: string,
    @Query('limit') limit?: string,
  ): Promise<ReportFeedback[]> {
    const tenantId = await this.getTenantId(subdomain);
    return this.service.findAll(tenantId, {
      reportRunId,
      feedbackType,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ReportFeedback> {
    const tenantId = await this.getTenantId(subdomain);
    const feedback = await this.service.findOne(id, tenantId);
    if (!feedback)
      throw new NotFoundException(
        `Report feedback com id '${id}' não encontrado`,
      );
    return feedback;
  }

  @Post()
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Body() dto: CreateReportFeedbackDto,
  ): Promise<ReportFeedback> {
    const tenantId = await this.getTenantId(subdomain);
    const dbUser = await this.usersService.getUserByAuth0Id(user.sub);
    return this.service.create(tenantId, dto, dbUser?.id);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    const tenantId = await this.getTenantId(subdomain);
    await this.service.remove(id, tenantId);
    return { message: 'Report feedback removido com sucesso' };
  }
}

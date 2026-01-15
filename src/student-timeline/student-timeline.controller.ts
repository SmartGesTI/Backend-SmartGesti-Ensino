import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  NotFoundException,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { StudentTimelineService } from './student-timeline.service';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { LoggerService } from '../common/logger/logger.service';
import { TenantsService } from '../tenants/tenants.service';
import { TimelineFiltersDto } from './dto/timeline-filters.dto';
import { TimelineEvent, TimelineSummary } from '../common/types';

@Controller('students')
@UseGuards(JwtAuthGuard)
export class StudentTimelineController {
  constructor(
    private studentTimelineService: StudentTimelineService,
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

  @Get(':id/timeline')
  async getTimeline(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() filters: TimelineFiltersDto,
  ): Promise<TimelineEvent[]> {
    const tenantId = await this.getTenantId(subdomain);

    this.logger.log('Getting student timeline', 'StudentTimelineController', {
      userSub: user.sub,
      studentId: id,
      filters,
    });

    return this.studentTimelineService.getTimeline(id, tenantId, {
      from_date: filters.from_date,
      to_date: filters.to_date,
      event_types: filters.event_types,
      school_id: filters.school_id,
      limit: filters.limit,
    });
  }

  @Get(':id/timeline/summary')
  async getTimelineSummary(
    @CurrentUser() user: CurrentUserPayload,
    @Subdomain() subdomain: string | undefined,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TimelineSummary> {
    const tenantId = await this.getTenantId(subdomain);

    this.logger.log(
      'Getting student timeline summary',
      'StudentTimelineController',
      {
        userSub: user.sub,
        studentId: id,
      },
    );

    return this.studentTimelineService.getTimelineSummary(id, tenantId);
  }
}

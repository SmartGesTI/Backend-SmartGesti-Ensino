import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { UsageTrackingService } from './usage-tracking.service';
import {
  CreateMetricDto,
  UpdateMetricDto,
  TrackUsageDto,
  UsageHistoryFiltersDto,
} from './dto/usage-tracking.dto';

@Controller('billing/usage')
@UseGuards(JwtAuthGuard)
export class UsageTrackingController {
  constructor(private readonly usageTrackingService: UsageTrackingService) {}

  // ==================== METRICS ====================

  @Get('metrics')
  async findMetrics(@Subdomain() tenantId: string) {
    return this.usageTrackingService.findMetrics(tenantId);
  }

  @Get('metrics/:id')
  async findMetric(@Param('id') id: string, @Subdomain() tenantId: string) {
    return this.usageTrackingService.findMetric(id, tenantId);
  }

  @Post('metrics')
  async createMetric(
    @Body() dto: CreateMetricDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.usageTrackingService.createMetric(dto, tenantId, userId);
  }

  @Put('metrics/:id')
  async updateMetric(
    @Param('id') id: string,
    @Body() dto: UpdateMetricDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.usageTrackingService.updateMetric(id, dto, tenantId, userId);
  }

  // ==================== USAGE ====================

  @Post('track')
  async trackUsage(
    @Body() dto: TrackUsageDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.usageTrackingService.trackUsage(dto, tenantId, userId);
  }

  @Get('current')
  async getCurrentUsage(@Subdomain() tenantId: string) {
    return this.usageTrackingService.getCurrentUsage(tenantId);
  }

  @Get('history')
  async getUsageHistory(
    @Subdomain() tenantId: string,
    @Query() filters: UsageHistoryFiltersDto,
  ) {
    return this.usageTrackingService.getUsageHistory(tenantId, filters);
  }

  @Get('limits')
  async checkLimits(@Subdomain() tenantId: string) {
    return this.usageTrackingService.checkLimits(tenantId);
  }

  @Post('recalculate/:metricKey')
  async recalculateRollups(
    @Param('metricKey') metricKey: string,
    @Subdomain() tenantId: string,
  ) {
    await this.usageTrackingService.recalculateRollups(tenantId, metricKey);
    return { message: 'Rollups recalculados com sucesso' };
  }
}

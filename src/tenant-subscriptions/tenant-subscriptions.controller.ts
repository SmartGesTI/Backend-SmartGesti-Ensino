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
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { TenantSubscriptionsService } from './tenant-subscriptions.service';
import {
  CreateSubscriptionDto,
  ChangePlanDto,
  CancelSubscriptionDto,
  CreateOverrideDto,
  UpdateOverrideDto,
} from './dto/tenant-subscriptions.dto';

@Controller('billing/subscription')
@UseGuards(JwtAuthGuard)
export class TenantSubscriptionsController {
  constructor(
    private readonly tenantSubscriptionsService: TenantSubscriptionsService,
  ) {}

  // ==================== SUBSCRIPTION ====================

  @Get()
  async getSubscription(@Subdomain() tenantId: string) {
    return this.tenantSubscriptionsService.getSubscription(tenantId);
  }

  @Post()
  async createSubscription(
    @Body() dto: CreateSubscriptionDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tenantSubscriptionsService.createSubscription(
      dto,
      tenantId,
      userId,
    );
  }

  @Post('change-plan')
  async changePlan(
    @Body() dto: ChangePlanDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tenantSubscriptionsService.changePlan(dto, tenantId, userId);
  }

  @Post('cancel')
  async cancelSubscription(
    @Body() dto: CancelSubscriptionDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tenantSubscriptionsService.cancelSubscription(
      dto,
      tenantId,
      userId,
    );
  }

  @Post('pause')
  async pauseSubscription(
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tenantSubscriptionsService.pauseSubscription(tenantId, userId);
  }

  @Post('resume')
  async resumeSubscription(
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tenantSubscriptionsService.resumeSubscription(tenantId, userId);
  }

  // ==================== ENTITLEMENTS ====================

  @Get('entitlements')
  async getEffectiveEntitlements(@Subdomain() tenantId: string) {
    return this.tenantSubscriptionsService.getEffectiveEntitlements(tenantId);
  }

  @Get('check-entitlement/:key')
  async checkEntitlement(
    @Param('key') key: string,
    @Subdomain() tenantId: string,
  ) {
    return this.tenantSubscriptionsService.checkEntitlement(tenantId, key);
  }

  // ==================== OVERRIDES ====================

  @Get('overrides')
  async getOverrides(
    @Query('subscriptionId') subscriptionId: string,
    @Subdomain() tenantId: string,
  ) {
    return this.tenantSubscriptionsService.getOverrides(
      subscriptionId,
      tenantId,
    );
  }

  @Post('overrides')
  async addOverride(
    @Query('subscriptionId') subscriptionId: string,
    @Body() dto: CreateOverrideDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tenantSubscriptionsService.addOverride(
      subscriptionId,
      dto,
      tenantId,
      userId,
    );
  }

  @Put('overrides/:id')
  async updateOverride(
    @Param('id') overrideId: string,
    @Body() dto: UpdateOverrideDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tenantSubscriptionsService.updateOverride(
      overrideId,
      dto,
      tenantId,
      userId,
    );
  }

  @Delete('overrides/:id')
  async removeOverride(
    @Param('id') overrideId: string,
    @Subdomain() tenantId: string,
  ) {
    await this.tenantSubscriptionsService.removeOverride(overrideId, tenantId);
    return { message: 'Override removido com sucesso' };
  }
}

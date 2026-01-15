import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { SubscriptionPlansService } from './subscription-plans.service';
import {
  CreatePlanDto,
  UpdatePlanDto,
  CreatePriceDto,
  UpdatePriceDto,
  CreateEntitlementDto,
  UpdateEntitlementDto,
} from './dto/subscription-plans.dto';

@Controller('subscription-plans')
export class SubscriptionPlansController {
  constructor(
    private readonly subscriptionPlansService: SubscriptionPlansService,
  ) {}

  // ==================== PUBLIC PLANS (no auth) ====================

  @Get('public')
  async findPublicPlans(@Subdomain() tenantId: string) {
    return this.subscriptionPlansService.findPublicPlans(tenantId);
  }

  // ==================== PLANS (authenticated) ====================

  @Get()
  @UseGuards(JwtAuthGuard)
  async findPlans(@Subdomain() tenantId: string) {
    return this.subscriptionPlansService.findPlans(tenantId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findPlan(@Param('id') id: string, @Subdomain() tenantId: string) {
    return this.subscriptionPlansService.findPlan(id, tenantId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  async createPlan(
    @Body() dto: CreatePlanDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.subscriptionPlansService.createPlan(dto, tenantId, userId);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updatePlan(
    @Param('id') id: string,
    @Body() dto: UpdatePlanDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.subscriptionPlansService.updatePlan(id, dto, tenantId, userId);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async removePlan(
    @Param('id') id: string,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.subscriptionPlansService.removePlan(id, tenantId, userId);
    return { message: 'Plano desativado com sucesso' };
  }

  // ==================== PRICES ====================

  @Get(':id/prices')
  @UseGuards(JwtAuthGuard)
  async findPrices(@Param('id') planId: string, @Subdomain() tenantId: string) {
    return this.subscriptionPlansService.findPrices(planId, tenantId);
  }

  @Post(':id/prices')
  @UseGuards(JwtAuthGuard)
  async createPrice(
    @Param('id') planId: string,
    @Body() dto: CreatePriceDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.subscriptionPlansService.createPrice(
      planId,
      dto,
      tenantId,
      userId,
    );
  }

  @Put(':id/prices/:priceId')
  @UseGuards(JwtAuthGuard)
  async updatePrice(
    @Param('priceId') priceId: string,
    @Body() dto: UpdatePriceDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.subscriptionPlansService.updatePrice(
      priceId,
      dto,
      tenantId,
      userId,
    );
  }

  @Delete(':id/prices/:priceId')
  @UseGuards(JwtAuthGuard)
  async removePrice(
    @Param('priceId') priceId: string,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.subscriptionPlansService.removePrice(priceId, tenantId, userId);
    return { message: 'Preço desativado com sucesso' };
  }

  // ==================== ENTITLEMENTS ====================

  @Get(':id/entitlements')
  @UseGuards(JwtAuthGuard)
  async findEntitlements(
    @Param('id') planId: string,
    @Subdomain() tenantId: string,
  ) {
    return this.subscriptionPlansService.findEntitlements(planId, tenantId);
  }

  @Post(':id/entitlements')
  @UseGuards(JwtAuthGuard)
  async createEntitlement(
    @Param('id') planId: string,
    @Body() dto: CreateEntitlementDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.subscriptionPlansService.createEntitlement(
      planId,
      dto,
      tenantId,
      userId,
    );
  }

  @Put(':id/entitlements/:entitlementId')
  @UseGuards(JwtAuthGuard)
  async updateEntitlement(
    @Param('entitlementId') entitlementId: string,
    @Body() dto: UpdateEntitlementDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.subscriptionPlansService.updateEntitlement(
      entitlementId,
      dto,
      tenantId,
      userId,
    );
  }

  @Delete(':id/entitlements/:entitlementId')
  @UseGuards(JwtAuthGuard)
  async removeEntitlement(
    @Param('entitlementId') entitlementId: string,
    @Subdomain() tenantId: string,
  ) {
    await this.subscriptionPlansService.removeEntitlement(
      entitlementId,
      tenantId,
    );
    return { message: 'Entitlement removido com sucesso' };
  }
}

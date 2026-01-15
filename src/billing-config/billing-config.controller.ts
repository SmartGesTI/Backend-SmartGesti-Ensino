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
import { BillingConfigService } from './billing-config.service';
import {
  CreateProviderDto,
  UpdateProviderDto,
  CreateFeatureDto,
  UpdateFeatureDto,
} from './dto/billing-config.dto';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingConfigController {
  constructor(private readonly billingConfigService: BillingConfigService) {}

  // ==================== PROVIDERS ====================

  @Get('providers')
  async findProviders(@Subdomain() tenantId: string) {
    return this.billingConfigService.findProviders(tenantId);
  }

  @Get('providers/all')
  async findAllProviders(@Subdomain() tenantId: string) {
    return this.billingConfigService.findAllProviders(tenantId);
  }

  @Get('providers/:id')
  async findProvider(@Param('id') id: string, @Subdomain() tenantId: string) {
    return this.billingConfigService.findProvider(id, tenantId);
  }

  @Post('providers')
  async createProvider(
    @Body() dto: CreateProviderDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.billingConfigService.createProvider(dto, tenantId, userId);
  }

  @Put('providers/:id')
  async updateProvider(
    @Param('id') id: string,
    @Body() dto: UpdateProviderDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.billingConfigService.updateProvider(id, dto, tenantId, userId);
  }

  @Delete('providers/:id')
  async removeProvider(
    @Param('id') id: string,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.billingConfigService.removeProvider(id, tenantId, userId);
    return { message: 'Provedor desativado com sucesso' };
  }

  // ==================== FEATURES ====================

  @Get('features')
  async findFeatures(@Subdomain() tenantId: string) {
    return this.billingConfigService.findFeatures(tenantId);
  }

  @Get('features/all')
  async findAllFeatures(@Subdomain() tenantId: string) {
    return this.billingConfigService.findAllFeatures(tenantId);
  }

  @Get('features/:id')
  async findFeature(@Param('id') id: string, @Subdomain() tenantId: string) {
    return this.billingConfigService.findFeature(id, tenantId);
  }

  @Post('features')
  async createFeature(
    @Body() dto: CreateFeatureDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.billingConfigService.createFeature(dto, tenantId, userId);
  }

  @Put('features/:id')
  async updateFeature(
    @Param('id') id: string,
    @Body() dto: UpdateFeatureDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.billingConfigService.updateFeature(id, dto, tenantId, userId);
  }

  @Delete('features/:id')
  async removeFeature(
    @Param('id') id: string,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.billingConfigService.removeFeature(id, tenantId, userId);
    return { message: 'Feature desativada com sucesso' };
  }
}

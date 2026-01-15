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
import { BillingCustomersService } from './billing-customers.service';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  UpdateProfileDto,
  CreatePaymentMethodDto,
} from './dto/billing-customers.dto';
import {
  BillingCustomer,
  BillingCustomerWithProvider,
  TenantBillingProfile,
  BillingPaymentMethod,
  BillingPaymentMethodWithProvider,
} from '../common/types/billing.types';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingCustomersController {
  constructor(
    private readonly billingCustomersService: BillingCustomersService,
  ) {}

  // ==================== CUSTOMER ====================

  @Get('customer')
  async getCustomer(
    @Subdomain() tenantId: string,
  ): Promise<BillingCustomerWithProvider | null> {
    return this.billingCustomersService.getCustomer(tenantId);
  }

  @Post('customer')
  async createCustomer(
    @Body() dto: CreateCustomerDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<BillingCustomer> {
    return this.billingCustomersService.createCustomer(dto, tenantId, userId);
  }

  @Put('customer')
  async updateCustomer(
    @Body() dto: UpdateCustomerDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<BillingCustomer> {
    return this.billingCustomersService.updateCustomer(dto, tenantId, userId);
  }

  // ==================== BILLING PROFILE ====================

  @Get('profile')
  async getProfile(
    @Subdomain() tenantId: string,
  ): Promise<TenantBillingProfile | null> {
    return this.billingCustomersService.getProfile(tenantId);
  }

  @Put('profile')
  async updateProfile(
    @Body() dto: UpdateProfileDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<TenantBillingProfile> {
    return this.billingCustomersService.updateProfile(dto, tenantId, userId);
  }

  // ==================== PAYMENT METHODS ====================

  @Get('payment-methods')
  async getPaymentMethods(
    @Subdomain() tenantId: string,
  ): Promise<BillingPaymentMethodWithProvider[]> {
    return this.billingCustomersService.getPaymentMethods(tenantId);
  }

  @Post('payment-methods')
  async addPaymentMethod(
    @Body() dto: CreatePaymentMethodDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<BillingPaymentMethod> {
    return this.billingCustomersService.addPaymentMethod(dto, tenantId, userId);
  }

  @Delete('payment-methods/:id')
  async removePaymentMethod(
    @Param('id') methodId: string,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<{ message: string }> {
    await this.billingCustomersService.removePaymentMethod(
      methodId,
      tenantId,
      userId,
    );
    return { message: 'Método de pagamento removido com sucesso' };
  }

  @Post('payment-methods/:id/set-default')
  async setDefaultPaymentMethod(
    @Param('id') methodId: string,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<BillingPaymentMethod> {
    return this.billingCustomersService.setDefaultPaymentMethod(
      methodId,
      tenantId,
      userId,
    );
  }
}

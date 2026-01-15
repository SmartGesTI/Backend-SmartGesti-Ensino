import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { BillingPaymentsService } from './billing-payments.service';
import {
  PayInvoiceDto,
  RefundDto,
  PaymentFiltersDto,
} from './dto/billing-payments.dto';
import { BillingPayment, BillingRefund } from '../common/types/billing.types';

@Controller('billing')
@UseGuards(JwtAuthGuard)
export class BillingPaymentsController {
  constructor(
    private readonly billingPaymentsService: BillingPaymentsService,
  ) {}

  // ==================== PAYMENTS ====================

  @Get('payments')
  async findPayments(
    @Subdomain() tenantId: string,
    @Query() filters: PaymentFiltersDto,
  ): Promise<BillingPayment[]> {
    return this.billingPaymentsService.findPayments(tenantId, filters);
  }

  @Get('payments/:id')
  async findPayment(
    @Param('id') id: string,
    @Subdomain() tenantId: string,
  ): Promise<
    | (BillingPayment & {
        billing_invoices?: {
          invoice_number: string;
          total_cents: number;
          currency: string;
        };
        billing_refunds?: BillingRefund[];
      })
    | null
  > {
    return this.billingPaymentsService.findPayment(id, tenantId);
  }

  @Get('invoices/:invoiceId/payments')
  async findPaymentsByInvoice(
    @Param('invoiceId') invoiceId: string,
    @Subdomain() tenantId: string,
  ): Promise<(BillingPayment & { billing_refunds?: BillingRefund[] })[]> {
    return this.billingPaymentsService.findPaymentsByInvoice(
      invoiceId,
      tenantId,
    );
  }

  @Post('invoices/:invoiceId/pay')
  async payInvoice(
    @Param('invoiceId') invoiceId: string,
    @Body() dto: PayInvoiceDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<BillingPayment> {
    return this.billingPaymentsService.payInvoice(
      invoiceId,
      dto,
      tenantId,
      userId,
    );
  }

  // ==================== REFUNDS ====================

  @Get('payments/:id/refunds')
  async findRefunds(
    @Param('id') paymentId: string,
    @Subdomain() tenantId: string,
  ): Promise<BillingRefund[]> {
    return this.billingPaymentsService.findRefunds(paymentId, tenantId);
  }

  @Post('payments/:id/refund')
  async requestRefund(
    @Param('id') paymentId: string,
    @Body() dto: RefundDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<BillingRefund> {
    return this.billingPaymentsService.requestRefund(
      paymentId,
      dto,
      tenantId,
      userId,
    );
  }
}

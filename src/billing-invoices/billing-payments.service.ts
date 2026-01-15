import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import {
  PayInvoiceDto,
  RefundDto,
  PaymentFiltersDto,
} from './dto/billing-payments.dto';
import {
  BillingPayment,
  BillingRefund,
  BillingInvoice,
} from '../common/types/billing.types';

@Injectable()
export class BillingPaymentsService {
  private supabase: SupabaseClient;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly logger: LoggerService,
  ) {
    this.supabase = this.supabaseService.getClient();
  }

  // ==================== PAYMENTS ====================

  async findPayments(
    tenantId: string,
    filters?: PaymentFiltersDto,
  ): Promise<BillingPayment[]> {
    let query = this.supabase
      .from('billing_payments')
      .select('*, billing_invoices(invoice_number, total_cents, currency)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    }
    if (filters?.offset) {
      query = query.range(
        filters.offset,
        filters.offset + (filters.limit || 10) - 1,
      );
    }

    const result = await query;

    if (result.error) {
      this.logger.error(
        'Erro ao listar pagamentos',
        result.error.message,
        'BillingPaymentsService',
      );
      throw result.error;
    }

    return (result.data || []) as BillingPayment[];
  }

  async findPayment(
    id: string,
    tenantId: string,
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
    const result = await this.supabase
      .from('billing_payments')
      .select(
        '*, billing_invoices(invoice_number, total_cents, currency), billing_refunds(*)',
      )
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (result.error) {
      this.logger.error(
        'Erro ao buscar pagamento',
        result.error.message,
        'BillingPaymentsService',
      );
      throw result.error;
    }

    return result.data as
      | (BillingPayment & {
          billing_invoices?: {
            invoice_number: string;
            total_cents: number;
            currency: string;
          };
          billing_refunds?: BillingRefund[];
        })
      | null;
  }

  async findPaymentsByInvoice(
    invoiceId: string,
    tenantId: string,
  ): Promise<(BillingPayment & { billing_refunds?: BillingRefund[] })[]> {
    const result = await this.supabase
      .from('billing_payments')
      .select('*, billing_refunds(*)')
      .eq('billing_invoice_id', invoiceId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (result.error) {
      this.logger.error(
        'Erro ao listar pagamentos da fatura',
        result.error.message,
        'BillingPaymentsService',
      );
      throw result.error;
    }

    return (result.data || []) as (BillingPayment & {
      billing_refunds?: BillingRefund[];
    })[];
  }

  async payInvoice(
    invoiceId: string,
    dto: PayInvoiceDto,
    tenantId: string,
    userId: string,
  ): Promise<BillingPayment> {
    // Get invoice details
    const invoiceResult = await this.supabase
      .from('billing_invoices')
      .select('*')
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .single();

    if (invoiceResult.error) {
      this.logger.error(
        'Erro ao buscar fatura para pagamento',
        invoiceResult.error.message,
        'BillingPaymentsService',
      );
      throw invoiceResult.error;
    }

    const invoice = invoiceResult.data as BillingInvoice;
    if (!invoice || invoice.status !== 'open') {
      throw new Error('Fatura não pode ser paga');
    }

    // Create payment record
    const paymentResult = await this.supabase
      .from('billing_payments')
      .insert({
        billing_invoice_id: invoiceId,
        tenant_id: tenantId,
        payment_method_id: dto.payment_method_id,
        method_type: dto.method_type,
        amount_cents: invoice.amount_due_cents,
        currency: invoice.currency,
        status: 'pending',
        installments_count: dto.installments_count ?? 1,
        ...(dto.metadata && { metadata: dto.metadata }),
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (paymentResult.error) {
      this.logger.error(
        'Erro ao criar pagamento',
        paymentResult.error.message,
        'BillingPaymentsService',
      );
      throw paymentResult.error;
    }

    const payment = paymentResult.data as BillingPayment;

    // In a real implementation, this would integrate with payment provider
    // For now, simulate successful payment
    const updateResult = await this.supabase
      .from('billing_payments')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id)
      .select()
      .single();

    if (updateResult.error) {
      this.logger.error(
        'Erro ao atualizar pagamento',
        updateResult.error.message,
        'BillingPaymentsService',
      );
      throw updateResult.error;
    }

    // Update invoice status
    await this.supabase
      .from('billing_invoices')
      .update({
        status: 'paid',
        amount_paid_cents: invoice.amount_due_cents,
        amount_due_cents: 0,
        paid_at: new Date().toISOString(),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId);

    const updatedPayment = updateResult.data as BillingPayment;
    this.logger.log(
      `Pagamento realizado: ${updatedPayment.id}`,
      'BillingPaymentsService',
    );
    return updatedPayment;
  }

  // ==================== REFUNDS ====================

  async findRefunds(
    paymentId: string,
    tenantId: string,
  ): Promise<BillingRefund[]> {
    const result = await this.supabase
      .from('billing_refunds')
      .select('*')
      .eq('billing_payment_id', paymentId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (result.error) {
      this.logger.error(
        'Erro ao listar reembolsos',
        result.error.message,
        'BillingPaymentsService',
      );
      throw result.error;
    }

    return (result.data || []) as BillingRefund[];
  }

  async requestRefund(
    paymentId: string,
    dto: RefundDto,
    tenantId: string,
    userId: string,
  ): Promise<BillingRefund> {
    // Get payment details
    const paymentResult = await this.supabase
      .from('billing_payments')
      .select('*')
      .eq('id', paymentId)
      .eq('tenant_id', tenantId)
      .single();

    if (paymentResult.error) {
      this.logger.error(
        'Erro ao buscar pagamento para reembolso',
        paymentResult.error.message,
        'BillingPaymentsService',
      );
      throw paymentResult.error;
    }

    const payment = paymentResult.data as BillingPayment;
    if (!payment || payment.status !== 'paid') {
      throw new Error('Pagamento não pode ser reembolsado');
    }

    // Check if amount is valid
    const totalRefunded = await this.getTotalRefunded(paymentId, tenantId);
    const availableForRefund = payment.amount_cents - totalRefunded;

    if (dto.amount_cents > availableForRefund) {
      throw new Error(
        `Valor máximo para reembolso: ${availableForRefund / 100}`,
      );
    }

    // Create refund record
    const refundResult = await this.supabase
      .from('billing_refunds')
      .insert({
        billing_payment_id: paymentId,
        tenant_id: tenantId,
        amount_cents: dto.amount_cents,
        currency: payment.currency,
        status: 'pending',
        reason: dto.reason,
        ...(dto.metadata && { metadata: dto.metadata }),
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (refundResult.error) {
      this.logger.error(
        'Erro ao criar reembolso',
        refundResult.error.message,
        'BillingPaymentsService',
      );
      throw refundResult.error;
    }

    const refund = refundResult.data as BillingRefund;

    // In a real implementation, this would integrate with payment provider
    // For now, simulate successful refund
    const updateResult = await this.supabase
      .from('billing_refunds')
      .update({
        status: 'succeeded',
        refunded_at: new Date().toISOString(),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', refund.id)
      .select()
      .single();

    if (updateResult.error) {
      this.logger.error(
        'Erro ao atualizar reembolso',
        updateResult.error.message,
        'BillingPaymentsService',
      );
      throw updateResult.error;
    }

    // Update payment status if fully refunded
    const newTotalRefunded = totalRefunded + dto.amount_cents;
    if (newTotalRefunded >= payment.amount_cents) {
      await this.supabase
        .from('billing_payments')
        .update({
          status: 'refunded',
          amount_refunded_cents: newTotalRefunded,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId);
    } else {
      await this.supabase
        .from('billing_payments')
        .update({
          amount_refunded_cents: newTotalRefunded,
          updated_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId);
    }

    const updatedRefund = updateResult.data as BillingRefund;
    this.logger.log(
      `Reembolso realizado: ${updatedRefund.id}`,
      'BillingPaymentsService',
    );
    return updatedRefund;
  }

  // ==================== HELPERS ====================

  private async getTotalRefunded(
    paymentId: string,
    tenantId: string,
  ): Promise<number> {
    const result = await this.supabase
      .from('billing_refunds')
      .select('amount_cents')
      .eq('billing_payment_id', paymentId)
      .eq('tenant_id', tenantId)
      .eq('status', 'succeeded');

    if (result.error) {
      return 0;
    }

    const refunds = (result.data || []) as Array<{ amount_cents: number }>;
    return refunds.reduce((sum, r) => sum + (r.amount_cents || 0), 0);
  }
}

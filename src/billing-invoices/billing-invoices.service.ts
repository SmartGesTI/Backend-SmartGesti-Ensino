import { Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseService } from '../supabase/supabase.service';
import { LoggerService } from '../common/logger/logger.service';
import {
  CreateInvoiceDto,
  AddLineDto,
  InvoiceFiltersDto,
} from './dto/billing-invoices.dto';
import {
  BillingInvoice,
  BillingInvoiceWithRelations,
  BillingInvoiceLine,
} from '../common/types/billing.types';

@Injectable()
export class BillingInvoicesService {
  private supabase: SupabaseClient;

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly logger: LoggerService,
  ) {
    this.supabase = this.supabaseService.getClient();
  }

  // ==================== INVOICES ====================

  async findInvoices(
    tenantId: string,
    filters?: InvoiceFiltersDto,
  ): Promise<BillingInvoiceWithRelations[]> {
    let query = this.supabase
      .from('billing_invoices')
      .select('*, billing_invoice_lines(*)')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.from) {
      query = query.gte('created_at', filters.from);
    }
    if (filters?.to) {
      query = query.lte('created_at', filters.to);
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
        'Erro ao listar faturas',
        result.error.message,
        'BillingInvoicesService',
      );
      throw result.error;
    }

    return (result.data || []) as BillingInvoiceWithRelations[];
  }

  async findInvoice(
    id: string,
    tenantId: string,
  ): Promise<BillingInvoiceWithRelations | null> {
    const result = await this.supabase
      .from('billing_invoices')
      .select('*, billing_invoice_lines(*), billing_payments(*)')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (result.error) {
      this.logger.error(
        'Erro ao buscar fatura',
        result.error.message,
        'BillingInvoicesService',
      );
      throw result.error;
    }

    return result.data as BillingInvoiceWithRelations | null;
  }

  async createInvoice(
    dto: CreateInvoiceDto,
    tenantId: string,
    userId: string,
  ): Promise<BillingInvoice> {
    const result = await this.supabase
      .from('billing_invoices')
      .insert({
        ...dto,
        tenant_id: tenantId,
        status: 'draft',
        subtotal_cents: 0,
        discount_cents: 0,
        tax_cents: 0,
        total_cents: 0,
        amount_paid_cents: 0,
        amount_due_cents: 0,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (result.error) {
      this.logger.error(
        'Erro ao criar fatura',
        result.error.message,
        'BillingInvoicesService',
      );
      throw result.error;
    }

    const invoice = result.data as BillingInvoice;
    this.logger.log(`Fatura criada: ${invoice.id}`, 'BillingInvoicesService');
    return invoice;
  }

  // ==================== INVOICE LINES ====================

  async addLine(
    invoiceId: string,
    dto: AddLineDto,
    tenantId: string,
    userId: string,
  ): Promise<BillingInvoiceLine> {
    const totalCents = dto.quantity * dto.unit_amount_cents;

    const result = await this.supabase
      .from('billing_invoice_lines')
      .insert({
        ...dto,
        billing_invoice_id: invoiceId,
        tenant_id: tenantId,
        total_cents: totalCents,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (result.error) {
      this.logger.error(
        'Erro ao adicionar linha',
        result.error.message,
        'BillingInvoicesService',
      );
      throw result.error;
    }

    // Update invoice totals
    await this.recalculateTotals(invoiceId, tenantId, userId);

    const line = result.data as BillingInvoiceLine;
    this.logger.log(
      `Linha adicionada à fatura ${invoiceId}: ${line.id}`,
      'BillingInvoicesService',
    );
    return line;
  }

  async removeLine(
    invoiceId: string,
    lineId: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const result = await this.supabase
      .from('billing_invoice_lines')
      .delete()
      .eq('id', lineId)
      .eq('billing_invoice_id', invoiceId)
      .eq('tenant_id', tenantId);

    if (result.error) {
      this.logger.error(
        'Erro ao remover linha',
        result.error.message,
        'BillingInvoicesService',
      );
      throw result.error;
    }

    // Update invoice totals
    await this.recalculateTotals(invoiceId, tenantId, userId);

    this.logger.log(
      `Linha removida da fatura ${invoiceId}: ${lineId}`,
      'BillingInvoicesService',
    );
  }

  // ==================== INVOICE LIFECYCLE ====================

  async finalizeInvoice(
    invoiceId: string,
    tenantId: string,
    userId: string,
  ): Promise<BillingInvoice> {
    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber(tenantId);

    const result = await this.supabase
      .from('billing_invoices')
      .update({
        status: 'open',
        invoice_number: invoiceNumber,
        finalized_at: new Date().toISOString(),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .eq('status', 'draft')
      .select()
      .single();

    if (result.error) {
      this.logger.error(
        'Erro ao finalizar fatura',
        result.error.message,
        'BillingInvoicesService',
      );
      throw result.error;
    }

    this.logger.log(
      `Fatura finalizada: ${invoiceId}`,
      'BillingInvoicesService',
    );
    return result.data as BillingInvoice;
  }

  async voidInvoice(
    invoiceId: string,
    tenantId: string,
    userId: string,
  ): Promise<BillingInvoice> {
    const result = await this.supabase
      .from('billing_invoices')
      .update({
        status: 'void',
        voided_at: new Date().toISOString(),
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .in('status', ['draft', 'open'])
      .select()
      .single();

    if (result.error) {
      this.logger.error(
        'Erro ao anular fatura',
        result.error.message,
        'BillingInvoicesService',
      );
      throw result.error;
    }

    this.logger.log(`Fatura anulada: ${invoiceId}`, 'BillingInvoicesService');
    return result.data as BillingInvoice;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  generatePdfUrl(invoiceId: string, _tenantId: string): Promise<string> {
    // In a real implementation, this would generate a PDF and return a signed URL
    // For now, return a placeholder URL
    return Promise.resolve(`/api/billing/invoices/${invoiceId}/download`);
  }

  // ==================== HELPERS ====================

  private async recalculateTotals(
    invoiceId: string,
    tenantId: string,
    userId: string,
  ): Promise<void> {
    // Get all lines
    const linesResult = await this.supabase
      .from('billing_invoice_lines')
      .select('total_cents')
      .eq('billing_invoice_id', invoiceId)
      .eq('tenant_id', tenantId);

    if (linesResult.error) {
      this.logger.error(
        'Erro ao buscar linhas para recálculo',
        linesResult.error.message,
        'BillingInvoicesService',
      );
      throw linesResult.error;
    }

    const lines = (linesResult.data || []) as Array<{ total_cents: number }>;
    const subtotal = lines.reduce(
      (sum, line) => sum + (line.total_cents || 0),
      0,
    );

    const updateResult = await this.supabase
      .from('billing_invoices')
      .update({
        subtotal_cents: subtotal,
        total_cents: subtotal, // For now, no discount or tax
        amount_due_cents: subtotal,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId);

    if (updateResult.error) {
      this.logger.error(
        'Erro ao atualizar totais',
        updateResult.error.message,
        'BillingInvoicesService',
      );
      throw updateResult.error;
    }
  }

  private async generateInvoiceNumber(tenantId: string): Promise<string> {
    const result = await this.supabase
      .from('billing_invoices')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .not('invoice_number', 'is', null);

    if (result.error) {
      this.logger.error(
        'Erro ao gerar número de fatura',
        result.error.message,
        'BillingInvoicesService',
      );
      throw result.error;
    }

    const nextNumber = (result.count || 0) + 1;
    const year = new Date().getFullYear();
    return `INV-${year}-${String(nextNumber).padStart(6, '0')}`;
  }
}

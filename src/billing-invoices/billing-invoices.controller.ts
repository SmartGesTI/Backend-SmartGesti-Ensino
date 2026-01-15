import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Subdomain } from '../common/decorators/subdomain.decorator';
import { BillingInvoicesService } from './billing-invoices.service';
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

@Controller('billing/invoices')
@UseGuards(JwtAuthGuard)
export class BillingInvoicesController {
  constructor(
    private readonly billingInvoicesService: BillingInvoicesService,
  ) {}

  // ==================== INVOICES ====================

  @Get()
  async findInvoices(
    @Subdomain() tenantId: string,
    @Query() filters: InvoiceFiltersDto,
  ): Promise<BillingInvoiceWithRelations[]> {
    return this.billingInvoicesService.findInvoices(tenantId, filters);
  }

  @Get(':id')
  async findInvoice(
    @Param('id') id: string,
    @Subdomain() tenantId: string,
  ): Promise<BillingInvoiceWithRelations | null> {
    return this.billingInvoicesService.findInvoice(id, tenantId);
  }

  @Post()
  async createInvoice(
    @Body() dto: CreateInvoiceDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<BillingInvoice> {
    return this.billingInvoicesService.createInvoice(dto, tenantId, userId);
  }

  @Get(':id/pdf')
  async generatePdfUrl(
    @Param('id') id: string,
    @Subdomain() tenantId: string,
  ): Promise<{ url: string }> {
    const url = await this.billingInvoicesService.generatePdfUrl(id, tenantId);
    return { url };
  }

  @Post(':id/finalize')
  async finalizeInvoice(
    @Param('id') id: string,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<BillingInvoice> {
    return this.billingInvoicesService.finalizeInvoice(id, tenantId, userId);
  }

  @Post(':id/void')
  async voidInvoice(
    @Param('id') id: string,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<BillingInvoice> {
    return this.billingInvoicesService.voidInvoice(id, tenantId, userId);
  }

  // ==================== INVOICE LINES ====================

  @Post(':id/lines')
  async addLine(
    @Param('id') invoiceId: string,
    @Body() dto: AddLineDto,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ): Promise<BillingInvoiceLine> {
    return this.billingInvoicesService.addLine(
      invoiceId,
      dto,
      tenantId,
      userId,
    );
  }

  @Delete(':id/lines/:lineId')
  async removeLine(
    @Param('id') invoiceId: string,
    @Param('lineId') lineId: string,
    @Subdomain() tenantId: string,
    @CurrentUser('id') userId: string,
  ) {
    await this.billingInvoicesService.removeLine(
      invoiceId,
      lineId,
      tenantId,
      userId,
    );
    return { message: 'Linha removida com sucesso' };
  }
}

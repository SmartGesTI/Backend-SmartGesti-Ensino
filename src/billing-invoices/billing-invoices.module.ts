import { Module } from '@nestjs/common';
import { BillingInvoicesController } from './billing-invoices.controller';
import { BillingInvoicesService } from './billing-invoices.service';
import { BillingPaymentsController } from './billing-payments.controller';
import { BillingPaymentsService } from './billing-payments.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';

@Module({
  imports: [SupabaseModule, LoggerModule],
  controllers: [BillingInvoicesController, BillingPaymentsController],
  providers: [BillingInvoicesService, BillingPaymentsService],
  exports: [BillingInvoicesService, BillingPaymentsService],
})
export class BillingInvoicesModule {}

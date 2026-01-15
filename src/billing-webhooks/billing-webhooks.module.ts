import { Module } from '@nestjs/common';
import { BillingWebhooksController } from './billing-webhooks.controller';
import { BillingWebhooksService } from './billing-webhooks.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';

@Module({
  imports: [SupabaseModule, LoggerModule],
  controllers: [BillingWebhooksController],
  providers: [BillingWebhooksService],
  exports: [BillingWebhooksService],
})
export class BillingWebhooksModule {}

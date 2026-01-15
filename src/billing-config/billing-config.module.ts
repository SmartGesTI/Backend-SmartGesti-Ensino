import { Module } from '@nestjs/common';
import { BillingConfigController } from './billing-config.controller';
import { BillingConfigService } from './billing-config.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';

@Module({
  imports: [SupabaseModule, LoggerModule],
  controllers: [BillingConfigController],
  providers: [BillingConfigService],
  exports: [BillingConfigService],
})
export class BillingConfigModule {}

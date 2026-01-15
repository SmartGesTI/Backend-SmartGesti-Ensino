import { Module } from '@nestjs/common';
import { BillingCustomersController } from './billing-customers.controller';
import { BillingCustomersService } from './billing-customers.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';

@Module({
  imports: [SupabaseModule, LoggerModule],
  controllers: [BillingCustomersController],
  providers: [BillingCustomersService],
  exports: [BillingCustomersService],
})
export class BillingCustomersModule {}

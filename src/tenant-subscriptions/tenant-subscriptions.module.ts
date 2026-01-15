import { Module } from '@nestjs/common';
import { TenantSubscriptionsController } from './tenant-subscriptions.controller';
import { TenantSubscriptionsService } from './tenant-subscriptions.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';

@Module({
  imports: [SupabaseModule, LoggerModule],
  controllers: [TenantSubscriptionsController],
  providers: [TenantSubscriptionsService],
  exports: [TenantSubscriptionsService],
})
export class TenantSubscriptionsModule {}

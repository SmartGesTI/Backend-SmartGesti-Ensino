import { Module } from '@nestjs/common';
import { UsageTrackingController } from './usage-tracking.controller';
import { UsageTrackingService } from './usage-tracking.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';

@Module({
  imports: [SupabaseModule, LoggerModule],
  controllers: [UsageTrackingController],
  providers: [UsageTrackingService],
  exports: [UsageTrackingService],
})
export class UsageTrackingModule {}

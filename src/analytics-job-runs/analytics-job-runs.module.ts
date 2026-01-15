import { Module } from '@nestjs/common';
import { AnalyticsJobRunsController } from './analytics-job-runs.controller';
import { AnalyticsJobRunsService } from './analytics-job-runs.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [SupabaseModule, LoggerModule, UsersModule, TenantsModule],
  controllers: [AnalyticsJobRunsController],
  providers: [AnalyticsJobRunsService],
  exports: [AnalyticsJobRunsService],
})
export class AnalyticsJobRunsModule {}

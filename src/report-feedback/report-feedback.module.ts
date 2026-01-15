import { Module } from '@nestjs/common';
import { ReportFeedbackController } from './report-feedback.controller';
import { ReportFeedbackService } from './report-feedback.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [SupabaseModule, LoggerModule, UsersModule, TenantsModule],
  controllers: [ReportFeedbackController],
  providers: [ReportFeedbackService],
  exports: [ReportFeedbackService],
})
export class ReportFeedbackModule {}

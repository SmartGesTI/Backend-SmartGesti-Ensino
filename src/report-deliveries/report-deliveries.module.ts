import { Module } from '@nestjs/common';
import { ReportDeliveriesController } from './report-deliveries.controller';
import { ReportDeliveriesService } from './report-deliveries.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [SupabaseModule, LoggerModule, UsersModule, TenantsModule],
  controllers: [ReportDeliveriesController],
  providers: [ReportDeliveriesService],
  exports: [ReportDeliveriesService],
})
export class ReportDeliveriesModule {}

import { Module } from '@nestjs/common';
import { ReportRunsController } from './report-runs.controller';
import { ReportRunsService } from './report-runs.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { ServicesModule } from '../common/services/services.module';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [
    SupabaseModule,
    LoggerModule,
    ServicesModule,
    UsersModule,
    TenantsModule,
  ],
  controllers: [ReportRunsController],
  providers: [ReportRunsService],
  exports: [ReportRunsService],
})
export class ReportRunsModule {}

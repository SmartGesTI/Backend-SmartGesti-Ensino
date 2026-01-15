import { Module } from '@nestjs/common';
import { ReportTemplatesController } from './report-templates.controller';
import { ReportTemplatesService } from './report-templates.service';
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
  controllers: [ReportTemplatesController],
  providers: [ReportTemplatesService],
  exports: [ReportTemplatesService],
})
export class ReportTemplatesModule {}

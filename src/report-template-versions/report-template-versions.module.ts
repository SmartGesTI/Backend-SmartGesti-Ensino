import { Module } from '@nestjs/common';
import { ReportTemplateVersionsController } from './report-template-versions.controller';
import { ReportTemplateVersionsService } from './report-template-versions.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [SupabaseModule, LoggerModule, UsersModule, TenantsModule],
  controllers: [ReportTemplateVersionsController],
  providers: [ReportTemplateVersionsService],
  exports: [ReportTemplateVersionsService],
})
export class ReportTemplateVersionsModule {}

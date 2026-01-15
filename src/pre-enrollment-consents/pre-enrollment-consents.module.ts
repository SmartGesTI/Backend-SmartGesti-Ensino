import { Module } from '@nestjs/common';
import { PreEnrollmentConsentsController } from './pre-enrollment-consents.controller';
import { PreEnrollmentConsentsService } from './pre-enrollment-consents.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [SupabaseModule, LoggerModule, TenantsModule],
  controllers: [PreEnrollmentConsentsController],
  providers: [PreEnrollmentConsentsService],
  exports: [PreEnrollmentConsentsService],
})
export class PreEnrollmentConsentsModule {}

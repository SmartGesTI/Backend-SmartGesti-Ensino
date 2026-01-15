import { Module } from '@nestjs/common';
import { PreEnrollmentConversionsController } from './pre-enrollment-conversions.controller';
import { PreEnrollmentConversionsService } from './pre-enrollment-conversions.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [SupabaseModule, LoggerModule, UsersModule, TenantsModule],
  controllers: [PreEnrollmentConversionsController],
  providers: [PreEnrollmentConversionsService],
  exports: [PreEnrollmentConversionsService],
})
export class PreEnrollmentConversionsModule {}

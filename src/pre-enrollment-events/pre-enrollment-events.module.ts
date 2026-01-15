import { Module } from '@nestjs/common';
import { PreEnrollmentEventsController } from './pre-enrollment-events.controller';
import { PreEnrollmentEventsService } from './pre-enrollment-events.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [SupabaseModule, LoggerModule, UsersModule, TenantsModule],
  controllers: [PreEnrollmentEventsController],
  providers: [PreEnrollmentEventsService],
  exports: [PreEnrollmentEventsService],
})
export class PreEnrollmentEventsModule {}

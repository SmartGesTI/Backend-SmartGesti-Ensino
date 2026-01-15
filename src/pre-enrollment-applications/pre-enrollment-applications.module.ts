import { Module } from '@nestjs/common';
import { PreEnrollmentApplicationsController } from './pre-enrollment-applications.controller';
import { PreEnrollmentApplicationsService } from './pre-enrollment-applications.service';
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
  controllers: [PreEnrollmentApplicationsController],
  providers: [PreEnrollmentApplicationsService],
  exports: [PreEnrollmentApplicationsService],
})
export class PreEnrollmentApplicationsModule {}

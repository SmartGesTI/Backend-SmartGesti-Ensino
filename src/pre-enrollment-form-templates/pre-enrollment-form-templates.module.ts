import { Module } from '@nestjs/common';
import { PreEnrollmentFormTemplatesController } from './pre-enrollment-form-templates.controller';
import { PreEnrollmentFormTemplatesService } from './pre-enrollment-form-templates.service';
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
  controllers: [PreEnrollmentFormTemplatesController],
  providers: [PreEnrollmentFormTemplatesService],
  exports: [PreEnrollmentFormTemplatesService],
})
export class PreEnrollmentFormTemplatesModule {}

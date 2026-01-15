import { Module } from '@nestjs/common';
import { PreEnrollmentHouseholdsController } from './pre-enrollment-households.controller';
import { PreEnrollmentHouseholdsService } from './pre-enrollment-households.service';
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
  controllers: [PreEnrollmentHouseholdsController],
  providers: [PreEnrollmentHouseholdsService],
  exports: [PreEnrollmentHouseholdsService],
})
export class PreEnrollmentHouseholdsModule {}

import { Module } from '@nestjs/common';
import { PreEnrollmentRelationshipsController } from './pre-enrollment-relationships.controller';
import { PreEnrollmentRelationshipsService } from './pre-enrollment-relationships.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [SupabaseModule, LoggerModule, UsersModule, TenantsModule],
  controllers: [PreEnrollmentRelationshipsController],
  providers: [PreEnrollmentRelationshipsService],
  exports: [PreEnrollmentRelationshipsService],
})
export class PreEnrollmentRelationshipsModule {}

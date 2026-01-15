import { Module } from '@nestjs/common';
import { PreEnrollmentAttachmentsController } from './pre-enrollment-attachments.controller';
import { PreEnrollmentAttachmentsService } from './pre-enrollment-attachments.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [SupabaseModule, LoggerModule, UsersModule, TenantsModule],
  controllers: [PreEnrollmentAttachmentsController],
  providers: [PreEnrollmentAttachmentsService],
  exports: [PreEnrollmentAttachmentsService],
})
export class PreEnrollmentAttachmentsModule {}

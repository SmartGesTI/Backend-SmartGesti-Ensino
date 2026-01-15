import { Module } from '@nestjs/common';
import { PreEnrollmentReviewsController } from './pre-enrollment-reviews.controller';
import { PreEnrollmentReviewsService } from './pre-enrollment-reviews.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [SupabaseModule, LoggerModule, UsersModule, TenantsModule],
  controllers: [PreEnrollmentReviewsController],
  providers: [PreEnrollmentReviewsService],
  exports: [PreEnrollmentReviewsService],
})
export class PreEnrollmentReviewsModule {}

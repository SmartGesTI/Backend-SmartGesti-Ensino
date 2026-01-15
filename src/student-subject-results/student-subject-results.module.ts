import { Module } from '@nestjs/common';
import { StudentSubjectResultsController } from './student-subject-results.controller';
import { StudentSubjectResultsService } from './student-subject-results.service';
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
  controllers: [StudentSubjectResultsController],
  providers: [StudentSubjectResultsService],
  exports: [StudentSubjectResultsService],
})
export class StudentSubjectResultsModule {}

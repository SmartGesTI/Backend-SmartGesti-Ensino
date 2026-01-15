import { Module, forwardRef } from '@nestjs/common';
import { StudentTimelineController } from './student-timeline.controller';
import { StudentTimelineService } from './student-timeline.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [SupabaseModule, LoggerModule, forwardRef(() => TenantsModule)],
  controllers: [StudentTimelineController],
  providers: [StudentTimelineService],
  exports: [StudentTimelineService],
})
export class StudentTimelineModule {}

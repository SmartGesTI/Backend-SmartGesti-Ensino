import { Module } from '@nestjs/common';
import { InsightEventsController } from './insight-events.controller';
import { InsightEventsService } from './insight-events.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [SupabaseModule, LoggerModule, UsersModule, TenantsModule],
  controllers: [InsightEventsController],
  providers: [InsightEventsService],
  exports: [InsightEventsService],
})
export class InsightEventsModule {}

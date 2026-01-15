import { Module } from '@nestjs/common';
import { AttendanceSessionsController } from './attendance-sessions.controller';
import { AttendanceSessionsService } from './attendance-sessions.service';
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
  controllers: [AttendanceSessionsController],
  providers: [AttendanceSessionsService],
  exports: [AttendanceSessionsService],
})
export class AttendanceSessionsModule {}

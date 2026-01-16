import { Module } from '@nestjs/common';
import { CalendarEventTypesController } from './calendar-event-types.controller';
import { CalendarEventTypesService } from './calendar-event-types.service';
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
  controllers: [CalendarEventTypesController],
  providers: [CalendarEventTypesService],
  exports: [CalendarEventTypesService],
})
export class CalendarEventTypesModule {}

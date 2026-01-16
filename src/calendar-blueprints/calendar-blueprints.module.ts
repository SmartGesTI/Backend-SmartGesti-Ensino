import { Module } from '@nestjs/common';
import { CalendarBlueprintsController } from './calendar-blueprints.controller';
import { CalendarBlueprintsService } from './calendar-blueprints.service';
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
  controllers: [CalendarBlueprintsController],
  providers: [CalendarBlueprintsService],
  exports: [CalendarBlueprintsService],
})
export class CalendarBlueprintsModule {}

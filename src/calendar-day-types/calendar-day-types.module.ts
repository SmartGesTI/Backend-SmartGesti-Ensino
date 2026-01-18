import { Module } from '@nestjs/common';
import { CalendarDayTypesController } from './calendar-day-types.controller';
import { CalendarDayTypesService } from './calendar-day-types.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { ServicesModule } from '../common/services/services.module';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [
    SupabaseModule,
    ServicesModule,
    UsersModule,
    TenantsModule,
  ],
  controllers: [CalendarDayTypesController],
  providers: [CalendarDayTypesService],
  exports: [CalendarDayTypesService],
})
export class CalendarDayTypesModule {}

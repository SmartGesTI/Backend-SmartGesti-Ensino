import { Module } from '@nestjs/common';
import { AcademicCalendarsController } from './academic-calendars.controller';
import { AcademicCalendarsService } from './academic-calendars.service';
import { AcademicCalendarAuditService } from './academic-calendar-audit.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { ServicesModule } from '../common/services/services.module';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';
import { CalendarBlueprintsModule } from '../calendar-blueprints/calendar-blueprints.module';

@Module({
  imports: [
    SupabaseModule,
    LoggerModule,
    ServicesModule,
    UsersModule,
    TenantsModule,
    CalendarBlueprintsModule,
  ],
  controllers: [AcademicCalendarsController],
  providers: [AcademicCalendarsService, AcademicCalendarAuditService],
  exports: [AcademicCalendarsService, AcademicCalendarAuditService],
})
export class AcademicCalendarsModule {}

import { Module } from '@nestjs/common';
import { TimeSlotsController } from './time-slots.controller';
import { TimeSlotsService } from './time-slots.service';
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
  controllers: [TimeSlotsController],
  providers: [TimeSlotsService],
  exports: [TimeSlotsService],
})
export class TimeSlotsModule {}

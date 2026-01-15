import { Module } from '@nestjs/common';
import { MetricValuesController } from './metric-values.controller';
import { MetricValuesService } from './metric-values.service';
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
  controllers: [MetricValuesController],
  providers: [MetricValuesService],
  exports: [MetricValuesService],
})
export class MetricValuesModule {}

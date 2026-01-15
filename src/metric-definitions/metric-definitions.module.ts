import { Module } from '@nestjs/common';
import { MetricDefinitionsController } from './metric-definitions.controller';
import { MetricDefinitionsService } from './metric-definitions.service';
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
  controllers: [MetricDefinitionsController],
  providers: [MetricDefinitionsService],
  exports: [MetricDefinitionsService],
})
export class MetricDefinitionsModule {}

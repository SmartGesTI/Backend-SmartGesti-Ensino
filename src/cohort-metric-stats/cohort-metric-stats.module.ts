import { Module } from '@nestjs/common';
import { CohortMetricStatsController } from './cohort-metric-stats.controller';
import { CohortMetricStatsService } from './cohort-metric-stats.service';
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
  controllers: [CohortMetricStatsController],
  providers: [CohortMetricStatsService],
  exports: [CohortMetricStatsService],
})
export class CohortMetricStatsModule {}

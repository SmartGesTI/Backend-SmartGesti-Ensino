import { Module } from '@nestjs/common';
import { InsightDeliveriesController } from './insight-deliveries.controller';
import { InsightDeliveriesService } from './insight-deliveries.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [SupabaseModule, LoggerModule, UsersModule, TenantsModule],
  controllers: [InsightDeliveriesController],
  providers: [InsightDeliveriesService],
  exports: [InsightDeliveriesService],
})
export class InsightDeliveriesModule {}

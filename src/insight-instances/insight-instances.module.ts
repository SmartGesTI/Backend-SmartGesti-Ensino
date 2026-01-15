import { Module } from '@nestjs/common';
import { InsightInstancesController } from './insight-instances.controller';
import { InsightInstancesService } from './insight-instances.service';
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
  controllers: [InsightInstancesController],
  providers: [InsightInstancesService],
  exports: [InsightInstancesService],
})
export class InsightInstancesModule {}

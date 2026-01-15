import { Module } from '@nestjs/common';
import { FamiliesController } from './families.controller';
import { FamiliesService } from './families.service';
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
  controllers: [FamiliesController],
  providers: [FamiliesService],
  exports: [FamiliesService],
})
export class FamiliesModule {}

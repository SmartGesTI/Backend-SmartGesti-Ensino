import { Module } from '@nestjs/common';
import { DataSharesController } from './data-shares.controller';
import { DataSharesService } from './data-shares.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { ServicesModule } from '../common/services/services.module';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';
import { SchoolsModule } from '../schools/schools.module';

@Module({
  imports: [
    SupabaseModule,
    LoggerModule,
    ServicesModule,
    UsersModule,
    TenantsModule,
    SchoolsModule,
  ],
  controllers: [DataSharesController],
  providers: [DataSharesService],
  exports: [DataSharesService],
})
export class DataSharesModule {}

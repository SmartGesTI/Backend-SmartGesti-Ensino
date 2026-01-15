import { Module } from '@nestjs/common';
import { ConsentsController } from './consents.controller';
import { ConsentsService } from './consents.service';
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
  controllers: [ConsentsController],
  providers: [ConsentsService],
  exports: [ConsentsService],
})
export class ConsentsModule {}

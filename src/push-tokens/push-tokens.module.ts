import { Module } from '@nestjs/common';
import { PushTokensController } from './push-tokens.controller';
import { PushTokensService } from './push-tokens.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [SupabaseModule, LoggerModule, UsersModule, TenantsModule],
  controllers: [PushTokensController],
  providers: [PushTokensService],
  exports: [PushTokensService],
})
export class PushTokensModule {}

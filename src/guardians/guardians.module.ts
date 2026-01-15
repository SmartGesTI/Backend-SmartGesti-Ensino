import { Module } from '@nestjs/common';
import { GuardiansController } from './guardians.controller';
import { GuardiansService } from './guardians.service';
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
  controllers: [GuardiansController],
  providers: [GuardiansService],
  exports: [GuardiansService],
})
export class GuardiansModule {}

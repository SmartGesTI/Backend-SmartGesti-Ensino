import { Module, forwardRef } from '@nestjs/common';
import { GradeLevelsController } from './grade-levels.controller';
import { GradeLevelsService } from './grade-levels.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [
    SupabaseModule,
    LoggerModule,
    UsersModule,
    forwardRef(() => TenantsModule),
  ],
  controllers: [GradeLevelsController],
  providers: [GradeLevelsService],
  exports: [GradeLevelsService],
})
export class GradeLevelsModule {}

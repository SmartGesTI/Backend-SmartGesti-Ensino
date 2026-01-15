import { Module } from '@nestjs/common';
import { CurriculumController } from './curriculum.controller';
import { CurriculumService } from './curriculum.service';
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
  controllers: [CurriculumController],
  providers: [CurriculumService],
  exports: [CurriculumService],
})
export class CurriculumModule {}

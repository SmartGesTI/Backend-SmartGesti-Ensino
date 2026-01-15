import { Module } from '@nestjs/common';
import { SubjectsController } from './subjects.controller';
import { SubjectsService } from './subjects.service';
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
  controllers: [SubjectsController],
  providers: [SubjectsService],
  exports: [SubjectsService],
})
export class SubjectsModule {}

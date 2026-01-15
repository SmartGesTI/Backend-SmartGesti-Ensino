import { Module } from '@nestjs/common';
import { ClassGroupSubjectsController } from './class-group-subjects.controller';
import { ClassGroupSubjectsService } from './class-group-subjects.service';
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
  controllers: [ClassGroupSubjectsController],
  providers: [ClassGroupSubjectsService],
  exports: [ClassGroupSubjectsService],
})
export class ClassGroupSubjectsModule {}

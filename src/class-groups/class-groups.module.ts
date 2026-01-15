import { Module, forwardRef } from '@nestjs/common';
import { ClassGroupsController } from './class-groups.controller';
import { ClassGroupsService } from './class-groups.service';
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
  controllers: [ClassGroupsController],
  providers: [ClassGroupsService],
  exports: [ClassGroupsService],
})
export class ClassGroupsModule {}

import { Module, forwardRef } from '@nestjs/common';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';
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
  controllers: [SchoolsController],
  providers: [SchoolsService],
  exports: [SchoolsService],
})
export class SchoolsModule {}

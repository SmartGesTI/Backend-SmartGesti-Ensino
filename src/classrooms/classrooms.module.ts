import { Module, forwardRef } from '@nestjs/common';
import { ClassroomsController } from './classrooms.controller';
import { ClassroomsService } from './classrooms.service';
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
  controllers: [ClassroomsController],
  providers: [ClassroomsService],
  exports: [ClassroomsService],
})
export class ClassroomsModule {}

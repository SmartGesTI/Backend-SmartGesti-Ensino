import { Module } from '@nestjs/common';
import { StaffMembersController } from './staff-members.controller';
import { StaffMembersService } from './staff-members.service';
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
  controllers: [StaffMembersController],
  providers: [StaffMembersService],
  exports: [StaffMembersService],
})
export class StaffMembersModule {}

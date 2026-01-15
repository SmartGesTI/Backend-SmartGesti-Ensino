import { Module, forwardRef } from '@nestjs/common';
import { ShiftsController } from './shifts.controller';
import { ShiftsService } from './shifts.service';
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
  controllers: [ShiftsController],
  providers: [ShiftsService],
  exports: [ShiftsService],
})
export class ShiftsModule {}

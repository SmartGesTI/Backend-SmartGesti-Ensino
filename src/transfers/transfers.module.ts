import { Module, forwardRef } from '@nestjs/common';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';
import { AcademicRecordSnapshotsModule } from '../academic-record-snapshots/academic-record-snapshots.module';

@Module({
  imports: [
    SupabaseModule,
    LoggerModule,
    UsersModule,
    forwardRef(() => TenantsModule),
    AcademicRecordSnapshotsModule,
  ],
  controllers: [TransfersController],
  providers: [TransfersService],
  exports: [TransfersService],
})
export class TransfersModule {}

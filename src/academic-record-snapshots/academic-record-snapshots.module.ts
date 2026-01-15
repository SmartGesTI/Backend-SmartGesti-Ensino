import { Module } from '@nestjs/common';
import { AcademicRecordSnapshotsController } from './academic-record-snapshots.controller';
import { AcademicRecordSnapshotsService } from './academic-record-snapshots.service';
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
  controllers: [AcademicRecordSnapshotsController],
  providers: [AcademicRecordSnapshotsService],
  exports: [AcademicRecordSnapshotsService],
})
export class AcademicRecordSnapshotsModule {}

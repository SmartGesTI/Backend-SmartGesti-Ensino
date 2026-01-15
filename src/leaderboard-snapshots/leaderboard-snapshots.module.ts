import { Module } from '@nestjs/common';
import { LeaderboardSnapshotsController } from './leaderboard-snapshots.controller';
import { LeaderboardSnapshotsService } from './leaderboard-snapshots.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [SupabaseModule, LoggerModule, UsersModule, TenantsModule],
  controllers: [LeaderboardSnapshotsController],
  providers: [LeaderboardSnapshotsService],
  exports: [LeaderboardSnapshotsService],
})
export class LeaderboardSnapshotsModule {}

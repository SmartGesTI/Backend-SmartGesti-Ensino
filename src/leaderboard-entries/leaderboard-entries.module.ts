import { Module } from '@nestjs/common';
import { LeaderboardEntriesController } from './leaderboard-entries.controller';
import { LeaderboardEntriesService } from './leaderboard-entries.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [SupabaseModule, LoggerModule, TenantsModule],
  controllers: [LeaderboardEntriesController],
  providers: [LeaderboardEntriesService],
  exports: [LeaderboardEntriesService],
})
export class LeaderboardEntriesModule {}

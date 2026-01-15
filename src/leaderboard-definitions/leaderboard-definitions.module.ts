import { Module } from '@nestjs/common';
import { LeaderboardDefinitionsController } from './leaderboard-definitions.controller';
import { LeaderboardDefinitionsService } from './leaderboard-definitions.service';
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
  controllers: [LeaderboardDefinitionsController],
  providers: [LeaderboardDefinitionsService],
  exports: [LeaderboardDefinitionsService],
})
export class LeaderboardDefinitionsModule {}

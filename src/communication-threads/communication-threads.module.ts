import { Module } from '@nestjs/common';
import { CommunicationThreadsController } from './communication-threads.controller';
import { CommunicationThreadsService } from './communication-threads.service';
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
  controllers: [CommunicationThreadsController],
  providers: [CommunicationThreadsService],
  exports: [CommunicationThreadsService],
})
export class CommunicationThreadsModule {}

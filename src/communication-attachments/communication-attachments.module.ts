import { Module } from '@nestjs/common';
import { CommunicationAttachmentsController } from './communication-attachments.controller';
import { CommunicationAttachmentsService } from './communication-attachments.service';
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
  controllers: [CommunicationAttachmentsController],
  providers: [CommunicationAttachmentsService],
  exports: [CommunicationAttachmentsService],
})
export class CommunicationAttachmentsModule {}

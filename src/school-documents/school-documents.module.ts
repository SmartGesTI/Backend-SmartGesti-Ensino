import { Module } from '@nestjs/common';
import { SchoolDocumentsController } from './school-documents.controller';
import { SchoolDocumentsService } from './school-documents.service';
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
  controllers: [SchoolDocumentsController],
  providers: [SchoolDocumentsService],
  exports: [SchoolDocumentsService],
})
export class SchoolDocumentsModule {}

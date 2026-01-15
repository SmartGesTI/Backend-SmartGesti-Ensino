import { Module } from '@nestjs/common';
import { SchoolDocumentTemplatesController } from './school-document-templates.controller';
import { SchoolDocumentTemplatesService } from './school-document-templates.service';
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
  controllers: [SchoolDocumentTemplatesController],
  providers: [SchoolDocumentTemplatesService],
  exports: [SchoolDocumentTemplatesService],
})
export class SchoolDocumentTemplatesModule {}

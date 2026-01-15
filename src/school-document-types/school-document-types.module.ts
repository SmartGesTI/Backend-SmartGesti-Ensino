import { Module } from '@nestjs/common';
import { SchoolDocumentTypesController } from './school-document-types.controller';
import { SchoolDocumentTypesService } from './school-document-types.service';
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
  controllers: [SchoolDocumentTypesController],
  providers: [SchoolDocumentTypesService],
  exports: [SchoolDocumentTypesService],
})
export class SchoolDocumentTypesModule {}

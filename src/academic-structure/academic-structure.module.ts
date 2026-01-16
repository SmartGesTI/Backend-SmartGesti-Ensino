import { Module, forwardRef } from '@nestjs/common';
import { AcademicStructureController } from './academic-structure.controller';
import { AcademicStructureService } from './academic-structure.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [SupabaseModule, LoggerModule, forwardRef(() => TenantsModule)],
  controllers: [AcademicStructureController],
  providers: [AcademicStructureService],
  exports: [AcademicStructureService],
})
export class AcademicStructureModule {}

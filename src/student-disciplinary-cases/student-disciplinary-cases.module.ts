import { Module } from '@nestjs/common';
import { StudentDisciplinaryCasesController } from './student-disciplinary-cases.controller';
import { StudentDisciplinaryCasesService } from './student-disciplinary-cases.service';
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
  controllers: [StudentDisciplinaryCasesController],
  providers: [StudentDisciplinaryCasesService],
  exports: [StudentDisciplinaryCasesService],
})
export class StudentDisciplinaryCasesModule {}

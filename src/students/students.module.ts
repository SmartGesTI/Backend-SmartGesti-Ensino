import { Module, forwardRef } from '@nestjs/common';
import { StudentsController } from './students.controller';
import { StudentsService } from './students.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';
import { PersonsModule } from '../persons/persons.module';

@Module({
  imports: [
    SupabaseModule,
    LoggerModule,
    UsersModule,
    forwardRef(() => TenantsModule),
    PersonsModule,
  ],
  controllers: [StudentsController],
  providers: [StudentsService],
  exports: [StudentsService],
})
export class StudentsModule {}

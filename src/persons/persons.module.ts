import { Module } from '@nestjs/common';
import { PersonsController } from './persons.controller';
import { PersonsService } from './persons.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [SupabaseModule, LoggerModule, UsersModule],
  controllers: [PersonsController],
  providers: [PersonsService],
  exports: [PersonsService],
})
export class PersonsModule {}

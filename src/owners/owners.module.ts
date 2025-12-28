import { Module, forwardRef } from '@nestjs/common';
import { OwnersController } from './owners.controller';
import { OwnersService } from './owners.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { UsersModule } from '../users/users.module';
import { LoggerModule } from '../common/logger/logger.module';

@Module({
  imports: [
    SupabaseModule,
    forwardRef(() => UsersModule),
    LoggerModule,
  ],
  controllers: [OwnersController],
  providers: [OwnersService],
  exports: [OwnersService], // Exportar para uso em TenantsService
})
export class OwnersModule {}

import { Module, forwardRef } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';
import { PermissionGuard } from './guards/permission.guard';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';
import { RolesModule } from '../roles/roles.module';

@Module({
  imports: [
    SupabaseModule,
    AuthModule,
    forwardRef(() => RolesModule), // Usar forwardRef para evitar dependência circular
  ],
  controllers: [PermissionsController],
  providers: [PermissionsService, PermissionGuard],
  exports: [PermissionsService, PermissionGuard],
})
export class PermissionsModule {}

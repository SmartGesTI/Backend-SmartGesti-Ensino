import { Module, forwardRef, Global } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';
import { PermissionGuard } from './guards/permission.guard';
import { PermissionsCacheService } from './permissions-cache.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { AuthModule } from '../auth/auth.module';
import { RolesModule } from '../roles/roles.module';

@Global() // Tornar global para que o cache seja compartilhado
@Module({
  imports: [
    SupabaseModule,
    AuthModule,
    forwardRef(() => RolesModule), // Usar forwardRef para evitar dependência circular
  ],
  controllers: [PermissionsController],
  providers: [PermissionsService, PermissionGuard, PermissionsCacheService],
  exports: [PermissionsService, PermissionGuard, PermissionsCacheService],
})
export class PermissionsModule {}

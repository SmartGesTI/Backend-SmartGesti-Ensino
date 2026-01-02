import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SitesController } from './sites.controller';
import { SiteGeneratorController } from './site-generator.controller';
import { SitesService } from './sites.service';
import { SiteGeneratorService } from './site-generator.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { LoggerModule } from '../common/logger/logger.module';
import { AuthModule } from '../auth/auth.module';
import { SchoolsModule } from '../schools/schools.module';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
  imports: [
    ConfigModule,
    SupabaseModule,
    LoggerModule,
    AuthModule,
    SchoolsModule,
    forwardRef(() => PermissionsModule),
  ],
  // SiteGeneratorController MUST come before SitesController
  // because it handles specific routes like /generate that would otherwise
  // be caught by SitesController's :id parameter routes
  controllers: [SiteGeneratorController, SitesController],
  providers: [SitesService, SiteGeneratorService],
  exports: [SitesService, SiteGeneratorService],
})
export class SitesModule {}

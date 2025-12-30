import { Module, forwardRef } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';
import { AgentsPermissionsService } from './agents.permissions.service';
import { WorkflowExecutorService } from './workflow-executor.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { MarkdownPdfService } from './markdown-pdf.service';
import { DocumentTextExtractorService } from './document-text-extractor.service';
import { SupabaseModule } from '../supabase/supabase.module';
import { PermissionsModule } from '../permissions/permissions.module';
import { RolesModule } from '../roles/roles.module';
import { AuthModule } from '../auth/auth.module';
import { LoggerService } from '../common/logger/logger.service';
import { UsersModule } from '../users/users.module';
import { TenantsModule } from '../tenants/tenants.module';
import { SchoolsModule } from '../schools/schools.module';

@Module({
  imports: [
    SupabaseModule,
    UsersModule,
    forwardRef(() => TenantsModule),
    SchoolsModule,
    forwardRef(() => PermissionsModule),
    forwardRef(() => RolesModule),
    AuthModule,
  ],
  controllers: [AgentsController],
  providers: [
    AgentsService,
    AgentsPermissionsService,
    WorkflowExecutorService,
    PdfGeneratorService,
    MarkdownPdfService,
    DocumentTextExtractorService,
    LoggerService,
  ],
  exports: [AgentsService, AgentsPermissionsService, WorkflowExecutorService],
})
export class AgentsModule {}
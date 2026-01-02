import { Module, OnModuleInit } from '@nestjs/common';
import { AssistantService } from './assistant.service';
import { AssistantController } from './assistant.controller';
import { ConversationService } from './conversation/conversation.service';
import { KnowledgeService } from './knowledge/knowledge.service';
import { SitemapService } from './sitemap/sitemap.service';
import { SharedModule } from '../shared/shared.module';
import { SupabaseModule } from '../../supabase/supabase.module';
import { UsersModule } from '../../users/users.module';
import { TenantsModule } from '../../tenants/tenants.module';
import { LoggerService } from '../../common/logger/logger.service';
import { PageInfoTool } from './tools/page-info.tool';
import { RouteTool } from './tools/route.tool';
import { DatabaseTool } from './tools/database.tool';
import { KnowledgeSearchTool } from './tools/knowledge-search.tool';
import { ApiInfoTool } from './tools/api-info.tool';
import { SitemapTool } from './tools/sitemap.tool';
import { ToolRegistryService } from '../shared/tools/tool-registry.service';
// Novos serviços refatorados
import { MessageProcessorService } from './services/message-processor.service';
import { ToolOrchestratorService } from './services/tool-orchestrator.service';

@Module({
  imports: [
    SharedModule,
    SupabaseModule,
    UsersModule,
    TenantsModule,
  ],
  controllers: [AssistantController],
  providers: [
    AssistantService,
    ConversationService,
    KnowledgeService,
    SitemapService,
    // Serviços auxiliares
    MessageProcessorService,
    ToolOrchestratorService,
    // Tools
    PageInfoTool,
    RouteTool,
    DatabaseTool,
    KnowledgeSearchTool,
    ApiInfoTool,
    SitemapTool,
  ],
  exports: [AssistantService],
})
export class AssistantModule implements OnModuleInit {
  constructor(
    private readonly toolRegistry: ToolRegistryService,
    private readonly pageInfoTool: PageInfoTool,
    private readonly routeTool: RouteTool,
    private readonly databaseTool: DatabaseTool,
    private readonly knowledgeSearchTool: KnowledgeSearchTool,
    private readonly apiInfoTool: ApiInfoTool,
    private readonly sitemapTool: SitemapTool,
    private readonly logger: LoggerService,
  ) {}

  onModuleInit() {
    // Registrar todas as tools quando o módulo inicializar
    this.toolRegistry.register(this.pageInfoTool);
    this.toolRegistry.register(this.routeTool);
    this.toolRegistry.register(this.databaseTool);
    this.toolRegistry.register(this.knowledgeSearchTool);
    this.toolRegistry.register(this.apiInfoTool);
    this.toolRegistry.register(this.sitemapTool);
    
    this.logger.log('Tools do assistente registradas', 'AssistantModule');
  }
}

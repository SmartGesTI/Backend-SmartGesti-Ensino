import { Module } from '@nestjs/common';
import { ManagerAgentModule } from './manager/manager-agent.module';
import { KnowledgeBaseAgentModule } from './knowledge-base/knowledge-base-agent.module';
import { SharedToolsModule } from './shared/shared-tools.module';

/**
 * Módulo principal de agentes
 * Agrega todos os módulos de agentes específicos
 */
@Module({
  imports: [
    ManagerAgentModule,
    KnowledgeBaseAgentModule,
    SharedToolsModule,
  ],
  exports: [
    ManagerAgentModule,
    KnowledgeBaseAgentModule,
    SharedToolsModule,
  ],
})
export class AgentesModule {}

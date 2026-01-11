import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { SharedToolsModule } from '../shared/shared-tools.module';
import { KnowledgeBaseAgentService } from './knowledge-base-agent.service';

/**
 * Módulo do KnowledgeBaseAgent
 */
@Module({
  imports: [CoreModule, SharedToolsModule],
  providers: [KnowledgeBaseAgentService],
  exports: [KnowledgeBaseAgentService],
})
export class KnowledgeBaseAgentModule {}

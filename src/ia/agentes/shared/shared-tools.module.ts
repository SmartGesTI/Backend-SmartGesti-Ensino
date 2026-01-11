import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { RagModule } from '../../../rag/rag.module';
import { KnowledgeRetrievalService } from '../../retrieval/knowledge-retrieval.service';
import {
  KnowledgeSearchToolFactory,
  ListPublicAgentsToolFactory,
  GetAgentDetailsToolFactory,
} from './tools';

/**
 * Módulo de tools compartilhadas
 * Exporta factories de tools que podem ser usadas por múltiplos agentes
 */
@Module({
  imports: [CoreModule, RagModule],
  providers: [
    KnowledgeRetrievalService,
    KnowledgeSearchToolFactory,
    ListPublicAgentsToolFactory,
    GetAgentDetailsToolFactory,
  ],
  exports: [
    KnowledgeSearchToolFactory,
    ListPublicAgentsToolFactory,
    GetAgentDetailsToolFactory,
  ],
})
export class SharedToolsModule {}
